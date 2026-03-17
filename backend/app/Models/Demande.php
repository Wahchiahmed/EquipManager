<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Demande extends Model
{
    protected $primaryKey = 'id_demande';

    protected $fillable = [
        'statut',
        'id_demandeur',
        'id_responsable_dept',
        'date_validation_dept',
        'id_responsable_stock',
        'date_validation_stock',
        'commentaire',
        'date_demande',
    ];

    protected $casts = [
        'date_demande'          => 'datetime',
        'date_validation_dept'  => 'datetime',
        'date_validation_stock' => 'datetime',
    ];

    // ── Statut constants ──────────────────────────────────────────────────────
    const STATUT_ATTENTE_DEPT  = 'EN_ATTENTE_DEPT';
    const STATUT_ATTENTE_STOCK = 'EN_ATTENTE_STOCK';
    const STATUT_VALIDEE       = 'VALIDEE';
    const STATUT_PARTIELLE     = 'PARTIELLEMENT_VALIDEE';
    const STATUT_LIVREE        = 'LIVREE';
    const STATUT_REFUSEE_DEPT  = 'REFUSEE_DEPT';
    const STATUT_REFUSEE_STOCK = 'REFUSEE_STOCK';

    // ── Relations ─────────────────────────────────────────────────────────────

    public function demandeur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_demandeur', 'id');
    }

    public function responsableDept(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_responsable_dept', 'id');
    }

    public function responsableStock(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_responsable_stock', 'id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(DetailDemande::class, 'id_demande', 'id_demande');
    }

    /**
     * FIFO: all lot consumptions across every detail line of this demande.
     * Useful to quickly get "which lots were consumed for this demande".
     */
    public function lotDetails(): HasMany
    {
        return $this->hasMany(MouvementLotDetail::class, 'id_demande', 'id_demande');
    }
}