<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('detail_demandes', function (Blueprint $table) {
            $table->id('id_detail');                    // clé primaire
            $table->unsignedBigInteger('id_demande');   // FK vers demandes
            $table->unsignedBigInteger('id_produit');   // FK vers produits
            $table->integer('quantite')->default(1);    // quantité demandée
            $table->timestamps();

            // foreign keys
            $table->foreign('id_demande')->references('id_demande')->on('demandes')->onDelete('cascade');
            $table->foreign('id_produit')->references('id_produit')->on('produits')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detail_demandes');
    }
};