<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProduitLot extends Model
{
    protected $table      = 'produit_lots';
    protected $primaryKey = 'id_lot';

    protected $fillable = [
        'id_produit',
        'numero_lot',
        'date_entree',
        'date_expiration',
        'quantite_initiale',
        'quantite_restante',
        'id_mouvement_entree',
        'statut',
        'note',
    ];

    protected $casts = [
        'date_entree'       => 'datetime',
        'date_expiration'   => 'date',
        'quantite_initiale' => 'integer',
        'quantite_restante' => 'integer',
    ];

    // ── Statut constants ──────────────────────────────────────────────────────
    const STATUT_ACTIF  = 'actif';
    const STATUT_EPUISE = 'epuise';
    const STATUT_EXPIRE = 'expire';

    // ── Relations ─────────────────────────────────────────────────────────────

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class, 'id_produit', 'id_produit');
    }

    public function mouvementEntree(): BelongsTo
    {
        return $this->belongsTo(MouvementStock::class, 'id_mouvement_entree');
    }

    public function lotDetails(): HasMany
    {
        return $this->hasMany(MouvementLotDetail::class, 'id_lot', 'id_lot');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /**
     * Lots disponibles pour sortie FIFO — oldest first.
     */
    public function scopeDisponibles($query)
    {
        return $query
            ->where('statut', self::STATUT_ACTIF)
            ->where('quantite_restante', '>', 0)
            ->orderBy('date_entree', 'asc')
            ->orderBy('id_lot', 'asc'); // tiebreaker
    }

    public function scopePourProduit($query, int $idProduit)
    {
        return $query->where('id_produit', $idProduit);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isEpuise(): bool
    {
        return $this->quantite_restante <= 0;
    }

    public function isExpire(): bool
    {
        return $this->date_expiration && $this->date_expiration->isPast();
    }
}