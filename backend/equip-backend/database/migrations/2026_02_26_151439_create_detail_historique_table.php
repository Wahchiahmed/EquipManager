<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('details_historiques', function (Blueprint $table) {
            $table->bigIncrements('id_details');

            $table->unsignedBigInteger('id_historique');
            $table->foreign('id_historique')
                ->references('id_historique')
                ->on('historiques')
                ->onDelete('cascade');

            $table->string('champs_modifie', 190); // ex: "quantite", "statut", "commentaire"
            $table->text('ancien_valeur')->nullable();
            $table->text('nouveau_valeur')->nullable();

            // info libre (ex: "Ligne demande #5 / Produit #2", payload json, etc.)
            $table->text('info_detail')->nullable();
            $table->text('commentaire')->nullable();

            $table->timestamps();

            $table->index(['id_historique']);
            $table->index(['champs_modifie']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('details_historiques');
    }
};