<?php

namespace App\Http\Controllers;

use App\Models\Departement;
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

    public function destroy(Departement $departement)
    {
        // Prevent deletion if users are still assigned to this department
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
