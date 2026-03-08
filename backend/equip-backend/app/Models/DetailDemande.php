<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DetailDemande extends Model
{
    protected $primaryKey = 'id_detail';

    protected $fillable = [
        'id_demande',
        'id_produit',
        'quantite',
        'statut',
        'commentaire_stock',
    ];

    const STATUT_EN_ATTENTE = 'en_attente';
    const STATUT_ACCEPTE    = 'accepte';
    const STATUT_REFUSE     = 'refuse';

    // ── Relations ─────────────────────────────────────────────────────────────

    public function demande(): BelongsTo
    {
        return $this->belongsTo(Demande::class, 'id_demande', 'id_demande');
    }

    public function Produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class, 'id_produit', 'id_produit');
    }

    /**
     * FIFO: lot consumption rows for this specific detail line.
     * Use to display which lots were consumed for a single line item.
     */
    public function lotDetails(): HasMany
    {
        return $this->hasMany(MouvementLotDetail::class, 'id_detail_demande', 'id_detail');
    }
}