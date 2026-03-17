<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DetailHistorique extends Model
{
    protected $table = 'details_historiques';
    protected $primaryKey = 'id_details';

    protected $fillable = [
        'id_historique',
        'champs_modifie',
        'ancien_valeur',
        'nouveau_valeur',
        'info_detail',
        'commentaire',
    ];

    public function historique(): BelongsTo
    {
        return $this->belongsTo(Historique::class, 'id_historique', 'id_historique');
    }
}