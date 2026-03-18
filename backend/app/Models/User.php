<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable, HasFactory;

    protected $fillable = ['nom', 'prenom', 'email', 'password', 'telephone','cin', 'role_id', 'departement_id', 'is_active', 'preferences'];
    protected $casts = ['preferences' => 'array'];
    protected $hidden = ['password', 'remember_token'];

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function departement()
    {
        return $this->belongsTo(Departement::class);
    }
    public function produitsGeres(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(
            Produit::class,
            'stocks',
            'id_gestionnaire_stock',
            'id_produit',
            'id',
            'id_produit'
        );
    }

    // Helper methods
    public function isAdmin(): bool
    {
        return $this->role_id === 1;
    }
    public function isEmployee(): bool
    {
        return $this->role_id === 2;
    }
    public function isRespDept(): bool
    {
        return $this->role_id === 3;
    }
    public function isRespStock(): bool
    {
        return $this->role_id === 4;
    }
}
