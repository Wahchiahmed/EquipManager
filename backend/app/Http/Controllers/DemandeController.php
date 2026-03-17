<?php

namespace App\Http\Controllers;

use App\Models\Demande;
use App\Models\DetailDemande;
use App\Models\Produit;
use App\Services\AuditService;
use App\Services\NotificationService;   // ← NEW
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DemandeController extends Controller
{
    public function __construct(
        private AuditService        $audit,
        private NotificationService $notif,  // ← NEW
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $role = strtolower(trim($user->role->nom));

        $query = Demande::with(['details.Produit', 'demandeur.departement', 'responsableDept', 'responsableStock'])
            ->orderByDesc('date_demande');

        match ($role) {
            'employe'                 => $query->where('id_demandeur', $user->id),
            'responsable departement' => $query->whereHas('demandeur', fn($q) => $q->where('departement_id', $user->departement_id)),
            'responsable stock'       => $query->whereIn('statut', [
                'EN_ATTENTE_STOCK',
                'VALIDEE',
                'PARTIELLEMENT_VALIDEE',
                'LIVREE',
            ]),
            default => null,
        };

        return response()->json($query->get()->map(fn($d) => $this->format($d)));
    }

    public function stats(Request $request)
    {
        $userId = $request->user()->id;
        $base   = Demande::where('id_demandeur', $userId);

        return response()->json([
            'total'    => (clone $base)->count(),
            'pending'  => (clone $base)->whereIn('statut', ['EN_ATTENTE_DEPT', 'EN_ATTENTE_STOCK'])->count(),
            'approved' => (clone $base)->whereIn('statut', ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE'])->count(),
            'rejected' => (clone $base)->whereIn('statut', ['REFUSEE_DEPT', 'REFUSEE_STOCK'])->count(),
        ]);
    }

    // ── A) STORE ─────────────────────────────────────────────────────────────
    // NOTIFICATION: Notify dept manager on new demande
    public function store(Request $request)
    {

        $request->validate([
            'commentaire'          => 'nullable|string|max:1000',
            'details'              => 'required|array|min:1',
            'details.*.id_produit' => 'required|exists:produits,id_produit',
            'details.*.quantite'   => 'required|integer|min:1',
        ]);

        $ProduitIds = collect($request->details)->pluck('id_produit');
        $inactifs   = Produit::whereIn('id_produit', $ProduitIds)->where('is_active', false)->pluck('nom_produit');

        if ($inactifs->isNotEmpty()) {
            return response()->json(['message' => 'Produit(s) inactif(s) : ' . $inactifs->join(', ')], 422);
        }

        $user = $request->user();

        $demande = DB::transaction(function () use ($request, $user) {

            $demande = Demande::create([
                'statut'       => Demande::STATUT_ATTENTE_DEPT,
                'id_demandeur' => $user->id,
                'commentaire'  => $request->commentaire,
                'date_demande' => now(),
            ]);
            if (!$request->filled('details') || !is_array($request->input('details'))) {
                return response()->json(['message' => 'details invalide'], 422);
            }

            foreach ($request->input('details', []) as $line) {
                DetailDemande::create([
                    'id_demande' => $demande->id_demande,
                    'id_produit' => (int) ($line['id_produit'] ?? 0),
                    'quantite'   => (int) ($line['quantite'] ?? 0),
                    'statut'     => DetailDemande::STATUT_EN_ATTENTE,
                ]);
            }

            // ── AUDIT ─────────────────────────────────────────────────────────
            $detailsAudit = collect($request->details)->map(fn($line) => [
                'champs_modifie' => 'ligne_demande',
                'ancien_valeur'  => null,
                'nouveau_valeur' => (string) $line['quantite'],
                'info_detail'    => 'Produit#' . $line['id_produit'],
                'commentaire'    => 'Ajout ligne',
            ])->values()->toArray();

            $this->audit->log(
                $user->id,
                'demandes',
                'INSERT',
                "Création demande (EN_ATTENTE_DEPT) par {$user->prenom} {$user->nom}",
                "demande#{$demande->id_demande}",
                $detailsAudit
            );

            // ── NOTIFICATION A ────────────────────────────────────────────────
            // Runs inside the transaction → created only on commit
            $this->notif->onDemandeCreee(
                demandeId: $demande->id_demande,
                demandeurId: $user->id,
                demandeurFullName: "{$user->prenom} {$user->nom}",
                departementId: $user->departement_id,
                notifyEmployee: false   // set true if you want a confirmation notification
            );

            return $demande;
        });

        return response()->json($this->format($demande->load(['details.Produit', 'demandeur.departement'])), 201);
    }

    // ── D) STORE (Chef Département) ───────────────────────────────────────────────
    // La demande du chef saute la validation département → directement EN_ATTENTE_STOCK
    public function storeChefDept(Request $request)
    {
        $request->validate([
            'commentaire'          => 'nullable|string|max:1000',
            'details'              => 'required|array|min:1',
            'details.*.id_produit' => 'required|exists:produits,id_produit',
            'details.*.quantite'   => 'required|integer|min:1',
        ]);

        $produitIds = collect($request->details)->pluck('id_produit');
        $inactifs   = Produit::whereIn('id_produit', $produitIds)
            ->where('is_active', false)
            ->pluck('nom_produit');

        if ($inactifs->isNotEmpty()) {
            return response()->json([
                'message' => 'Produit(s) inactif(s) : ' . $inactifs->join(', ')
            ], 422);
        }

        $user = $request->user();

        $demande = DB::transaction(function () use ($request, $user) {

            $demande = Demande::create([
                'statut'               => Demande::STATUT_ATTENTE_STOCK,  // ← bypass dept
                'id_demandeur'         => $user->id,
                'id_responsable_dept'  => $user->id,                      // chef = lui-même
                'date_validation_dept' => now(),                           // validé immédiatement
                'commentaire'          => $request->commentaire,
                'date_demande'         => now(),
            ]);

            foreach ($request->input('details', []) as $line) {
                DetailDemande::create([
                    'id_demande' => $demande->id_demande,
                    'id_produit' => (int) $line['id_produit'],
                    'quantite'   => (int) $line['quantite'],
                    'statut'     => DetailDemande::STATUT_EN_ATTENTE,
                ]);
            }

            // Audit
            $detailsAudit = collect($request->details)->map(fn($line) => [
                'champs_modifie' => 'ligne_demande',
                'ancien_valeur'  => null,
                'nouveau_valeur' => (string) $line['quantite'],
                'info_detail'    => 'Produit#' . $line['id_produit'],
                'commentaire'    => 'Ajout ligne (demande chef département)',
            ])->values()->toArray();

            $this->audit->log(
                $user->id,
                'demandes',
                'INSERT',
                "Création demande directe stock (EN_ATTENTE_STOCK) par chef dept {$user->prenom} {$user->nom}",
                "demande#{$demande->id_demande}",
                $detailsAudit
            );

            // Notification → responsables stock
            $this->notif->onDemandeApprouvee(
                demandeId: $demande->id_demande,
                demandeurId: $user->id,
                deptManagerName: "{$user->prenom} {$user->nom}"
            );

            return $demande;
        });

        return response()->json(
            $this->format($demande->load(['details.Produit', 'demandeur.departement'])),
            201
        );
    }

    public function show(Request $request, Demande $demande)
    {
        $user = $request->user();
        if (strtolower(trim($user->role->nom)) === 'employe' && $demande->id_demandeur !== $user->id) {
            return response()->json(['message' => 'Non autorisé.'], 403);
        }
        return response()->json($this->format($demande->load(['details.Produit', 'demandeur.departement', 'responsableDept', 'responsableStock'])));
    }

    public function update(Request $request, Demande $demande)
    {
        $request->validate([
            'statut'      => 'required|in:EN_ATTENTE_STOCK,VALIDEE,PARTIELLEMENT_VALIDEE,LIVREE,REFUSEE_DEPT,REFUSEE_STOCK',
            'commentaire' => 'nullable|string|max:1000',
        ]);

        $user           = $request->user();
        $statut         = $request->statut;
        $oldStatut      = $demande->statut;
        $oldCommentaire = $demande->commentaire;

        $updates = [
            'statut'      => $statut,
            'commentaire' => $request->commentaire ?? $demande->commentaire,
        ];

        if (in_array($statut, ['EN_ATTENTE_STOCK', 'REFUSEE_DEPT'])) {
            $updates['id_responsable_dept']  = $user->id;
            $updates['date_validation_dept'] = now();
        }
        if (in_array($statut, ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE', 'REFUSEE_STOCK'])) {
            $updates['id_responsable_stock']  = $user->id;
            $updates['date_validation_stock'] = now();
        }

        $demande->update($updates);

        // AUDIT
        $detailsAudit = [];
        if ($oldStatut !== $statut) {
            $detailsAudit[] = [
                'champs_modifie' => 'statut',
                'ancien_valeur'  => $oldStatut,
                'nouveau_valeur' => $statut,
                'info_detail'    => "demande#{$demande->id_demande}",
                'commentaire'    => null,
            ];
        }
        if (($oldCommentaire ?? '') !== ($updates['commentaire'] ?? '')) {
            $detailsAudit[] = [
                'champs_modifie' => 'commentaire',
                'ancien_valeur'  => $oldCommentaire,
                'nouveau_valeur' => $updates['commentaire'],
                'info_detail'    => "demande#{$demande->id_demande}",
                'commentaire'    => null,
            ];
        }
        if (!empty($detailsAudit)) {
            $this->audit->log($user->id, 'demandes', 'UPDATE', "Mise à jour demande #{$demande->id_demande}", "demande#{$demande->id_demande}", $detailsAudit);
        }

        return response()->json($this->format($demande->load(['details.Produit', 'demandeur.departement', 'responsableDept', 'responsableStock'])));
    }

    public function destroy(Request $request, Demande $demande)
    {
        $user = $request->user();
        if ($demande->id_demandeur !== $user->id) {
            return response()->json(['message' => 'Non autorisé.'], 403);
        }
        if ($demande->statut !== Demande::STATUT_ATTENTE_DEPT) {
            return response()->json(['message' => 'Impossible de supprimer une demande déjà traitée.'], 422);
        }

        DB::transaction(function () use ($demande, $user) {
            $demandeId = $demande->id_demande;
            $this->audit->log($user->id, 'demandes', 'DELETE', "Suppression demande #{$demandeId}", "demande#{$demandeId}", []);
            $demande->details()->delete();
            $demande->delete();
        });

        return response()->json(['message' => 'Demande supprimée.']);
    }

    public function modifier(Request $request, Demande $demande)
    {
        $user = $request->user();

        if ($demande->id_demandeur !== $user->id) {
            return response()->json(['message' => 'Non autorisé.'], 403);
        }
        if ($demande->statut !== Demande::STATUT_ATTENTE_DEPT) {
            return response()->json(['message' => 'Cette demande ne peut plus être modifiée (statut : ' . $demande->statut . ').'], 422);
        }

        $request->validate([
            'commentaire'          => 'nullable|string|max:1000',
            'details'              => 'required|array|min:1',
            'details.*.id_produit' => 'required|exists:produits,id_produit',
            'details.*.quantite'   => 'required|integer|min:1',
        ]);

        $ProduitIds = collect($request->details)->pluck('id_produit');
        $inactifs   = Produit::whereIn('id_produit', $ProduitIds)->where('is_active', false)->pluck('nom_produit');
        if ($inactifs->isNotEmpty()) {
            return response()->json(['message' => 'Produit(s) inactif(s) : ' . $inactifs->join(', ')], 422);
        }

        DB::transaction(function () use ($request, $demande, $user) {
            $oldCommentaire = $demande->commentaire;
            $oldLines = $demande->details()->get()->map(fn($d) => ['id_produit' => $d->id_produit, 'quantite' => $d->quantite])->toArray();

            $demande->update(['commentaire' => $request->has('commentaire') ? $request->commentaire : $demande->commentaire]);
            $demande->details()->delete();

            foreach ($request->details as $line) {
                DetailDemande::create([
                    'id_demande' => $demande->id_demande,
                    'id_produit' => $line['id_produit'],
                    'quantite'   => $line['quantite'],
                    'statut'     => DetailDemande::STATUT_EN_ATTENTE,
                ]);
            }

            $detailsAudit = [];
            if (($oldCommentaire ?? '') !== ($demande->commentaire ?? '')) {
                $detailsAudit[] = ['champs_modifie' => 'commentaire', 'ancien_valeur' => $oldCommentaire, 'nouveau_valeur' => $demande->commentaire, 'info_detail' => "demande#{$demande->id_demande}", 'commentaire' => 'Modification demande'];
            }
            $detailsAudit[] = ['champs_modifie' => 'details', 'ancien_valeur' => json_encode($oldLines), 'nouveau_valeur' => json_encode($request->details), 'info_detail' => "demande#{$demande->id_demande}", 'commentaire' => 'Remplacement complet des lignes'];

            $this->audit->log($user->id, 'detail_demandes', 'UPDATE', "Modification lignes demande #{$demande->id_demande}", "demande#{$demande->id_demande}", $detailsAudit);
        });

        return response()->json($this->format($demande->fresh(['details.Produit', 'demandeur.departement'])));
    }

    // ── Dept manager endpoints ────────────────────────────────────────────────

    public function statsDept(Request $request)
    {
        $deptId = $request->user()->departement_id;
        $base   = Demande::whereHas('demandeur', fn($q) => $q->where('departement_id', $deptId));

        return response()->json([
            'total'      => (clone $base)->count(),
            'en_attente' => (clone $base)->where('statut', 'EN_ATTENTE_DEPT')->count(),
            'transmises' => (clone $base)->where('statut', 'EN_ATTENTE_STOCK')->count(),
            'traitees'   => (clone $base)->whereIn('statut', ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE', 'REFUSEE_STOCK'])->count(),
            'refusees'   => (clone $base)->where('statut', 'REFUSEE_DEPT')->count(),
        ]);
    }

    public function indexForDept(Request $request)
    {
        $deptId   = $request->user()->departement_id;
        $demandes = Demande::with(['details.Produit', 'demandeur.departement'])
            ->whereHas('demandeur', fn($q) => $q->where('departement_id', $deptId))
            ->orderByDesc('date_demande')
            ->get()
            ->map(fn($d) => $this->format($d));

        return response()->json($demandes);
    }

    // ── B) APPROUVER DEPT ─────────────────────────────────────────────────────
    // NOTIFICATION: Notify stock managers + employee
    public function approuverDept(Request $request, Demande $demande)
    {
        if ($demande->statut !== Demande::STATUT_ATTENTE_DEPT) {
            return response()->json(['message' => 'Cette demande ne peut pas être approuvée.'], 422);
        }

        $request->validate(['commentaire' => 'nullable|string|max:1000']);
        $user      = $request->user();
        $oldStatut = $demande->statut;

        $demande->update([
            'statut'               => Demande::STATUT_ATTENTE_STOCK,
            'id_responsable_dept'  => $user->id,
            'date_validation_dept' => now(),
            'commentaire'          => $request->commentaire ?? $demande->commentaire,
        ]);

        // AUDIT
        $this->audit->log($user->id, 'demandes', 'UPDATE', "Approbation département → transmission stock (demande #{$demande->id_demande})", "demande#{$demande->id_demande}", [[
            'champs_modifie' => 'statut',
            'ancien_valeur'  => $oldStatut,
            'nouveau_valeur' => Demande::STATUT_ATTENTE_STOCK,
            'info_detail'    => "demande#{$demande->id_demande}",
            'commentaire'    => $request->commentaire ?? null,
        ]]);

        // ── NOTIFICATION B ────────────────────────────────────────────────────
        $this->notif->onDemandeApprouvee(
            demandeId: $demande->id_demande,
            demandeurId: $demande->id_demandeur,
            deptManagerName: "{$user->prenom} {$user->nom}"
        );

        return response()->json([
            'message' => 'Demande transmise au responsable stock.',
            'demande' => $this->format($demande->fresh(['demandeur.departement', 'details.Produit'])),
        ]);
    }

    // ── C) REFUSER DEPT ───────────────────────────────────────────────────────
    // NOTIFICATION: Notify employee with reason
    public function refuserDept(Request $request, Demande $demande)
    {
        if ($demande->statut !== Demande::STATUT_ATTENTE_DEPT) {
            return response()->json(['message' => 'Cette demande ne peut pas être refusée.'], 422);
        }

        $request->validate(['commentaire' => 'required|string|max:1000']);
        $user      = $request->user();
        $oldStatut = $demande->statut;

        $demande->update([
            'statut'               => Demande::STATUT_REFUSEE_DEPT,
            'id_responsable_dept'  => $user->id,
            'date_validation_dept' => now(),
            'commentaire'          => $request->commentaire,
        ]);

        // AUDIT
        $this->audit->log($user->id, 'demandes', 'UPDATE', "Refus département (demande #{$demande->id_demande})", "demande#{$demande->id_demande}", [[
            'champs_modifie' => 'statut',
            'ancien_valeur'  => $oldStatut,
            'nouveau_valeur' => Demande::STATUT_REFUSEE_DEPT,
            'info_detail'    => "demande#{$demande->id_demande}",
            'commentaire'    => $request->commentaire,
        ]]);

        // ── NOTIFICATION C ────────────────────────────────────────────────────
        $this->notif->onDemandeRefusee(
            demandeId: $demande->id_demande,
            demandeurId: $demande->id_demandeur,
            deptManagerName: "{$user->prenom} {$user->nom}",
            commentaire: $request->commentaire
        );

        return response()->json([
            'message' => 'Demande refusée.',
            'demande' => $this->format($demande->fresh(['demandeur.departement', 'details.Produit'])),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────

    public function format(Demande $d): array
    {
        return [
            'id_demande'            => $d->id_demande,
            'date_demande'          => $d->date_demande?->format('Y-m-d H:i'),
            'statut'                => $d->statut,
            'commentaire'           => $d->commentaire,
            'id_demandeur'          => $d->id_demandeur,
            'demandeur_nom'         => $d->demandeur?->nom,
            'demandeur_prenom'      => $d->demandeur?->prenom,
            'demandeur'             => $d->demandeur ? [
                'id'          => $d->demandeur->id,
                'nom'         => $d->demandeur->nom,
                'prenom'      => $d->demandeur->prenom,
                'departement' => $d->demandeur->departement ? ['nom' => $d->demandeur->departement->nom] : null,
            ] : null,
            'departement_nom'       => $d->demandeur?->departement?->nom ?? '—',
            'date_validation_dept'  => $d->date_validation_dept?->format('Y-m-d H:i'),
            'date_validation_stock' => $d->date_validation_stock?->format('Y-m-d H:i'),
            'responsable_dept'      => $d->responsableDept  ? "{$d->responsableDept->prenom} {$d->responsableDept->nom}"   : null,
            'responsable_stock'     => $d->responsableStock ? "{$d->responsableStock->prenom} {$d->responsableStock->nom}" : null,
            'details' => $d->details->map(fn($det) => [
                'id_detail'      => $det->id_detail,
                'id_produit'     => $det->id_produit,
                'Produit_nom'    => $det->Produit?->nom_produit,
                'nom'            => $det->Produit?->nom_produit,
                'reference'      => $det->Produit?->reference,
                'quantite'       => $det->quantite,
                'quantite_dispo' => $det->Produit?->quantite ?? 0,
                'statut'         => $det->statut,
                'commentaire'    => $det->commentaire,
            ])->toArray(),
        ];
    }

    public function adminIndex(Request $request)
    {
        $query = Demande::with(['details.Produit', 'demandeur.departement', 'responsableDept', 'responsableStock'])
            ->orderByDesc('date_demande');

        if ($request->filled('statut')) {
            $query->where('statut', $request->query('statut'));
        }

        $perPage = (int) $request->query('per_page', 30);
        return response()->json($query->paginate($perPage)->through(fn($d) => $this->format($d)));
    }
}
