<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class UserSeeder extends Seeder
{
    public function run()
    {
        DB::table('users')->insert([
            'nom' => 'Wahchi',
            'prenom' => 'Ahmed',
            'email' => 'ahmedwahchi0@gmail.com',
            'password' => Hash::make('password123'), // you can change the password
            'telephone' => '12345678',
            'role_id' => 1, // admin role
            'departement_id' => null,
            'is_active' => 1,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now()
        ]);
    }
}