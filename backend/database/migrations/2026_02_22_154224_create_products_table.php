<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('produits', function (Blueprint $table) {
            $table->id('id_produit'); // Primary Key personnalisée

            $table->string('nom_produit');
            $table->text('description')->nullable();

            $table->string('reference')->unique();
            $table->string('code_barre')->unique()->nullable();

            $table->integer('quantite')->default(0);
            $table->integer('seuil_alerte')->default(0);

            // Foreign Key
            $table->unsignedBigInteger('id_categorie');

            $table->boolean('is_active')->default(true);

            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            // Constraint
            $table->foreign('id_categorie')
                  ->references('id_categorie')
                  ->on('categories')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('produits');
    }
};