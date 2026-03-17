<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Historique extends Model
{
    protected $table = 'historiques';
    protected $primaryKey = 'id_historique';

    protected $fillable = [
        'date_action',
        'id_utilisateur',
        'description',
        'table_modifiee',
        'type_action',
        'reference_objet',
    ];

    protected $casts = [
        'date_action' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_utilisateur', 'id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(DetailHistorique::class, 'id_historique', 'id_historique');
    }
}