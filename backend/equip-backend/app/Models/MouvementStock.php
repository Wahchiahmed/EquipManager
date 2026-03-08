<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MouvementStock extends Model
{
    protected $table      = 'mouvements_stock';
    protected $primaryKey = 'id';         

    protected $fillable = [
        'id_produit',                     
        'date_mouvement',
        'id_user',
        'id_demande',
        'type_mouvement',
        'quantite_mouvement',
        'quantite_avant',
        'quantite_apres',
        'note',
    ];

    protected $casts = [
        'date_mouvement'     => 'date',
        'quantite_mouvement' => 'integer',
        'quantite_avant'     => 'integer',
        'quantite_apres'     => 'integer',
    ];

    // ── Appended attribute: expose id as id_mouvement so frontend gets both ──

    protected $appends = ['id_mouvement'];

    public function getIdMouvementAttribute(): int
    {
        return $this->id;
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function Produit(): BelongsTo
    {
        // Second arg = FK on mouvements_stock, third arg = PK on produits
        // Must exactly match the DB column name (case-sensitive on some engines)
        return $this->belongsTo(Produit::class, 'id_produit', 'id_produit');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_user');
    }

    public function demande(): BelongsTo
    {
        return $this->belongsTo(Demande::class, 'id_demande', 'id_demande');
    }

    public function lotDetails(): HasMany
    {
        return $this->hasMany(MouvementLotDetail::class, 'id_mouvement');
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    public function scopeEntrees($query)  { return $query->where('type_mouvement', 'IN');  }
    public function scopeSorties($query)  { return $query->where('type_mouvement', 'OUT'); }
    public function scopeForProduit($query, int $idProduit) { return $query->where('id_produit', $idProduit); }
}