<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop foreign key first
            $table->dropForeign(['departement_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('departement_id')->nullable()->change();
        });

        Schema::table('users', function (Blueprint $table) {
            // Re-add foreign key but still allow nulls
            $table->foreign('departement_id')->references('id')->on('departements')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['departement_id']);
            $table->unsignedBigInteger('departement_id')->nullable(false)->change();
            $table->foreign('departement_id')->references('id')->on('departements')->onDelete('cascade');
        });
    }
};