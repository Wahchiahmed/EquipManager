<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();

            $table->foreignId('recipient_user_id')
                  ->constrained('users')
                  ->cascadeOnDelete();

            // Type enum — add more as needed
            $table->string('type', 60); // DEMANDE_CREEE | DEMANDE_APPROUVEE_DEPT | DEMANDE_REFUSEE_DEPT | DEMANDE_TRAITEE_STOCK | DEMANDE_LIVREE | ALERTE_STOCK

            $table->string('title', 200);
            $table->text('message');

            $table->json('data')->nullable();      // { demande_id, Produit_id, … }
            $table->string('link', 300)->nullable(); // frontend route

            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();

            $table->timestamps();

            // ── Indexes ─────────────────────────────────────────────────────
            // Fast per-user queries (bell, badge)
            $table->index(['recipient_user_id', 'is_read', 'created_at'], 'notif_user_read_date');

            // Fast per-user unread count
            $table->index(['recipient_user_id', 'is_read'], 'notif_user_unread');
        });

        // ── Anti-spam: track last stock alert per Produit ────────────────────
        // Cleanest: a separate lightweight table — keeps produits clean, 
        // allows per-Produit-per-type throttle, easily prunable.
        Schema::create('stock_alert_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('Produit_id')
                  ->constrained('produits', 'id_Produit')
                  ->cascadeOnDelete();
            $table->timestamp('notified_at');
            $table->index(['Produit_id', 'notified_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_alert_logs');
        Schema::dropIfExists('notifications');
    }
};