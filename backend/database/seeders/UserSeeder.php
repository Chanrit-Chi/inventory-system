<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::pluck('id', 'slug');

        $users = [
            [
                'name'             => 'System Administrator',
                'email'            => 'admin@inventory.local',
                'password'         => Hash::make('password'),
                'role'             => 'SUPER_ADMIN',
                'role_id'          => $roles['SUPER_ADMIN'] ?? null,
                'is_active'        => true,
                'permission_group' => 'System Owners',
            ],
            [
                'name'             => 'Branch Admin',
                'email'            => 'branch@inventory.local',
                'password'         => Hash::make('password'),
                'role'             => 'ADMIN',
                'role_id'          => $roles['ADMIN'] ?? null,
                'is_active'        => true,
                'permission_group' => 'Branch Admins',
            ],
            [
                'name'             => 'Store Manager',
                'email'            => 'manager@inventory.local',
                'password'         => Hash::make('password'),
                'role'             => 'MANAGER',
                'role_id'          => $roles['MANAGER'] ?? null,
                'is_active'        => true,
                'permission_group' => 'Store Managers',
            ],
            [
                'name'             => 'Main POS Cashier',
                'email'            => 'cashier1@inventory.local',
                'password'         => Hash::make('password'),
                'role'             => 'SELLER',
                'role_id'          => $roles['SELLER'] ?? null,
                'is_active'        => true,
                'permission_group' => 'Cashiers / Sellers',
            ],
            [
                'name'             => 'Secondary Cashier',
                'email'            => 'cashier2@inventory.local',
                'password'         => Hash::make('password'),
                'role'             => 'SELLER',
                'role_id'          => $roles['SELLER'] ?? null,
                'is_active'        => true,
                'permission_group' => 'Cashiers / Sellers',
            ],
        ];

        foreach ($users as $userData) {
            User::firstOrCreate(
                ['email' => $userData['email']],
                $userData
            );
        }
    }
}
