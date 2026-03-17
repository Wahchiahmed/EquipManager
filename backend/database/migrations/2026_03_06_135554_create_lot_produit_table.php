<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('produit_lots', function (Blueprint $table) {
            $table->id('id_lot');

            $table->unsignedBigInteger('id_produit');
            $table->foreign('id_produit')
                  ->references('id_produit')->on('produits')
                  ->cascadeOnDelete();

            $table->string('numero_lot', 100)->nullable()
                  ->comment('Ex: LOT-2024-001 ou numéro fournisseur');

            $table->timestamp('date_entree')->useCurrent();
            $table->date('date_expiration')->nullable();

            $table->unsignedInteger('quantite_initiale');
            $table->unsignedInteger('quantite_restante');

            // FK to the IN movement that created this lot
            $table->unsignedBigInteger('id_mouvement_entree')->nullable();
            $table->foreign('id_mouvement_entree')
                  ->references('id')->on('mouvements_stock')
                  ->nullOnDelete();

            $table->enum('statut', ['actif', 'epuise', 'expire'])->default('actif');
            $table->string('note', 300)->nullable();

            $table->timestamps();

            // Composite indexes for FIFO queries
            $table->index(['id_produit', 'statut', 'date_entree'], 'idx_lot_fifo');
            $table->index(['id_produit', 'quantite_restante'],      'idx_lot_stock');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('produit_lots');
    }
};