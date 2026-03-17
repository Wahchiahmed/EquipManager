<?php

namespace App\Http\Controllers;

use App\Models\Demande;
use App\Models\DetailDemande;
use App\Models\Produit;
use App\Models\MouvementStock;
use App\Models\ProduitLot;
use App\Models\Stock;
use App\Models\User;
use App\Services\AuditService;
use App\Services\FifoStockService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    public function __construct(
        private AuditService        $audit,
        private FifoStockService    $fifo,
        private NotificationService $notif,
    ) {}

    // =========================================================================
    // HELPERS — produits assignés au gestionnaire connecté
    // =========================================================================

    /**
     * IDs des produits dont ce gestionnaire est responsable.
     * Si aucun produit assigné → collection vide (il ne verra rien).
     */
    private function mesProduitsIds(int $userId): \Illuminate\Support\Collection
    {
        return Stock::forGestionnaire($userId)->pluck('id_produit');
    }

    // =========================================================================
    // STATS
    // =========================================================================

    public function stats(Request $request)
    {
        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        $totalproduits   = Produit::where('is_active', true)
                                  ->whereIn('id_produit', $mesProduitsIds)
                                  ->count();

        $alertproduits   = Produit::where('is_active', true)
                                  ->whereIn('id_produit', $mesProduitsIds)
                                  ->whereColumn('quantite', '<=', 'seuil_alerte')
                                  ->count();

        $stockPending    = Demande::where('statut', Demande::STATUT_ATTENTE_STOCK)
                                  ->whereHas('details', fn($q) =>
                                      $q->whereIn('id_produit', $mesProduitsIds)
                                        ->where('statut', DetailDemande::STATUT_EN_ATTENTE)
                                  )
                                  ->count();

        $totalMouvements = MouvementStock::whereIn('id_produit', $mesProduitsIds)->count();

        $parMois = MouvementStock::selectRaw("
                MONTH(created_at) as mois,
                type_mouvement,
                SUM(quantite_mouvement) as total
            ")
            ->whereIn('id_produit', $mesProduitsIds)
            ->whereYear('created_at', now()->year)
            ->groupBy('mois', 'type_mouvement')
            ->orderBy('mois')
            ->get()
            ->groupBy('mois')
            ->map(fn($g) => [
                'mois'    => $g->first()->mois,
                'entrees' => $g->where('type_mouvement', 'IN')->sum('total'),
                'sorties' => $g->where('type_mouvement', 'OUT')->sum('total'),
            ])
            ->values();

        return response()->json([
            'a_valider'        => $stockPending,
            'total_produits'   => $totalproduits,
            'alertes'          => $alertproduits,
            'total_mouvements' => $totalMouvements,
            'par_mois'         => $parMois,
        ]);
    }

    // =========================================================================
    // LIST DEMANDES — filtrées aux produits du gestionnaire
    // =========================================================================

    public function indexDemandes(Request $request)
    {
        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        // Une demande n'est visible que si elle contient au moins une ligne
        // dont le produit est assigné à CE gestionnaire ET encore en attente
        // (ou déjà traitée par lui — on garde toutes les demandes qui le concernent).
        $query = Demande::with([
            'demandeur:id,nom,prenom,email,departement_id',
            'demandeur.departement:id,nom',
            'details.Produit:id_produit,nom_produit,reference,quantite',
            'responsableDept:id,nom,prenom',
            'responsableStock:id,nom,prenom',
        ])
        ->whereHas('details', fn($q) =>
            $q->whereIn('id_produit', $mesProduitsIds)
        );

        if ($request->filled('statut')) {
            $query->where('statut', $request->query('statut'));
        } else {
            $query->whereIn('statut', [
                Demande::STATUT_ATTENTE_STOCK,
                Demande::STATUT_VALIDEE,
                Demande::STATUT_PARTIELLE,
                Demande::STATUT_REFUSEE_STOCK,
                Demande::STATUT_LIVREE,
            ]);
        }

        return response()->json(
            $query->orderByDesc('updated_at')
                ->get()
                ->map(fn($d) => $this->formatDemande($d, $mesProduitsIds))
        );
    }

    // =========================================================================
    // PRODUITS — uniquement ceux assignés au gestionnaire
    // =========================================================================

    public function indexproduits(Request $request)
    {
        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        $produits = Produit::with('categorie:id_categorie,nom_categorie')
            ->where('is_active', true)
            ->whereIn('id_produit', $mesProduitsIds)
            ->orderBy('nom_produit')
            ->get()
            ->map(fn($p) => [
                'id'            => $p->id_produit,
                'nom'           => $p->nom_produit,
                'description'   => $p->description,
                'reference'     => $p->reference,
                'quantite'      => $p->quantite,
                'seuil_alerte'  => $p->seuil_alerte,
                'categorie_nom' => $p->categorie?->nom_categorie,
                'en_alerte'     => $p->quantite <= $p->seuil_alerte,
            ]);

        return response()->json($produits);
    }

    // =========================================================================
    // STOCK ENTRY — vérifie que le produit appartient au gestionnaire
    // =========================================================================

    public function entreeStock(Request $request)
    {
        $validated = $request->validate([
            'id_produit'      => 'required|exists:produits,id_produit',
            'quantite'        => 'required|integer|min:1',
            'note'            => 'nullable|string|max:300',
            'numero_lot'      => 'nullable|string|max:100',
            'date_expiration' => 'nullable|date|after:today',
        ]);

        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        if (!$mesProduitsIds->contains($validated['id_produit'])) {
            return response()->json([
                'message' => 'Ce produit ne vous est pas assigné.',
            ], 403);
        }

        return DB::transaction(function () use ($validated, $request, $user) {
            $produit = Produit::lockForUpdate()->where('id_produit', $validated['id_produit'])->firstOrFail();
            $avant   = $produit->quantite;

            $produit->increment('quantite', $validated['quantite']);

            $mouvement = MouvementStock::create([
                'id_produit'         => $produit->id_produit,
                'id_demande'         => null,
                'date_mouvement'     => now(),
                'type_mouvement'     => 'IN',
                'quantite_mouvement' => $validated['quantite'],
                'quantite_avant'     => $avant,
                'quantite_apres'     => $avant + $validated['quantite'],
                'id_user'            => $user->id,
                'note'               => $validated['note'] ?? 'Entrée manuelle',
            ]);

            $lot = $this->fifo->createLot(
                produitId:      $produit->id_produit,
                quantite:       $validated['quantite'],
                mouvementId:    $mouvement->id,
                numeroLot:      $validated['numero_lot']      ?? null,
                dateExpiration: $validated['date_expiration'] ?? null,
                note:           $validated['note']            ?? null,
                userId:         (int) $user->id,
            );

            $this->audit->log(
                (int) $user->id,
                'produits',
                'UPDATE',
                "Entrée stock — Produit #{$produit->id_produit}",
                "produit#{$produit->id_produit}",
                [
                    ['champs_modifie' => 'produits.quantite',     'ancien_valeur' => (string) $avant, 'nouveau_valeur' => (string) ($avant + $validated['quantite']), 'info_detail' => "produit#{$produit->id_produit}", 'commentaire' => $mouvement->note],
                    ['champs_modifie' => 'mouvements_stock',      'ancien_valeur' => null, 'nouveau_valeur' => "IN qty={$validated['quantite']} avant={$avant} apres=" . ($avant + $validated['quantite']), 'info_detail' => "mouvement#{$mouvement->id} produit#{$produit->id_produit}", 'commentaire' => $mouvement->note],
                    ['champs_modifie' => 'produit_lots.creation', 'ancien_valeur' => null, 'nouveau_valeur' => "lot#{$lot->id_lot} numero={$lot->numero_lot} qty={$validated['quantite']}", 'info_detail' => "lot#{$lot->id_lot} produit#{$produit->id_produit}", 'commentaire' => null],
                ]
            );

            return response()->json([
                'message'   => 'Stock mis à jour avec succès.',
                'produit'   => ['id' => $produit->id_produit, 'nom' => $produit->nom_produit, 'quantite' => $produit->quantite],
                'mouvement' => $mouvement,
                'lot'       => $this->formatLot($lot),
            ], 201);
        });
    }

    // =========================================================================
    // VALIDATE LINES — skip les lignes dont les produits ne sont pas assignés
    // =========================================================================

    public function validerLignes(Request $request, Demande $demande)
    {
        if ($demande->statut !== Demande::STATUT_ATTENTE_STOCK) {
            return response()->json([
                'message' => 'Cette demande ne peut plus être modifiée (statut : ' . $demande->statut . ').',
            ], 422);
        }

        $request->validate([
            'lignes'                     => 'required|array|min:1',
            'lignes.*.id_detail'         => 'required|integer|exists:detail_demandes,id_detail',
            'lignes.*.statut'            => 'required|in:accepte,refuse',
            'lignes.*.commentaire_stock' => 'nullable|string|max:500',
        ]);

        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        // Vérifier que la demande concerne au moins un produit de ce gestionnaire
        $demande->load('details');
        $lignesConcernees = $demande->details->whereIn('id_produit', $mesProduitsIds->toArray());

        if ($lignesConcernees->isEmpty()) {
            return response()->json([
                'message' => 'Aucune ligne de cette demande ne vous est assignée.',
            ], 403);
        }

        $resolvedStatut = null;
        $acceptees      = 0;
        $refusees       = 0;

        DB::transaction(function () use ($request, $demande, $mesProduitsIds, $user, &$resolvedStatut, &$acceptees, &$refusees) {
            $detailsAudit = [];

            foreach ($request->lignes as $ligne) {

                /** @var DetailDemande $detail */
                $detail = DetailDemande::where('id_detail', $ligne['id_detail'])
                    ->where('id_demande', $demande->id_demande)
                    ->firstOrFail();

                // ── SKIP si ce produit n'est pas assigné à ce gestionnaire ──
                if (!$mesProduitsIds->contains($detail->id_produit)) {
                    continue;
                }

                if ($detail->statut !== DetailDemande::STATUT_EN_ATTENTE) {
                    continue;
                }

                $requestedStatut = $ligne['statut'];
                $finalStatut     = $requestedStatut;
                $finalComment    = $ligne['commentaire_stock'] ?? null;

                // ── FIFO OUT when line is accepted ────────────────────────────
                if ($requestedStatut === DetailDemande::STATUT_ACCEPTE) {

                    $produit = Produit::lockForUpdate()
                        ->where('id_produit', $detail->id_produit)
                        ->first();

                    if (!$produit) {
                        $finalStatut  = DetailDemande::STATUT_REFUSE;
                        $finalComment = $this->appendComment($finalComment, 'Produit introuvable');
                    } else {
                        $avant = $produit->quantite;

                        $mouvement = MouvementStock::create([
                            'id_produit'         => $produit->id_produit,
                            'id_demande'         => $demande->id_demande,
                            'date_mouvement'     => now(),
                            'type_mouvement'     => 'OUT',
                            'quantite_mouvement' => $detail->quantite,
                            'quantite_avant'     => $avant,
                            'quantite_apres'     => $avant - $detail->quantite,
                            'id_user'            => $user->id,
                            'note'               => "Sortie FIFO — demande #{$demande->id_demande} ligne #{$detail->id_detail}",
                        ]);

                        $fifoResult = $this->fifo->consume(
                            produitId:        $produit->id_produit,
                            quantiteDemandee: $detail->quantite,
                            mouvementId:      $mouvement->id,
                            demandeId:        $demande->id_demande,
                            detailDemandeId:  $detail->id_detail,
                            userId:           (int) $user->id,
                        );

                        if (!$fifoResult->success) {
                            $mouvement->delete();
                            $finalStatut  = DetailDemande::STATUT_REFUSE;
                            $finalComment = $this->appendComment($finalComment, 'Stock insuffisant (FIFO)');
                            $detailsAudit[] = ['champs_modifie' => 'audit.fifo.auto_refuse', 'ancien_valeur' => null, 'nouveau_valeur' => 'AUTO_REFUSE_STOCK_INSUFFISANT', 'info_detail' => "demande#{$demande->id_demande} ligne#{$detail->id_detail} produit#{$detail->id_produit}", 'commentaire' => $fifoResult->raison];
                        } else {
                            $apres = $produit->fresh()->quantite;
                            $mouvement->update(['quantite_apres' => $apres]);
                            $detailsAudit[] = ['champs_modifie' => 'produits.quantite',  'ancien_valeur' => (string) $avant, 'nouveau_valeur' => (string) $apres, 'info_detail' => "produit#{$produit->id_produit} via demande#{$demande->id_demande} ligne#{$detail->id_detail}", 'commentaire' => "Sortie FIFO — lots: " . $fifoResult->lotsResume()];
                            $detailsAudit[] = ['champs_modifie' => 'mouvements_stock',   'ancien_valeur' => null, 'nouveau_valeur' => "OUT qty={$detail->quantite} avant={$avant} apres={$apres}", 'info_detail' => "mouvement#{$mouvement->id} produit#{$produit->id_produit}", 'commentaire' => $mouvement->note];
                        }
                    }
                }

                $oldStatut           = $detail->statut;
                $oldCommentaireStock = $detail->commentaire_stock;
                $detail->update(['statut' => $finalStatut, 'commentaire_stock' => $finalComment]);

                if ($oldStatut !== $finalStatut) {
                    $detailsAudit[] = ['champs_modifie' => 'detail_demandes.statut', 'ancien_valeur' => $oldStatut, 'nouveau_valeur' => $finalStatut, 'info_detail' => "demande#{$demande->id_demande} ligne#{$detail->id_detail} produit#{$detail->id_produit}", 'commentaire' => $finalComment];
                }
                if (($oldCommentaireStock ?? '') !== ($finalComment ?? '')) {
                    $detailsAudit[] = ['champs_modifie' => 'detail_demandes.commentaire_stock', 'ancien_valeur' => $oldCommentaireStock, 'nouveau_valeur' => $finalComment, 'info_detail' => "demande#{$demande->id_demande} ligne#{$detail->id_detail}", 'commentaire' => null];
                }
            }

            $this->recalculerStatut($demande, (int) $user->id, $detailsAudit);

            if (!empty($detailsAudit)) {
                $this->audit->log((int) $user->id, 'demandes', 'UPDATE', "Traitement stock FIFO — demande #{$demande->id_demande}", "demande#{$demande->id_demande}", $detailsAudit);
            }

            $demande->refresh();
            if ($demande->statut !== Demande::STATUT_ATTENTE_STOCK) {
                $resolvedStatut = $demande->statut;
                $demande->load('details', 'demandeur.departement');
                $acceptees = $demande->details->where('statut', DetailDemande::STATUT_ACCEPTE)->count();
                $refusees  = $demande->details->where('statut', DetailDemande::STATUT_REFUSE)->count();

                $this->notif->onDemandeTraiteeStock(
                    demandeId:    $demande->id_demande,
                    demandeurId:  $demande->id_demandeur,
                    departementId: $demande->demandeur?->departement_id ?? 0,
                    finalStatut:  $resolvedStatut,
                    acceptees:    $acceptees,
                    refusees:     $refusees,
                    notifyDept:   true
                );
            }
        });

        $mesProduitsIds = $this->mesProduitsIds($user->id);

        return response()->json([
            'message' => 'Lignes traitées avec succès (FIFO).',
            'demande' => $this->formatDemande(
                $demande->fresh(['demandeur.departement', 'details.Produit', 'responsableDept', 'responsableStock']),
                $mesProduitsIds
            ),
        ]);
    }

    // =========================================================================
    // SHORTCUTS
    // =========================================================================

    public function approuver(Request $request, Demande $demande)
    {
        if ($demande->statut !== Demande::STATUT_ATTENTE_STOCK) {
            return response()->json(['message' => 'Cette demande ne peut pas être approuvée.'], 422);
        }
        $request->validate(['commentaire' => 'nullable|string|max:500']);

        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        // Seulement les lignes assignées à ce gestionnaire ET encore en attente
        $lignes = $demande->details()
            ->where('statut', DetailDemande::STATUT_EN_ATTENTE)
            ->whereIn('id_produit', $mesProduitsIds)
            ->get()
            ->map(fn($d) => ['id_detail' => $d->id_detail, 'statut' => DetailDemande::STATUT_ACCEPTE, 'commentaire_stock' => $request->commentaire ?? null])
            ->toArray();

        if (empty($lignes)) return response()->json(['message' => 'Aucune ligne à traiter pour vos produits.'], 422);

        $request->merge(['lignes' => $lignes]);
        return $this->validerLignes($request, $demande);
    }

    public function refuser(Request $request, Demande $demande)
    {
        if ($demande->statut !== Demande::STATUT_ATTENTE_STOCK) {
            return response()->json(['message' => 'Cette demande ne peut pas être refusée.'], 422);
        }
        $request->validate(['commentaire' => 'required|string|max:500']);

        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        $lignes = $demande->details()
            ->where('statut', DetailDemande::STATUT_EN_ATTENTE)
            ->whereIn('id_produit', $mesProduitsIds)
            ->get()
            ->map(fn($d) => ['id_detail' => $d->id_detail, 'statut' => DetailDemande::STATUT_REFUSE, 'commentaire_stock' => $request->commentaire])
            ->toArray();

        if (empty($lignes)) return response()->json(['message' => 'Aucune ligne à traiter pour vos produits.'], 422);

        $request->merge(['lignes' => $lignes]);
        return $this->validerLignes($request, $demande);
    }

    // =========================================================================
    // MARK AS DELIVERED
    // =========================================================================

    public function marquerLivree(Request $request, Demande $demande)
    {
        if (!in_array($demande->statut, [Demande::STATUT_VALIDEE, Demande::STATUT_PARTIELLE])) {
            return response()->json(['message' => 'Seules les demandes validées peuvent être livrées.'], 422);
        }

        DB::transaction(function () use ($request, $demande) {
            $user = $request->user();
            $old  = $demande->statut;

            $demande->update(['statut' => Demande::STATUT_LIVREE]);

            $this->audit->log((int) $user->id, 'demandes', 'UPDATE', "Livraison — demande #{$demande->id_demande}", "demande#{$demande->id_demande}", [[
                'champs_modifie' => 'statut',
                'ancien_valeur'  => $old,
                'nouveau_valeur' => Demande::STATUT_LIVREE,
                'info_detail'    => "demande#{$demande->id_demande}",
                'commentaire'    => null,
            ]]);

            $demande->load('demandeur');
            $this->notif->onDemandeLivree(
                demandeId:     $demande->id_demande,
                demandeurId:   $demande->id_demandeur,
                departementId: $demande->demandeur?->departement_id ?? 0,
                notifyDept:    true
            );
        });

        return response()->json([
            'message' => 'Demande marquée comme livrée.',
            'demande' => $this->formatDemande($demande->fresh(['demandeur', 'details.Produit'])),
        ]);
    }

    // =========================================================================
    // ADMIN — ASSIGNER / DÉSASSIGNER un gestionnaire à un produit
    // POST   /api/admin/stocks/assigner
    // DELETE /api/admin/stocks/desassigner
    // GET    /api/admin/stocks                     — liste toutes les assignations
    // GET    /api/admin/produits/{produit}/gestionnaires
    // GET    /api/admin/gestionnaires              — liste les users responsable stock
    // =========================================================================

    public function indexAssignations(Request $request)
    {
        $assignations = Stock::with([
            'gestionnaire:id,nom,prenom,email',
            'produit:id_produit,nom_produit,reference,quantite,seuil_alerte,id_categorie',
            'produit.categorie:id_categorie,nom_categorie',
        ])->get()->map(fn($s) => [
            'id'              => $s->id,
            'gestionnaire_id' => $s->id_gestionnaire_stock,
            'gestionnaire'    => $s->gestionnaire ? [
                'id'     => $s->gestionnaire->id,
                'nom'    => $s->gestionnaire->nom,
                'prenom' => $s->gestionnaire->prenom,
                'email'  => $s->gestionnaire->email,
            ] : null,
            'produit_id'      => $s->id_produit,
            'produit'         => $s->produit ? [
                'id_produit'    => $s->produit->id_produit,
                'nom_produit'   => $s->produit->nom_produit,
                'reference'     => $s->produit->reference,
                'quantite'      => $s->produit->quantite,
                'seuil_alerte'  => $s->produit->seuil_alerte,
                'categorie_nom' => $s->produit->categorie?->nom_categorie,
            ] : null,
        ]);

        return response()->json($assignations);
    }

    public function indexGestionnaires()
    {
        $gestionnaires = User::where('role_id', 4)
            ->where('is_active', true)
            ->get(['id', 'nom', 'prenom', 'email'])
            ->map(fn($u) => [
                'id'     => $u->id,
                'nom'    => $u->nom,
                'prenom' => $u->prenom,
                'email'  => $u->email,
                'nb_produits' => Stock::forGestionnaire($u->id)->count(),
            ]);

        return response()->json($gestionnaires);
    }

    public function gestionnairesParProduit(Produit $produit)
    {
        $gestionnaires = Stock::forProduit($produit->id_produit)
            ->with('gestionnaire:id,nom,prenom,email')
            ->get()
            ->map(fn($s) => [
                'stock_id'        => $s->id,
                'gestionnaire_id' => $s->id_gestionnaire_stock,
                'nom'             => $s->gestionnaire?->nom,
                'prenom'          => $s->gestionnaire?->prenom,
                'email'           => $s->gestionnaire?->email,
            ]);

        return response()->json($gestionnaires);
    }

    public function assigner(Request $request)
    {
        $request->validate([
            'id_produit'           => 'required|exists:produits,id_produit',
            'id_gestionnaire_stock' => 'required|exists:users,id',
        ]);

        // Vérifie que l'utilisateur a bien le rôle responsable stock
        $gestionnaire = User::findOrFail($request->id_gestionnaire_stock);
        if (!$gestionnaire->isRespStock()) {
            return response()->json(['message' => "Cet utilisateur n'est pas responsable stock."], 422);
        }

        $stock = Stock::firstOrCreate([
            'id_produit'            => $request->id_produit,
            'id_gestionnaire_stock' => $request->id_gestionnaire_stock,
        ]);

        if (!$stock->wasRecentlyCreated) {
            return response()->json(['message' => 'Cette assignation existe déjà.'], 409);
        }

        return response()->json([
            'message' => 'Gestionnaire assigné au produit.',
            'stock'   => $stock->load(['gestionnaire:id,nom,prenom,email', 'produit:id_produit,nom_produit']),
        ], 201);
    }

    public function desassigner(Request $request)
    {
        $request->validate([
            'id_produit'            => 'required|exists:produits,id_produit',
            'id_gestionnaire_stock' => 'required|exists:users,id',
        ]);

        $deleted = Stock::where('id_produit', $request->id_produit)
            ->where('id_gestionnaire_stock', $request->id_gestionnaire_stock)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Assignation introuvable.'], 404);
        }

        return response()->json(['message' => 'Gestionnaire désassigné du produit.']);
    }

    // =========================================================================
    // LOTS ENDPOINTS
    // =========================================================================

    public function indexLots(Request $request)
    {
        $query = ProduitLot::with(['produit:id_produit,nom_produit,reference'])
            ->orderBy('date_entree', 'desc');

        if ($request->filled('statut'))     $query->where('statut', $request->query('statut'));
        if ($request->filled('produit_id')) $query->where('id_produit', (int) $request->query('produit_id'));
        if ($request->filled('q'))          $query->where('numero_lot', 'like', "%{$request->query('q')}%");

        return response()->json(
            $query->paginate((int) $request->query('per_page', 30))
                ->through(fn($l) => $this->formatLot($l))
        );
    }

    public function lotsParProduit(Produit $produit)
    {
        $lots = $produit->lots()
            ->orderBy('date_entree', 'asc')
            ->get()
            ->map(fn($l) => $this->formatLot($l));

        return response()->json([
            'produit'          => ['id_produit' => $produit->id_produit, 'nom_produit' => $produit->nom_produit, 'reference' => $produit->reference, 'quantite' => $produit->quantite],
            'lots'             => $lots,
            'total_lots'       => $lots->count(),
            'lots_actifs'      => $lots->where('statut', ProduitLot::STATUT_ACTIF)->count(),
            'lots_epuises'     => $lots->where('statut', ProduitLot::STATUT_EPUISE)->count(),
            'stock_disponible' => $lots->where('statut', ProduitLot::STATUT_ACTIF)->sum('quantite_restante'),
        ]);
    }

    public function checkAlertes(Request $request)
    {
        $user           = $request->user();
        $mesProduitsIds = $this->mesProduitsIds($user->id);

        $alerted = Produit::where('is_active', true)
            ->whereIn('id_produit', $mesProduitsIds)
            ->whereColumn('quantite', '<=', 'seuil_alerte')
            ->get();

        $count = 0;
        foreach ($alerted as $p) {
            $this->notif->onAlerteStock(ProduitId: $p->id_produit, ProduitNom: $p->nom_produit, quantite: $p->quantite, seuilAlerte: $p->seuil_alerte);
            $count++;
        }

        return response()->json(['message' => "{$count} Produit(s) en alerte vérifié(s).", 'produits_alerte' => $count]);
    }

    public function indexMouvements(Request $request)
    {
        $relations = ['produit', 'user:id,nom,prenom', 'demande:id_demande'];

        if ($request->boolean('with_lots')) {
            $relations[] = 'lotDetails.lot:id_lot,numero_lot,date_entree';
        }

        $query = MouvementStock::with($relations)->orderByDesc('created_at');

        // Pour le gestionnaire stock, filtrer par ses produits
        if ($request->user()?->isRespStock()) {
            $mesProduitsIds = $this->mesProduitsIds($request->user()->id);
            $query->whereIn('id_produit', $mesProduitsIds);
        }

        return response()->json(
            $query->paginate((int) $request->query('per_page', 30))
        );
    }

    // =========================================================================
    // LOTS PAR MOUVEMENT / DETAIL / DEMANDE
    // =========================================================================

    public function lotsParMouvement(MouvementStock $mouvement)
    {
        $details = $mouvement->lotDetails()
            ->with('lot:id_lot,numero_lot,date_entree,date_expiration')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn($d) => [
                'id' => $d->id, 'id_lot' => $d->id_lot,
                'numero_lot'         => $d->lot?->numero_lot ?? '—',
                'date_entree'        => $d->lot?->date_entree?->format('Y-m-d H:i') ?? null,
                'date_expiration'    => $d->lot?->date_expiration?->format('Y-m-d') ?? null,
                'quantite_sortie'    => $d->quantite_sortie,
                'quantite_lot_avant' => $d->quantite_lot_avant,
                'quantite_lot_apres' => $d->quantite_lot_apres,
                'id_demande'         => $d->id_demande,
                'id_mouvement'       => $d->id_mouvement,
            ]);

        return response()->json(['data' => $details]);
    }

    public function lotsParDetail(DetailDemande $detail)
    {
        $details = $detail->lotDetails()
            ->with('lot:id_lot,numero_lot,date_entree,date_expiration')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn($d) => [
                'id' => $d->id, 'id_lot' => $d->id_lot,
                'numero_lot'         => $d->lot?->numero_lot ?? '—',
                'date_entree'        => $d->lot?->date_entree?->format('Y-m-d H:i') ?? null,
                'date_expiration'    => $d->lot?->date_expiration?->format('Y-m-d') ?? null,
                'quantite_sortie'    => $d->quantite_sortie,
                'quantite_lot_avant' => $d->quantite_lot_avant,
                'quantite_lot_apres' => $d->quantite_lot_apres,
                'id_demande'         => $d->id_demande,
                'id_mouvement'       => $d->id_mouvement,
            ]);

        return response()->json(['data' => $details]);
    }

    public function lotsParDemande(Demande $demande)
    {
        $rows = collect();
        foreach ($demande->details as $detail) {
            $detail->lotDetails()
                ->with('lot:id_lot,numero_lot,date_entree,date_expiration')
                ->orderBy('created_at', 'asc')
                ->get()
                ->each(fn($d) => $rows->push([
                    'id' => $d->id, 'id_lot' => $d->id_lot,
                    'numero_lot'         => $d->lot?->numero_lot ?? '—',
                    'date_entree'        => $d->lot?->date_entree?->format('Y-m-d H:i') ?? null,
                    'date_expiration'    => $d->lot?->date_expiration?->format('Y-m-d') ?? null,
                    'quantite_sortie'    => $d->quantite_sortie,
                    'quantite_lot_avant' => $d->quantite_lot_avant,
                    'quantite_lot_apres' => $d->quantite_lot_apres,
                    'id_demande'         => $demande->id_demande,
                    'id_mouvement'       => $d->id_mouvement,
                ]));
        }
        return response()->json(['data' => $rows->values()]);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private function appendComment(?string $existing, string $addition): string
    {
        return $existing ? trim($existing . ' | ' . $addition) : $addition;
    }

    private function recalculerStatut(Demande $demande, int $userId, array &$detailsAudit = []): void
    {
        $demande->load('details');

        $total     = $demande->details->count();
        $enAttente = $demande->details->where('statut', DetailDemande::STATUT_EN_ATTENTE)->count();
        $acceptees = $demande->details->where('statut', DetailDemande::STATUT_ACCEPTE)->count();
        $refusees  = $demande->details->where('statut', DetailDemande::STATUT_REFUSE)->count();

        // S'il reste des lignes en attente (peut-être gérées par un autre gestionnaire)
        // on ne change pas encore le statut global
        if ($enAttente > 0) return;

        $oldStatut = $demande->statut;

        $nouveauStatut = match (true) {
            $acceptees === $total => Demande::STATUT_VALIDEE,
            $refusees  === $total => Demande::STATUT_REFUSEE_STOCK,
            default               => Demande::STATUT_PARTIELLE,
        };

        if ($oldStatut === $nouveauStatut) {
            $demande->update(['id_responsable_stock' => $userId, 'date_validation_stock' => now()]);
            return;
        }

        $demande->update(['statut' => $nouveauStatut, 'id_responsable_stock' => $userId, 'date_validation_stock' => now()]);

        $detailsAudit[] = ['champs_modifie' => 'demandes.statut',                'ancien_valeur' => $oldStatut,                                                   'nouveau_valeur' => $nouveauStatut,                          'info_detail' => "demande#{$demande->id_demande}", 'commentaire' => null];
        $detailsAudit[] = ['champs_modifie' => 'demandes.id_responsable_stock',  'ancien_valeur' => (string) ($demande->getOriginal('id_responsable_stock') ?? ''), 'nouveau_valeur' => (string) $userId,                        'info_detail' => "demande#{$demande->id_demande}", 'commentaire' => null];
        $detailsAudit[] = ['champs_modifie' => 'demandes.date_validation_stock', 'ancien_valeur' => (string) ($demande->getOriginal('date_validation_stock') ?? ''), 'nouveau_valeur' => (string) $demande->date_validation_stock, 'info_detail' => "demande#{$demande->id_demande}", 'commentaire' => null];
    }

    /**
     * @param \Illuminate\Support\Collection|null $mesProduitsIds
     *   Quand passé (vue gestionnaire), les détails hors-périmètre sont marqués
     *   visuellement comme "autre gestionnaire". Sinon (vue admin) tout est affiché.
     */
    private function formatDemande(Demande $d, ?\Illuminate\Support\Collection $mesProduitsIds = null): array
    {
        return [
            'id_demande'            => $d->id_demande,
            'date_demande'          => $d->date_demande?->format('Y-m-d H:i'),
            'statut'                => $d->statut,
            'commentaire'           => $d->commentaire,
            'id_demandeur'          => $d->id_demandeur,
            'demandeur'             => $d->demandeur ? [
                'id'          => $d->demandeur->id,
                'nom'         => $d->demandeur->nom,
                'prenom'      => $d->demandeur->prenom,
                'departement' => $d->demandeur->departement ? ['nom' => $d->demandeur->departement->nom] : null,
            ] : null,
            'responsable_dept'      => $d->responsableDept  ? "{$d->responsableDept->prenom} {$d->responsableDept->nom}"   : null,
            'responsable_stock'     => $d->responsableStock ? "{$d->responsableStock->prenom} {$d->responsableStock->nom}" : null,
            'date_validation_dept'  => $d->date_validation_dept?->format('Y-m-d H:i'),
            'date_validation_stock' => $d->date_validation_stock?->format('Y-m-d H:i'),
            'details'               => $d->details->map(fn($det) => [
                'id_detail'          => $det->id_detail,
                'id_produit'         => $det->id_produit,
                'nom'                => $det->Produit?->nom_produit,
                'reference'          => $det->Produit?->reference,
                'quantite'           => $det->quantite,
                'quantite_dispo'     => $det->Produit?->quantite ?? 0,
                'statut'             => $det->statut,
                'commentaire_stock'  => $det->commentaire_stock,
                // true = ce gestionnaire peut traiter cette ligne
                // null = pas de filtre (vue admin)
                'ma_responsabilite'  => $mesProduitsIds
                    ? $mesProduitsIds->contains($det->id_produit)
                    : null,
            ])->toArray(),
        ];
    }

    private function formatLot(ProduitLot $l): array
    {
        return [
            'id_lot'              => $l->id_lot,
            'id_produit'          => $l->id_produit,
            'produit_nom'         => $l->produit?->nom_produit ?? '—',
            'produit_reference'   => $l->produit?->reference   ?? null,
            'numero_lot'          => $l->numero_lot,
            'date_entree'         => $l->date_entree?->format('Y-m-d H:i'),
            'date_expiration'     => $l->date_expiration?->format('Y-m-d'),
            'quantite_initiale'   => $l->quantite_initiale,
            'quantite_restante'   => $l->quantite_restante,
            'quantite_consommee'  => $l->quantite_initiale - $l->quantite_restante,
            'pourcentage_utilise' => $l->quantite_initiale > 0
                ? round((($l->quantite_initiale - $l->quantite_restante) / $l->quantite_initiale) * 100, 1)
                : 0,
            'statut' => $l->statut,
            'note'   => $l->note,
        ];
    }
}