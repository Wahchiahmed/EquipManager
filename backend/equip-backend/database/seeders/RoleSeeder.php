<?php

namespace Database\Seeders;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
  public function run()
    {
        $roles = [
            ['nom' => 'admin', 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ['nom' => 'employe', 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ['nom' => 'responsable departement', 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ['nom' => 'responsable stock', 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
        ];

        DB::table('roles')->insert($roles);
    }
}
