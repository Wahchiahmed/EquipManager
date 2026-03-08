<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * EquipementController
 * Handles stock/equipment management (admin + responsable stock only).
 * Extend with your Equipement model once your table is ready.
 */
class EquipementController extends Controller
{
    public function index()
    {
        // TODO: return Equipement::all();
        return response()->json([]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nom'        => 'required|string|max:255',
            'quantite'   => 'required|integer|min:0',
            'categorie'  => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        // TODO: $equipement = Equipement::create($request->validated());
        return response()->json(['message' => 'Équipement créé.'], 201);
    }

    public function show($id)
    {
        // TODO: return Equipement::findOrFail($id);
        return response()->json([]);
    }

    public function update(Request $request, $id)
    {
        // TODO: update logic
        return response()->json(['message' => 'Équipement mis à jour.']);
    }

    public function destroy($id)
    {
        // TODO: delete logic
        return response()->json(['message' => 'Équipement supprimé.']);
    }
}
