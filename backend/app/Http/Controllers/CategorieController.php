<?php

namespace App\Http\Controllers;

use App\Models\Categorie;
use Illuminate\Http\Request;

class CategorieController extends Controller
{
    public function index()
    {
        $categories = Categorie::withCount('produits')->orderBy('nom_categorie')->get()
            ->map(fn($c) => $this->format($c));
        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nom_categorie' => 'required|string|max:255|unique:categories,nom_categorie',
            'description'   => 'nullable|string',
        ]);

        $categorie = Categorie::create($request->only('nom_categorie', 'description'));

        return response()->json($this->format($categorie->loadCount('produits')), 201);
    }

    public function destroy(Categorie $categorie)
    {
        if ($categorie->produits()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer cette catégorie : des produits y sont encore associés.',
            ], 409);
        }

        $categorie->delete();
        return response()->json(['message' => 'Catégorie supprimée avec succès.']);
    }

    private function format(Categorie $c): array
    {
        return [
            'id_categorie'  => $c->id_categorie,
            'nom_categorie' => $c->nom_categorie,
            'description'   => $c->description,
            'produits_count' => $c->produits_count ?? 0,
            'created_at'    => $c->created_at?->format('Y-m-d'),
        ];
    }
}
