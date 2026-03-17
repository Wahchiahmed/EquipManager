<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use App\Models\Departement;
use App\Models\Demande;
use App\Models\MouvementStock;
use Illuminate\Support\Facades\DB;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function __construct(private AuditService $audit) {}

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/users
    // ─────────────────────────────────────────────────────────────────────────
    public function index()
    {
        $users = User::with('role', 'departement')
            ->get()
            ->map(fn($u) => $this->formatUser($u));

        return response()->json($users);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/users
    // ─────────────────────────────────────────────────────────────────────────
    public function store(Request $request)
    {
        $request->validate([
            'nom'            => 'required|string|max:255',
            'prenom'         => 'required|string|max:255',
            'email'          => 'required|email|unique:users,email',
            'password'       => 'required|string|min:6',
            'role_id'        => 'required|exists:roles,id',
            'departement_id' => 'nullable|exists:departements,id',
            'telephone'      => 'nullable|string|max:20',
        ]);

        $user = User::create([
            'nom'            => $request->nom,
            'prenom'         => $request->prenom,
            'email'          => $request->email,
            'password'       => Hash::make($request->password),
            'role_id'        => $request->role_id,
            'departement_id' => $request->departement_id,
            'telephone'      => $request->telephone,
            'is_active'      => true,
        ]);

        $user->load('role', 'departement');

        // ── Audit : création d'utilisateur ────────────────────────────────
        $this->audit->log(
            userId:         $request->user()->id,
            tableModifiee:  'users',
            typeAction:     'INSERT',
            description:    "Création de l'utilisateur {$user->prenom} {$user->nom} ({$user->email})",
            referenceObjet: "user#{$user->id}",
            details: [
                [
                    'champs_modifie' => 'nom',
                    'ancien_valeur'  => null,
                    'nouveau_valeur' => $user->nom,
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Ajout champ',
                ],
                [
                    'champs_modifie' => 'prenom',
                    'ancien_valeur'  => null,
                    'nouveau_valeur' => $user->prenom,
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Ajout champ',
                ],
                [
                    'champs_modifie' => 'email',
                    'ancien_valeur'  => null,
                    'nouveau_valeur' => $user->email,
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Ajout champ',
                ],
                [
                    'champs_modifie' => 'role',
                    'ancien_valeur'  => null,
                    'nouveau_valeur' => $user->role->nom ?? $user->role_id,
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Ajout champ',
                ],
                [
                    'champs_modifie' => 'departement',
                    'ancien_valeur'  => null,
                    'nouveau_valeur' => $user->departement?->nom ?? '—',
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Ajout champ',
                ],
            ]
        );

        return response()->json($this->formatUser($user), 201);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/users/{user}
    // ─────────────────────────────────────────────────────────────────────────
    public function show(User $user)
    {
        return response()->json($this->formatUser($user->load('role', 'departement')));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT/PATCH /api/users/{user}
    // ─────────────────────────────────────────────────────────────────────────
    public function update(Request $request, User $user)
    {
        $request->validate([
            'nom'            => 'sometimes|string|max:255',
            'prenom'         => 'sometimes|string|max:255',
            'email'          => 'sometimes|email|unique:users,email,' . $user->id,
            'password'       => 'sometimes|string|min:6',
            'role_id'        => 'sometimes|exists:roles,id',
            'departement_id' => 'nullable|exists:departements,id',
            'telephone'      => 'nullable|string|max:20',
        ]);

        // ── Snapshot avant modification ───────────────────────────────────
        $user->load('role', 'departement');

        $before = [
            'nom'           => $user->nom,
            'prenom'        => $user->prenom,
            'email'         => $user->email,
            'telephone'     => $user->telephone,
            'role'          => $user->role->nom ?? (string) $user->role_id,
            'departement'   => $user->departement?->nom ?? '—',
        ];

        // ── Appliquer les changements ─────────────────────────────────────
        $data = $request->except('password');
        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }
        $user->update($data);
        $user->load('role', 'departement');

        // ── Construire les détails diff ───────────────────────────────────
        $after = [
            'nom'         => $user->nom,
            'prenom'      => $user->prenom,
            'email'       => $user->email,
            'telephone'   => $user->telephone,
            'role'        => $user->role->nom ?? (string) $user->role_id,
            'departement' => $user->departement?->nom ?? '—',
        ];

        $details = [];

        foreach ($after as $champ => $nouvelleValeur) {
            $ancienneValeur = $before[$champ];
            if ((string) $ancienneValeur !== (string) $nouvelleValeur) {
                $details[] = [
                    'champs_modifie' => $champ,
                    'ancien_valeur'  => $ancienneValeur,
                    'nouveau_valeur' => $nouvelleValeur,
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Mise à jour',
                ];
            }
        }

        // Mot de passe changé → on le note sans révéler les valeurs
        if ($request->filled('password')) {
            $details[] = [
                'champs_modifie' => 'password',
                'ancien_valeur'  => '***',
                'nouveau_valeur' => '***',
                'info_detail'    => "user#{$user->id}",
                'commentaire'    => 'Mot de passe modifié',
            ];
        }

        if (!empty($details)) {
            $this->audit->log(
                userId:         $request->user()->id,
                tableModifiee:  'users',
                typeAction:     'UPDATE',
                description:    "Modification de l'utilisateur {$user->prenom} {$user->nom} (#{$user->id})",
                referenceObjet: "user#{$user->id}",
                details:        $details
            );
        }

        return response()->json($this->formatUser($user));
    }

    // ─────────────────────────────────────────────────────────────────────────
// DELETE /api/users/{user}
// ─────────────────────────────────────────────────────────────────────────
public function destroy(Request $request, User $user)
{
    if ($request->user()->id === $user->id) {
        return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 403);
    }

    $user->load('role', 'departement');
    $userId   = $user->id;
    $fullName = "{$user->prenom} {$user->nom}";

    $demandesAnnulees = collect();

    DB::transaction(function () use ($user, $userId, $fullName, $request, &$demandesAnnulees) {

        // ── 1. Annuler les demandes non encore traitées par le stock ──────
        $demandesAnnulees = Demande::where('id_demandeur', $userId)
            ->whereIn('statut', [
                Demande::STATUT_ATTENTE_DEPT,
                Demande::STATUT_ATTENTE_STOCK,
            ])
            ->get();

        foreach ($demandesAnnulees as $demande) {
            $oldStatut = $demande->statut;
            $demande->update([
                'statut'      => 'ANNULEE',
                'commentaire' => "Annulée automatiquement suite à la suppression du compte de {$fullName}.",
            ]);

            $this->audit->log(
                userId:         $request->user()->id,
                tableModifiee:  'demandes',
                typeAction:     'UPDATE',
                description:    "Annulation automatique demande #{$demande->id_demande} — suppression utilisateur {$fullName}",
                referenceObjet: "demande#{$demande->id_demande}",
                details: [[
                    'champs_modifie' => 'statut',
                    'ancien_valeur'  => $oldStatut,
                    'nouveau_valeur' => 'ANNULEE',
                    'info_detail'    => "demande#{$demande->id_demande}",
                    'commentaire'    => "Suppression compte user#{$userId}",
                ]]
            );
        }

        // ── 2. Nullifier historiques ──────────────────────────────────────
        \App\Models\Historique::where('id_utilisateur', $userId)
            ->update(['id_utilisateur' => null]);

        // ── 3. Nullifier mouvements_stock ─────────────────────────────────
        \App\Models\MouvementStock::where('id_user', $userId)
            ->update(['id_user' => null]);

        // ── 4. Nullifier responsables dans demandes ───────────────────────
        Demande::where('id_responsable_dept', $userId)
            ->update(['id_responsable_dept' => null]);
        Demande::where('id_responsable_stock', $userId)
            ->update(['id_responsable_stock' => null]);

        // ── 5. Supprimer les notifications ────────────────────────────────
        if (method_exists($user, 'notifications')) {
            \App\Models\Notification::where('recipient_user_id', $userId)->delete();
        }

        // ── 6. Nullifier responsable_id dans departements ─────────────────
        if (\Illuminate\Support\Facades\Schema::hasColumn('departements', 'responsable_id')) {
            \App\Models\Departement::where('responsable_id', $userId)
                ->update(['responsable_id' => null]);
        }

        // ── 7. Nullifier gestionnaire dans stocks ─────────────────────────
        foreach (['stocks', 'stock_assignations', 'produit_gestionnaire'] as $table) {
            if (\Illuminate\Support\Facades\Schema::hasTable($table)) {
                \Illuminate\Support\Facades\DB::table($table)
                    ->where('id_gestionnaire_stock', $userId)
                    ->update(['id_gestionnaire_stock' => null]);
            }
        }

        // ── 8. Audit suppression utilisateur ─────────────────────────────
        $snapshot = [
            'nom'         => $user->nom,
            'prenom'      => $user->prenom,
            'email'       => $user->email,
            'role'        => $user->role->nom ?? (string) $user->role_id,
            'departement' => $user->departement?->nom ?? '—',
        ];

        $this->audit->log(
            userId:         $request->user()->id,
            tableModifiee:  'users',
            typeAction:     'DELETE',
            description:    "Suppression définitive de l'utilisateur {$fullName} (#{$userId}). {$demandesAnnulees->count()} demande(s) annulée(s).",
            referenceObjet: "user#{$userId}",
            details: array_map(fn($champ, $valeur) => [
                'champs_modifie' => $champ,
                'ancien_valeur'  => $valeur,
                'nouveau_valeur' => null,
                'info_detail'    => "user#{$userId}",
                'commentaire'    => 'Compte supprimé',
            ], array_keys($snapshot), array_values($snapshot))
        );

        // ── 9. Tokens Sanctum ─────────────────────────────────────────────
        $user->tokens()->delete();

        // ── 10. Supprimer l'utilisateur ───────────────────────────────────
        $user->delete();
    });

    return response()->json([
        'message'           => "Utilisateur {$fullName} supprimé avec succès.",
        'demandes_annulees' => $demandesAnnulees->count(),
    ]);
}

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/users/{user}/toggle-active
    // ─────────────────────────────────────────────────────────────────────────
    public function toggleActive(Request $request, User $user)
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'Vous ne pouvez pas désactiver votre propre compte.'], 403);
        }

        $ancienStatut = $user->is_active;

        $user->update(['is_active' => !$user->is_active]);

        if (!$user->is_active) {
            $user->tokens()->delete();
        }

        $nouvelEtat   = $user->is_active ? 'actif' : 'inactif';
        $ancienEtat   = $ancienStatut    ? 'actif' : 'inactif';

        // ── Audit : changement de statut ──────────────────────────────────
        $this->audit->logFieldChange(
            userId:         $request->user()->id,
            tableModifiee:  'users',
            description:    $user->is_active
                                ? "Activation du compte de {$user->prenom} {$user->nom} (#{$user->id})"
                                : "Désactivation du compte de {$user->prenom} {$user->nom} (#{$user->id})",
            champ:          'is_active',
            ancien:         $ancienEtat,
            nouveau:        $nouvelEtat,
            referenceObjet: "user#{$user->id}",
            infoDetail:     "user#{$user->id}",
            commentaire:    $user->is_active ? 'Compte réactivé' : 'Compte désactivé',
        );

        return response()->json([
            'message'   => $user->is_active ? 'Utilisateur activé.' : 'Utilisateur désactivé.',
            'is_active' => $user->is_active,
            'user'      => $this->formatUser($user->load('role', 'departement')),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/users/form-data
    // ─────────────────────────────────────────────────────────────────────────
    public function formData()
    {
        return response()->json([
            'roles'        => Role::all(['id', 'nom']),
            'departements' => Departement::all(['id', 'nom']),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function formatUser(User $user): array
    {
        return [
            'id_utilisateur'  => $user->id,
            'nom'             => $user->nom,
            'prenom'          => $user->prenom,
            'email'           => $user->email,
            'telephone'       => $user->telephone,
            'is_active'       => (bool) $user->is_active,
            'role_id'         => $user->role_id,
            'role_nom'        => $this->mapRole($user->role->nom ?? ''),
            'departement_id'  => $user->departement_id,
            'departement_nom' => $user->departement?->nom ?? '—',
            'created_at'      => $user->created_at?->format('Y-m-d'),
        ];
    }

    private function mapRole(string $roleName): string
    {
        return match (strtolower(trim($roleName))) {
            'admin'                   => 'ADMIN',
            'employe'                 => 'EMPLOYEE',
            'responsable departement' => 'RESPONSABLE_DEPARTEMENT',
            'responsable stock'       => 'RESPONSABLE_STOCK',
            default                   => strtoupper(str_replace(' ', '_', $roleName)),
        };
    }
}