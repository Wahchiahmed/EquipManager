<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();

            // users.id est bigint unsigned → foreignId() est correct
            $table->foreignId('id_gestionnaire_stock')
                  ->constrained('users')
                  ->onDelete('cascade');

            // produits.id_produit est int unsigned (pas bigint) → unsignedInteger
            $table->unsignedInteger('id_produit');
            $table->foreign('id_produit')
                  ->references('id_produit')
                  ->on('produits')
                  ->onDelete('cascade');

            $table->timestamps();

            $table->unique(['id_gestionnaire_stock', 'id_produit'], 'unique_gestionnaire_produit');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stocks');
    }
};