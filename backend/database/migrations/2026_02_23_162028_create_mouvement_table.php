<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mouvements_stock', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('id_Produit');
            $table->foreign('id_Produit')
                ->references('id_Produit')
                ->on('produits')
                ->onDelete('cascade');

            $table->date('date_mouvement');

            $table->foreignId('id_user')
                ->constrained('users')
                ->onDelete('cascade');

            $table->unsignedBigInteger('id_demande')->nullable();
            $table->foreign('id_demande')
                ->references('id_demande')
                ->on('demandes')
                ->onDelete('set null');

            $table->enum('type_mouvement', ['IN', 'OUT']);
            $table->integer('quantite_mouvement');
            $table->integer('quantite_avant');
            $table->integer('quantite_apres');
            $table->string('note')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mouvements_stock');
    }
};
