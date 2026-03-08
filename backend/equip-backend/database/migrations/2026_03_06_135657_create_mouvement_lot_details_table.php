<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mouvement_lot_details', function (Blueprint $table) {
            $table->id();

            // OUT movement that triggered this consumption
            $table->unsignedBigInteger('id_mouvement')->nullable();
            $table->foreign('id_mouvement')
                  ->references('id')->on('mouvements_stock')
                  ->nullOnDelete();

            // Demande that caused the consumption
            $table->unsignedBigInteger('id_demande')->nullable();
            $table->foreign('id_demande')
                  ->references('id_demande')->on('demandes')
                  ->nullOnDelete();

            // Specific line of the demande
            $table->unsignedBigInteger('id_detail_demande')->nullable();
            $table->foreign('id_detail_demande')
                  ->references('id_detail')->on('detail_demandes')
                  ->nullOnDelete();

            // Lot that was consumed
            $table->unsignedBigInteger('id_lot');
            $table->foreign('id_lot')
                  ->references('id_lot')->on('produit_lots')
                  ->cascadeOnDelete();

            $table->unsignedInteger('quantite_sortie');

            // Snapshot at moment of consumption
            $table->unsignedInteger('quantite_lot_avant');
            $table->unsignedInteger('quantite_lot_apres');

            $table->timestamps();

            $table->index('id_mouvement');
            $table->index('id_demande');
            $table->index('id_detail_demande');
            $table->index('id_lot');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mouvement_lot_details');
    }
};