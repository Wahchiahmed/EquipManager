<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    protected $table = 'notifications';

    protected $fillable = [
        'recipient_user_id',
        'type',
        'title',
        'message',
        'data',
        'link',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'data'     => 'array',
        'is_read'  => 'boolean',
        'read_at'  => 'datetime',
    ];

    // ── Type constants ────────────────────────────────────────────────────────
    const TYPE_DEMANDE_CREEE          = 'DEMANDE_CREEE';
    const TYPE_DEMANDE_APPROUVEE_DEPT = 'DEMANDE_APPROUVEE_DEPT';
    const TYPE_DEMANDE_REFUSEE_DEPT   = 'DEMANDE_REFUSEE_DEPT';
    const TYPE_DEMANDE_TRAITEE_STOCK  = 'DEMANDE_TRAITEE_STOCK';
    const TYPE_DEMANDE_LIVREE         = 'DEMANDE_LIVREE';
    const TYPE_ALERTE_STOCK           = 'ALERTE_STOCK';

    // ── Relations ─────────────────────────────────────────────────────────────
    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('recipient_user_id', $userId);
    }
}