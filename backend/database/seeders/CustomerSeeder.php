<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = [
            [
                'name' => 'Sokha Chan',
                'email' => 'sokha.chan@example.com',
                'phone' => '+85512345678',
                'address' => 'Street 271, Toul Tum Poung, Phnom Penh',
                'total_purchased' => 2,
                'total_spent' => 36.00,
                'last_purchase_at' => now()->subDays(2),
            ],
            [
                'name' => 'Bopha Devi',
                'email' => 'bopha.devi@example.com',
                'phone' => '+85598765432',
                'address' => 'Street 51, BKK1, Phnom Penh',
                'total_purchased' => 2,
                'total_spent' => 58.00,
                'last_purchase_at' => now()->subDays(1),
            ],
            [
                'name' => 'Vannak Keo',
                'email' => 'vannak.keo@example.com',
                'phone' => '+85577112233',
                'address' => 'Russian Blvd, Toul Kork, Phnom Penh',
                'total_purchased' => 1,
                'total_spent' => 49.99,
                'last_purchase_at' => now(),
            ],
            [
                'name' => 'Channary Rath',
                'email' => 'channary.rath@example.com',
                'phone' => '+85588554433',
                'address' => 'Street 2004, Sen Sok, Phnom Penh',
                'total_purchased' => 0,
                'total_spent' => 0.00,
                'last_purchase_at' => null,
            ],
        ];

        foreach ($customers as $cData) {
            Customer::firstOrCreate(
                ['phone' => $cData['phone']],
                $cData
            );
        }
    }
}
