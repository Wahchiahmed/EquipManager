<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAlertLog extends Model
{
    public $timestamps = false;

    protected $table = 'stock_alert_logs';

    protected $fillable = ['Produit_id', 'notified_at'];

    protected $casts = ['notified_at' => 'datetime'];

    public function Produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class, 'Produit_id', 'id_Produit');
    }
}