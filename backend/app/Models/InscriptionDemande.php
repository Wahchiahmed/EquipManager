<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InscriptionDemande extends Model
{
    protected $table = 'inscription_demandes';

    protected $fillable = [
        'nom', 'prenom', 'email', 'password', 'cin', 'telephone',
        'role_id', 'statut', 'commentaire_admin', 'traite_par', 'traite_le',
    ];

    protected $hidden = ['password'];

    // ── Relations ──────────────────────────────────────────────────────────

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function traitePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traite_par');
    }

    // ── Scopes ─────────────────────────────────────────────────────────────

    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    public function scopeTraitees($query)
    {
        return $query->whereIn('statut', ['accepte', 'refuse']);
    }
}