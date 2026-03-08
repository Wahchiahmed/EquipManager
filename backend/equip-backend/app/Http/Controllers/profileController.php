<?php

namespace App\Http\Controllers;

use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use App\Models\Historique;

class ProfileController extends Controller
{
    public function __construct(private AuditService $audit) {}

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/profile
    // ─────────────────────────────────────────────────────────────────────────
    public function show(Request $request)
    {
        $user = $request->user()->load('role', 'departement');

        $profile = $this->formatProfile($user);

        $roleNom = strtolower(trim($user->role->nom ?? ''));

        // ── Contextual role data (wrapped so one bad query can't 500 the whole page) ──
        try {
            $profile['role_data'] = match (true) {

                str_contains($roleNom, 'employe') || str_contains($roleNom, 'employee') => [
                    'type'            => 'EMPLOYEE',
                    'demandes_recent' => $this->getRecentDemandes($user->id, 5),
                    'stats'           => $this->getEmployeeStats($user->id),
                ],

                str_contains($roleNom, 'departement') => [
                    'type'          => 'RESPONSABLE_DEPARTEMENT',
                    'pending_count' => $this->getDeptPendingCount($user->departement_id),
                    'stats'         => $this->getDeptStats($user->departement_id),
                ],

                str_contains($roleNom, 'stock') => [
                    'type'              => 'RESPONSABLE_STOCK',
                    'alertes_count'     => $this->getStockAlertes(),
                    'mouvements_recent' => $this->getRecentMouvements(5),
                ],

                str_contains($roleNom, 'admin') => [
                    'type'           => 'ADMIN',
                    'total_users'    => $this->safeCount(\App\Models\User::class),
                    'total_demandes' => $this->safeCount(\App\Models\Demande::class),
                ],

                default => ['type' => 'UNKNOWN'],
            };
        } catch (\Throwable $e) {
            // Role data is cosmetic — don't let it kill the whole profile page
            \Illuminate\Support\Facades\Log::warning('ProfileController@show role_data failed', [
                'user_id' => $user->id,
                'role'    => $roleNom,
                'error'   => $e->getMessage(),
            ]);
            $profile['role_data'] = ['type' => strtoupper($roleNom), 'error' => 'Données indisponibles'];
        }

        // ── Recent activity ────────────────────────────────────────────────
        try {
            // Try with 'details' relation first; fall back to without if relation missing
            $histQuery = Historique::where('id_utilisateur', $user->id)
                ->orderByDesc('date_action')
                ->limit(10);

            // Only eager-load 'details' if the relation exists on the model
            if (method_exists(new Historique, 'details')) {
                $histQuery->with('details');
            }

            $profile['recent_activity'] = $histQuery->get()->map(fn($h) => [
                'id'              => $h->id_historique,
                'date_action'     => $h->date_action,
                'table_modifiee'  => $h->table_modifiee,
                'type_action'     => $h->type_action,
                'description'     => $h->description,
                'reference_objet' => $h->reference_objet,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('ProfileController@show recent_activity failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
            $profile['recent_activity'] = [];
        }

        return response()->json($profile);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/profile
    // ─────────────────────────────────────────────────────────────────────────
    public function update(Request $request)
    {
        $user = $request->user()->load('role', 'departement');

        $request->validate([
            'nom'       => 'sometimes|string|max:255',
            'prenom'    => 'sometimes|string|max:255',
            'telephone' => 'sometimes|nullable|string|max:20',
        ]);

        $before = [
            'nom'       => $user->nom,
            'prenom'    => $user->prenom,
            'telephone' => $user->telephone ?? '—',
        ];

        $user->update($request->only('nom', 'prenom', 'telephone'));

        $after = [
            'nom'       => $user->nom,
            'prenom'    => $user->prenom,
            'telephone' => $user->telephone ?? '—',
        ];

        $details = [];
        foreach ($after as $champ => $val) {
            if ((string)($before[$champ] ?? '') !== (string)$val) {
                $details[] = [
                    'champs_modifie' => $champ,
                    'ancien_valeur'  => $before[$champ],
                    'nouveau_valeur' => $val,
                    'info_detail'    => "user#{$user->id}",
                    'commentaire'    => 'Modifié via profil',
                ];
            }
        }

        if (!empty($details)) {
            $this->audit->log(
                userId: $user->id,
                tableModifiee: 'users',
                typeAction: 'UPDATE',
                description: "Mise à jour du profil de {$user->prenom} {$user->nom}",
                referenceObjet: "user#{$user->id}",
                details: $details
            );
        }

        return response()->json([
            'message' => 'Profil mis à jour avec succès.',
            'user'    => $this->formatProfile($user->fresh(['role', 'departement'])),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/profile/change-password
    // ─────────────────────────────────────────────────────────────────────────
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => [
                'required',
                'confirmed',
                Password::min(8)->mixedCase()->numbers()->symbols(),
            ],
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Le mot de passe actuel est incorrect.',
                'errors'  => ['current_password' => ['Mot de passe incorrect.']],
            ], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        $this->audit->logFieldChange(
            userId: $user->id,
            tableModifiee: 'users',
            description: "Changement de mot de passe — {$user->prenom} {$user->nom}",
            champ: 'password',
            ancien: '***',
            nouveau: '***',
            referenceObjet: "user#{$user->id}",
            infoDetail: "user#{$user->id}",
            commentaire: 'Modifié via profil'
        );

        return response()->json(['message' => 'Mot de passe modifié avec succès.']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/profile/logout-all
    // ─────────────────────────────────────────────────────────────────────────
    public function logoutAll(Request $request)
    {
        $user         = $request->user();
        $currentToken = $user->currentAccessToken();

        $user->tokens()
            ->where('id', '!=', $currentToken->id)
            ->delete();

        $this->audit->logFieldChange(
            userId: $user->id,
            tableModifiee: 'users',
            description: "Déconnexion de tous les appareils — {$user->prenom} {$user->nom}",
            champ: 'sessions',
            ancien: 'multiple',
            nouveau: 'single',
            referenceObjet: "user#{$user->id}",
            infoDetail: "user#{$user->id}",
            commentaire: 'Révocation sessions via profil'
        );

        return response()->json(['message' => 'Toutes les autres sessions ont été fermées.']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/profile/preferences
    // ─────────────────────────────────────────────────────────────────────────
    public function updatePreferences(Request $request)
    {
        $validated = $request->validate([
            'theme'       => 'sometimes|in:light,dark,system',
            'langue'      => 'sometimes|in:fr,en',
            'notif_email' => 'sometimes|boolean',
            'notif_inapp' => 'sometimes|boolean',
            'date_format' => 'sometimes|in:DD/MM/YYYY,MM/DD/YYYY,YYYY-MM-DD',
        ]);

        $user = $request->user();

        // Default preferences for first-time users
        $defaults = [
            'theme'       => 'system',
            'langue'      => 'fr',
            'notif_email' => true,
            'notif_inapp' => true,
            'date_format' => 'DD/MM/YYYY',
        ];

        // $user->preferences is decoded automatically via the 'array' cast in User model.
        // Falls back to defaults if null (column missing data for existing users).
        $current = is_array($user->preferences) ? $user->preferences : $defaults;
        $updated = array_merge($current, $validated);

        // Saves to the `preferences` JSON column in `users` table.
        // Requires: (1) column exists, (2) 'preferences' in $fillable, (3) cast to 'array'.
        $user->update(['preferences' => $updated]);

        $this->audit->log(
            userId: $user->id,
            tableModifiee: 'users',
            typeAction: 'UPDATE',
            description: "Mise à jour préférences — {$user->prenom} {$user->nom}",
            referenceObjet: "user#{$user->id}",
            details: [[
                'champs_modifie' => 'preferences',
                'ancien_valeur'  => json_encode($current),
                'nouveau_valeur' => json_encode($updated),
                'info_detail'    => "user#{$user->id}",
                'commentaire'    => 'Modifié via profil',
            ]]
        );

        return response()->json([
            'message'     => 'Préférences enregistrées.',
            'preferences' => $updated,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/profile/activity
    // ─────────────────────────────────────────────────────────────────────────
    public function activity(Request $request)
    {
        $activity = Historique::with('details')
            ->where('id_utilisateur', $request->user()->id)
            ->orderByDesc('date_action')
            ->paginate(20);

        return response()->json($activity);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the COMPLETE user profile array.
     * FIX: the previous version had `// ...` placeholder which caused the 500.
     */
    private function formatProfile($user): array
    {
        $prefs = $user->preferences ?? [];

        return [
            'id'              => $user->id,
            'nom'             => $user->nom,
            'prenom'          => $user->prenom,
            'email'           => $user->email,
            'telephone'       => $user->telephone ?? null,
            'is_active'       => (bool) $user->is_active,
            'role_id'         => $user->role_id,
            'role_nom'        => $user->role->nom ?? '',
            'departement_id'  => $user->departement_id,
            'departement_nom' => $user->departement->nom ?? '—',
            'created_at'      => $user->created_at?->toIso8601String(),
            'preferences'     => array_merge([
                'theme'       => 'system',
                'langue'      => 'fr',
                'notif_email' => true,
                'notif_inapp' => true,
                'date_format' => 'DD/MM/YYYY',
            ], $prefs),
        ];
    }

    private function getRecentDemandes(int $userId, int $limit): array
    {
        return \App\Models\Demande::with('details')
            ->where('id_demandeur', $userId)
            ->orderByDesc('date_demande')
            ->limit($limit)
            ->get()
            ->map(fn($d) => [
                'id'          => $d->id_demande,
                'date'        => $d->date_demande,
                'statut'      => $d->statut,
                'nb_articles' => $d->details->count(),
            ])
            ->toArray();
    }

    private function getEmployeeStats(int $userId): array
    {
        $base = \App\Models\Demande::where('id_demandeur', $userId);
        return [
            'total'    => (clone $base)->count(),
            'en_cours' => (clone $base)->whereIn('statut', ['EN_ATTENTE_DEPT', 'EN_ATTENTE_STOCK'])->count(),
            'livrees'  => (clone $base)->where('statut', 'LIVREE')->count(),
            'refusees' => (clone $base)->whereIn('statut', ['REFUSEE_DEPT', 'REFUSEE_STOCK'])->count(),
        ];
    }

    private function getDeptPendingCount(?int $deptId): int
    {
        if (!$deptId) return 0;
        return \App\Models\Demande::whereHas('demandeur', fn($q) => $q->where('departement_id', $deptId))
            ->where('statut', 'EN_ATTENTE_DEPT')
            ->count();
    }

    private function getDeptStats(?int $deptId): array
    {
        if (!$deptId) return [];
        $base = \App\Models\Demande::whereHas('demandeur', fn($q) => $q->where('departement_id', $deptId));
        return [
            'total'      => (clone $base)->count(),
            'en_attente' => (clone $base)->where('statut', 'EN_ATTENTE_DEPT')->count(),
            'validees'   => (clone $base)->whereIn('statut', ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE'])->count(),
            'refusees'   => (clone $base)->whereIn('statut', ['REFUSEE_DEPT', 'REFUSEE_STOCK'])->count(),
        ];
    }

    private function getStockAlertes(): int
    {
        return \App\Models\Produit::where('is_active', true)
            ->whereColumn('quantite', '<=', 'seuil_alerte')
            ->count();
    }

    private function getRecentMouvements(int $limit): array
    {
        return \App\Models\MouvementStock::with('Produit')
            ->orderByDesc('date_mouvement')
            ->limit($limit)
            ->get()
            ->map(fn($m) => [
                'id'             => $m->id,
                'type'           => $m->type_mouvement,
                'Produit'        => $m->Produit?->nom_Produit ?? '—',
                'quantite'       => $m->quantite_mouvement,
                'date_mouvement' => $m->date_mouvement,
            ])
            ->toArray();
    }

    /**
     * Count rows in a model safely — returns 0 on any DB error.
     * Used for admin dashboard stats so a missing table never kills the profile page.
     */
    private function safeCount(string $modelClass): int
    {
        try {
            return $modelClass::count();
        } catch (\Throwable) {
            return 0;
        }
    }
}