<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name'        => 'Super Administrator',
                'slug'        => 'SUPER_ADMIN',
                'description' => 'Full system owner with unrestricted access across all modules',
            ],
            [
                'name'        => 'Branch Administrator',
                'slug'        => 'ADMIN',
                'description' => 'Store and branch administrative access with user and inventory management',
            ],
            [
                'name'        => 'Store Manager',
                'slug'        => 'MANAGER',
                'description' => 'Store manager with inventory, pos, and report access',
            ],
            [
                'name'        => 'Cashier / Seller',
                'slug'        => 'SELLER',
                'description' => 'Point of sale cashier and sales staff with scanning and checkout capabilities',
            ],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(
                ['slug' => $role['slug']],
                $role
            );
        }
    }
}
