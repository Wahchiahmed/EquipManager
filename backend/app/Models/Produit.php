<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Produit extends Model
{
    protected $primaryKey = 'id_produit';

    protected $fillable = [
        'nom_produit', 'description', 'reference', 'code_barre',
        'quantite', 'seuil_alerte', 'id_categorie', 'is_active',
    ];

    protected $casts = [
        'is_active'    => 'boolean',
        'quantite'     => 'integer',
        'seuil_alerte' => 'integer',
    ];

    public function categorie()
    {
        return $this->belongsTo(Categorie::class, 'id_categorie', 'id_categorie');
    }

    // ── FIFO relations ────────────────────────────────────────────────────────

    /** All lots for this product. */
    public function lots(): HasMany
    {
        return $this->hasMany(ProduitLot::class, 'id_produit', 'id_produit');
    }

    /**
     * Active (non-epuised) lots ordered FIFO.
     * Use for display and stock checks.
     */
    public function lotsActifs(): HasMany
    {
        return $this->hasMany(ProduitLot::class, 'id_produit', 'id_produit')
                    ->where('statut', ProduitLot::STATUT_ACTIF)
                    ->where('quantite_restante', '>', 0)
                    ->orderBy('date_entree', 'asc');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isEnAlerte(): bool
    {
        return $this->quantite <= $this->seuil_alerte;
    }

    /** Sum of quantite_restante across all active lots. Should equal produits.quantite. */
    public function stockParLots(): int
    {
        return $this->lots()
                    ->where('statut', ProduitLot::STATUT_ACTIF)
                    ->sum('quantite_restante');
    }
    public function stocks(): HasMany
{
    return $this->hasMany(Stock::class, 'id_produit', 'id_produit');
}

public function gestionnaires(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
{
    return $this->belongsToMany(
        User::class,
        'stocks',
        'id_produit',
        'id_gestionnaire_stock',
        'id_produit',
        'id'
    );
}
}