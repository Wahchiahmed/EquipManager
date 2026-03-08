<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stock extends Model
{
    protected $table = 'stocks';

    protected $fillable = [
        'id_gestionnaire_stock',
        'id_produit',
    ];

    // ── Relations ─────────────────────────────────────────────────────────────

    public function gestionnaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_gestionnaire_stock', 'id');
    }

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class, 'id_produit', 'id_produit');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /**
     * Produits assignés à un gestionnaire donné.
     * Usage: Stock::forGestionnaire($userId)->pluck('id_produit')
     */
    public function scopeForGestionnaire($query, int $userId)
    {
        return $query->where('id_gestionnaire_stock', $userId);
    }

    /**
     * Gestionnaires assignés à un produit donné.
     * Usage: Stock::forProduit($produitId)->with('gestionnaire')->get()
     */
    public function scopeForProduit($query, int $produitId)
    {
        return $query->where('id_produit', $produitId);
    }
}