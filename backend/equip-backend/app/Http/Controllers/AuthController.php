<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Map database role names to the constants used in the React frontend.
     * DB values: admin | employe | responsable departement | responsable stock
     * React values: ADMIN | EMPLOYEE | RESPONSABLE_DEPARTEMENT | RESPONSABLE_STOCK
     */
    private function mapRole(string $roleName): string
    {
        return match (strtolower(trim($roleName))) {
            'admin'                    => 'ADMIN',
            'employe'                  => 'EMPLOYEE',
            'responsable departement'  => 'RESPONSABLE_DEPARTEMENT',
            'responsable stock'        => 'RESPONSABLE_STOCK',
            default                    => strtoupper(str_replace(' ', '_', $roleName)),
        };
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::with('role', 'departement')->where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Email ou mot de passe incorrect.'], 401);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Compte désactivé. Contactez l\'administrateur.'], 403);
        }

        // Revoke all previous tokens (single active session)
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $this->formatUser($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Déconnecté avec succès.']);
    }

    public function me(Request $request)
    {
        return response()->json($this->formatUser($request->user()->load('role', 'departement')));
    }

    private function formatUser(User $user): array
    {
        return [
            'id'             => $user->id,
            'nom'            => $user->nom,
            'prenom'         => $user->prenom,
            'email'          => $user->email,
            'telephone'      => $user->telephone,
            'role_id'        => $user->role_id,
            'role_nom'       => $this->mapRole($user->role->nom),   // e.g. 'ADMIN', 'EMPLOYEE'
            'departement_id' => $user->departement_id,
            'departement'    => $user->departement?->nom,
            'is_active'      => $user->is_active,
        ];
    }
}