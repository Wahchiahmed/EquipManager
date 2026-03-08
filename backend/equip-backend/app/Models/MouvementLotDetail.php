<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MouvementLotDetail extends Model
{
    protected $table = 'mouvement_lot_details';

    protected $fillable = [
        'id_mouvement',
        'id_demande',
        'id_detail_demande',
        'id_lot',
        'quantite_sortie',
        'quantite_lot_avant',
        'quantite_lot_apres',
    ];

    protected $casts = [
        'quantite_sortie'    => 'integer',
        'quantite_lot_avant' => 'integer',
        'quantite_lot_apres' => 'integer',
    ];

    // ── Relations ─────────────────────────────────────────────────────────────

    public function mouvement(): BelongsTo
    {
        return $this->belongsTo(MouvementStock::class, 'id_mouvement');
    }

    public function demande(): BelongsTo
    {
        return $this->belongsTo(Demande::class, 'id_demande', 'id_demande');
    }

    public function detailDemande(): BelongsTo
    {
        return $this->belongsTo(DetailDemande::class, 'id_detail_demande', 'id_detail');
    }

    public function lot(): BelongsTo
    {
        return $this->belongsTo(ProduitLot::class, 'id_lot', 'id_lot');
    }
}