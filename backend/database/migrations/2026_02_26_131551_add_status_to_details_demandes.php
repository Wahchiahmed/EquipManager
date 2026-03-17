<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('detail_demandes', function (Blueprint $table) {
            // Statut de chaque ligne : en_attente | accepte | refuse
            $table->string('statut')->default('en_attente')->after('quantite');
            $table->text('commentaire_stock')->nullable()->after('statut');
        });
    }

    public function down(): void
    {
        Schema::table('detail_demandes', function (Blueprint $table) {
            $table->dropColumn(['statut', 'commentaire_stock']);
        });
    }
};