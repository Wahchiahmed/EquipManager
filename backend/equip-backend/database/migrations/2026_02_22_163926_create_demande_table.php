<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demandes', function (Blueprint $table) {
            $table->id('id_demande');                  // clé primaire
            $table->dateTime('date_demande');          // date de la demande
            $table->string('statut')->default('EN_ATTENTE'); // statut: EN_ATTENTE, VALIDEE, REFUSEE, etc.
            
            $table->unsignedBigInteger('id_demandeur');          // utilisateur qui fait la demande
            $table->unsignedBigInteger('id_responsable_dept')->nullable(); // responsable de département
            $table->dateTime('date_validation_dept')->nullable();           // date validation dept
            $table->unsignedBigInteger('id_responsable_stock')->nullable(); // responsable stock
            $table->dateTime('date_validation_stock')->nullable();          // date validation stock
            
            $table->text('commentaire')->nullable();
            
            $table->timestamps();

            // FK vers users
            $table->foreign('id_demandeur')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('id_responsable_dept')->references('id')->on('users')->onDelete('set null');
            $table->foreign('id_responsable_stock')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demandes');
    }
};