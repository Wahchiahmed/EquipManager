<?php

namespace App\Http\Controllers;

use App\Models\Produit;
use App\Models\Categorie;
use App\Models\MouvementStock;
use App\Services\FifoStockService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProduitController extends Controller
{
    public function __construct(
        private FifoStockService    $fifo,   // ← AJOUTÉ
        private NotificationService $notif,
    ) {}

    public function index()
    {
        $produits = Produit::with('categorie')->get()->map(fn($p) => $this->format($p));
        return response()->json($produits);
    }

    // =========================================================================
    // STORE — crée le produit + un lot FIFO initial si quantite > 0
    // =========================================================================
    public function store(Request $request)
    {
        $request->validate([
            'nom_produit'    => 'required|string|max:255',
            'description'    => 'nullable|string',
            'reference'      => 'nullable|string|max:100|unique:produits,reference',
            'code_barre'     => 'nullable|string|max:100|unique:produits,code_barre',
            'quantite'       => 'required|integer|min:0',
            'seuil_alerte'   => 'required|integer|min:0',
            'id_categorie'   => 'required|exists:categories,id_categorie',
            'is_active'      => 'sometimes|boolean',
            // Champs optionnels pour le lot initial
            'numero_lot'     => 'nullable|string|max:100',
            'date_expiration'=> 'nullable|date|after:today',
            'note_lot'       => 'nullable|string|max:300',
        ]);

        return DB::transaction(function () use ($request) {
            $user = $request->user();

            // 1. Créer le produit
            $produit = Produit::create($request->only(
                'nom_produit', 'description', 'reference', 'code_barre',
                'quantite', 'seuil_alerte', 'id_categorie', 'is_active'
            ));

            // 2. Créer le lot initial FIFO si quantite > 0
            if ($produit->quantite > 0) {

                // Créer un mouvement IN pour tracer l'entrée initiale
                $mouvement = MouvementStock::create([
                    'id_produit'         => $produit->id_produit,
                    'id_demande'         => null,
                    'date_mouvement'     => now(),
                    'type_mouvement'     => 'IN',
                    'quantite_mouvement' => $produit->quantite,
                    'quantite_avant'     => 0,
                    'quantite_apres'     => $produit->quantite,
                    'id_user'            => $user?->id,
                    'note'               => $request->note_lot ?? 'Stock initial — création produit',
                ]);

                // Créer le lot via FifoStockService
                $this->fifo->createLot(
                    produitId:      $produit->id_produit,
                    quantite:       $produit->quantite,
                    mouvementId:    $mouvement->id,
                    numeroLot:      $request->numero_lot      ?? null,
                    dateExpiration: $request->date_expiration ?? null,
                    note:           $request->note_lot        ?? 'Stock initial — création produit',
                    userId:         (int) ($user?->id ?? 0),
                );
            }

            // 3. Notification alerte si déjà en-dessous du seuil
            if ($produit->is_active && $produit->quantite <= $produit->seuil_alerte) {
                $this->notif->onAlerteStock(
                    ProduitId:   $produit->id_produit,
                    ProduitNom:  $produit->nom_produit,
                    quantite:    $produit->quantite,
                    seuilAlerte: $produit->seuil_alerte
                );
            }

            return response()->json($this->format($produit->load('categorie')), 201);
        });
    }

    public function show(Produit $Produit)
    {
        return response()->json($this->format($Produit->load('categorie')));
    }

    // =========================================================================
    // UPDATE — si quantite augmente manuellement, crée un lot de complément
    // =========================================================================
    public function update(Request $request, Produit $Produit)
    {
        $request->validate([
            'nom_produit'    => 'sometimes|string|max:255',
            'description'    => 'nullable|string',
            'reference'      => 'nullable|string|max:100|unique:produits,reference,' . $Produit->id_produit . ',id_produit',
            'code_barre'     => 'nullable|string|max:100|unique:produits,code_barre,' . $Produit->id_produit . ',id_produit',
            'quantite'       => 'sometimes|integer|min:0',
            'seuil_alerte'   => 'sometimes|integer|min:0',
            'id_categorie'   => 'sometimes|exists:categories,id_categorie',
            'is_active'      => 'sometimes|boolean',
            // Lot optionnel si la quantité augmente
            'numero_lot'     => 'nullable|string|max:100',
            'date_expiration'=> 'nullable|date|after:today',
            'note_lot'       => 'nullable|string|max:300',
        ]);

        return DB::transaction(function () use ($request, $Produit) {
            $user       = $request->user();
            $quantiteAvant = $Produit->quantite;

            $Produit->update($request->only(
                'nom_produit', 'description', 'reference', 'code_barre',
                'quantite', 'seuil_alerte', 'id_categorie', 'is_active'
            ));
            $Produit->refresh();

            // Si la quantité a été augmentée manuellement → créer un lot de complément
            $delta = $Produit->quantite - $quantiteAvant;
            if ($delta > 0) {
                $mouvement = MouvementStock::create([
                    'id_produit'         => $Produit->id_produit,
                    'id_demande'         => null,
                    'date_mouvement'     => now(),
                    'type_mouvement'     => 'IN',
                    'quantite_mouvement' => $delta,
                    'quantite_avant'     => $quantiteAvant,
                    'quantite_apres'     => $Produit->quantite,
                    'id_user'            => $user?->id,
                    'note'               => $request->note_lot ?? 'Ajustement manuel via admin',
                ]);

                $this->fifo->createLot(
                    produitId:      $Produit->id_produit,
                    quantite:       $delta,
                    mouvementId:    $mouvement->id,
                    numeroLot:      $request->numero_lot      ?? null,
                    dateExpiration: $request->date_expiration ?? null,
                    note:           $request->note_lot        ?? 'Ajustement manuel via admin',
                    userId:         (int) ($user?->id ?? 0),
                );
            }

            // Notification alerte si push sous le seuil
            if ($Produit->is_active && $Produit->quantite <= $Produit->seuil_alerte) {
                $this->notif->onAlerteStock(
                    ProduitId:   $Produit->id_produit,
                    ProduitNom:  $Produit->nom_produit,
                    quantite:    $Produit->quantite,
                    seuilAlerte: $Produit->seuil_alerte
                );
            }

            return response()->json($this->format($Produit->load('categorie')));
        });
    }

    public function destroy(Produit $Produit)
    {
        $Produit->delete();
        return response()->json(['message' => 'Produit supprimé avec succès.']);
    }

    public function toggleActive(Produit $Produit)
    {
        $Produit->update(['is_active' => !$Produit->is_active]);
        return response()->json([
            'message'   => $Produit->is_active ? 'Produit activé.' : 'Produit désactivé.',
            'is_active' => $Produit->is_active,
            'Produit'   => $this->format($Produit->load('categorie')),
        ]);
    }

    public function formData()
    {
        return response()->json([
            'categories' => Categorie::orderBy('nom_categorie')->get(['id_categorie', 'nom_categorie']),
        ]);
    }

    private function format(Produit $p): array
    {
        return [
            'id_produit'    => $p->id_produit,
            'nom_produit'   => $p->nom_produit,
            'description'   => $p->description,
            'reference'     => $p->reference,
            'code_barre'    => $p->code_barre,
            'quantite'      => $p->quantite,
            'seuil_alerte'  => $p->seuil_alerte,
            'is_active'     => $p->is_active,
            'en_alerte'     => $p->isEnAlerte(),
            'id_categorie'  => $p->id_categorie,
            'categorie_nom' => $p->categorie?->nom_categorie ?? '—',
            'created_at'    => $p->created_at?->format('Y-m-d'),
        ];
    }
}