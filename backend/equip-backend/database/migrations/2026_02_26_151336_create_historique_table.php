<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('historiques', function (Blueprint $table) {
            $table->bigIncrements('id_historique');

            // qui a fait l'action
            $table->unsignedBigInteger('id_utilisateur');
            $table->foreign('id_utilisateur')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');

            // infos action
            $table->dateTime('date_action')->useCurrent();
            $table->string('table_modifiee', 100);
            $table->enum('type_action', ['INSERT', 'UPDATE', 'DELETE', 'ACTION']); // ACTION = actions métiers (valider, refuser, etc.)
            $table->string('description', 1000);

            // optionnel (utile pour relier rapidement à un objet)
            $table->string('reference_objet', 120)->nullable(); // ex: "demande#12", "Produit#5", "mouvement#3"

            $table->timestamps();

            $table->index(['table_modifiee', 'type_action']);
            $table->index(['id_utilisateur', 'date_action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('historiques');
    }
};