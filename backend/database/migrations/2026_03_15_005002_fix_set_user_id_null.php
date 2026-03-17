<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── historiques ───────────────────────────────────────────────────────
        Schema::table('historiques', function (Blueprint $table) {
            // Drop old FK, make nullable, re-add with nullOnDelete
            $table->dropForeign(['id_utilisateur']);
            $table->unsignedBigInteger('id_utilisateur')->nullable()->change();
            $table->foreign('id_utilisateur')
                  ->references('id')->on('users')
                  ->nullOnDelete();
        });

        // ── mouvements_stock ──────────────────────────────────────────────────
        Schema::table('mouvements_stock', function (Blueprint $table) {
            $table->dropForeign(['id_user']);
            $table->unsignedBigInteger('id_user')->nullable()->change();
            $table->foreign('id_user')
                  ->references('id')->on('users')
                  ->nullOnDelete();
        });

        // ── demandes — id_responsable_dept & id_responsable_stock ─────────────
        // id_demandeur will be handled in PHP (set to null after ANNULEE logic)
        Schema::table('demandes', function (Blueprint $table) {
            // id_demandeur — nullable + SET NULL
            $table->dropForeign(['id_demandeur']);
            $table->unsignedBigInteger('id_demandeur')->nullable()->change();
            $table->foreign('id_demandeur')
                  ->references('id')->on('users')
                  ->nullOnDelete();

            // id_responsable_dept
            $table->dropForeign(['id_responsable_dept']);
            $table->unsignedBigInteger('id_responsable_dept')->nullable()->change();
            $table->foreign('id_responsable_dept')
                  ->references('id')->on('users')
                  ->nullOnDelete();

            // id_responsable_stock
            $table->dropForeign(['id_responsable_stock']);
            $table->unsignedBigInteger('id_responsable_stock')->nullable()->change();
            $table->foreign('id_responsable_stock')
                  ->references('id')->on('users')
                  ->nullOnDelete();
        });

        // ── departements — responsable_id (if exists) ─────────────────────────
        if (Schema::hasColumn('departements', 'responsable_id')) {
            Schema::table('departements', function (Blueprint $table) {
                $table->dropForeign(['responsable_id']);
                $table->unsignedBigInteger('responsable_id')->nullable()->change();
                $table->foreign('responsable_id')
                      ->references('id')->on('users')
                      ->nullOnDelete();
            });
        }

        // ── stocks / assignations gestionnaire ────────────────────────────────
        // Adjust table/column names to match your actual schema
        $stockTables = [
            ['table' => 'stocks',              'column' => 'id_gestionnaire_stock'],
            ['table' => 'stock_assignations',  'column' => 'id_gestionnaire_stock'],
            ['table' => 'produit_gestionnaire','column' => 'id_gestionnaire_stock'],
        ];

        foreach ($stockTables as $entry) {
            if (Schema::hasTable($entry['table']) && Schema::hasColumn($entry['table'], $entry['column'])) {
                Schema::table($entry['table'], function (Blueprint $table) use ($entry) {
                    try { $table->dropForeign([$entry['column']]); } catch (\Exception $e) {}
                    $table->unsignedBigInteger($entry['column'])->nullable()->change();
                    $table->foreign($entry['column'])
                          ->references('id')->on('users')
                          ->nullOnDelete();
                });
            }
        }
    }

    public function down(): void
    {
        // Reverse: drop nullable FKs, restore NOT NULL + CASCADE
        // Only implement if you need rollback support
        // Left intentionally minimal to avoid data loss on rollback
    }
};