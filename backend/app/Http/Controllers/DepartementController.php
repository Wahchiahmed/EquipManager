<?php

namespace App\Http\Controllers;

use App\Models\Departement;
use App\Models\User;
use Illuminate\Http\Request;

class DepartementController extends Controller
{
    public function index()
    {
        $departements = Departement::withCount('users')->get()->map(fn($d) => $this->format($d));
        return response()->json($departements);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nom' => 'required|string|max:255|unique:departements,nom',
        ]);

        $departement = Departement::create(['nom' => $request->nom]);

        return response()->json($this->format($departement->loadCount('users')), 201);
    }

    // ── PATCH /departements/{departement} — rename ────────────────────────────
    public function update(Request $request, Departement $departement)
    {
        $request->validate([
            'nom' => 'required|string|max:255|unique:departements,nom,' . $departement->id,
        ]);

        $departement->update(['nom' => $request->nom]);

        return response()->json($this->format($departement->loadCount('users')));
    }

    // ── GET /departements/{departement}/users — list members ──────────────────
    public function users(Departement $departement)
    {
        $users = User::with('role')
            ->where('departement_id', $departement->id)
            ->get()
            ->map(fn($u) => [
                'id'        => $u->id,
                'nom'       => $u->nom,
                'prenom'    => $u->prenom,
                'email'     => $u->email,
                'role_nom'  => $u->role?->nom ?? '—',
                'is_active' => (bool) $u->is_active,
            ]);

        return response()->json($users);
    }

    // ── GET /departements/available-users — users with no department ──────────
    // Used to populate the "assign" dropdown
    public function availableUsers()
    {
        $users = User::with('role')
            ->whereNull('departement_id')
            ->where('is_active', true)
            ->get()
            ->map(fn($u) => [
                'id'       => $u->id,
                'nom'      => $u->nom,
                'prenom'   => $u->prenom,
                'email'    => $u->email,
                'role_nom' => $u->role?->nom ?? '—',
            ]);

        return response()->json($users);
    }

    // ── POST /departements/{departement}/assign — assign a user ───────────────
    public function assignUser(Request $request, Departement $departement)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = User::findOrFail($request->user_id);

        // If already in this dept, nothing to do
        if ($user->departement_id === $departement->id) {
            return response()->json(['message' => 'Utilisateur déjà dans ce département.'], 422);
        }

        $user->update(['departement_id' => $departement->id]);

        return response()->json([
            'message' => "Utilisateur affecté au département {$departement->nom}.",
            'user'    => [
                'id'        => $user->id,
                'nom'       => $user->nom,
                'prenom'    => $user->prenom,
                'email'     => $user->email,
                'role_nom'  => $user->role?->nom ?? '—',
                'is_active' => (bool) $user->is_active,
            ],
            'departement' => $this->format($departement->loadCount('users')),
        ]);
    }

    // ── DELETE /departements/{departement}/users/{user} — unassign ────────────
    public function unassignUser(Departement $departement, User $user)
    {
        if ($user->departement_id !== $departement->id) {
            return response()->json(['message' => 'Cet utilisateur n\'appartient pas à ce département.'], 422);
        }

        $user->update(['departement_id' => null]);

        return response()->json([
            'message'     => "Utilisateur retiré du département {$departement->nom}.",
            'departement' => $this->format($departement->loadCount('users')),
        ]);
    }

    public function destroy(Departement $departement)
    {
        if ($departement->users()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer ce département : des utilisateurs y sont encore affectés.',
            ], 409);
        }

        $departement->delete();

        return response()->json(['message' => 'Département supprimé avec succès.']);
    }

    private function format(Departement $d): array
    {
        return [
            'id'          => $d->id,
            'nom'         => $d->nom,
            'users_count' => $d->users_count ?? 0,
            'created_at'  => $d->created_at?->format('Y-m-d'),
        ];
    }
}