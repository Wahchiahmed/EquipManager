<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Add CIN column to users ────────────────────────────────────
        Schema::table('users', function (Blueprint $table) {
            $table->string('cin', 20)->nullable()->unique()->after('telephone');
        });

        // ── 2. Create inscription_demandes table ──────────────────────────
        Schema::create('inscription_demandes', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('prenom');
            $table->string('email')->unique();
            $table->string('password');           
            $table->string('cin', 20)->nullable()->unique();
            $table->string('telephone', 20)->nullable();
            $table->unsignedBigInteger('role_id');
            $table->enum('statut', ['en_attente', 'accepte', 'refuse'])->default('en_attente');
            $table->text('commentaire_admin')->nullable();
            $table->unsignedBigInteger('traite_par')->nullable(); 
            $table->timestamp('traite_le')->nullable();
            $table->timestamps();

            $table->foreign('role_id')->references('id')->on('roles')->onDelete('restrict');
            $table->foreign('traite_par')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inscription_demandes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('cin');
        });
    }
};