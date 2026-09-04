<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            UserSeeder::class,
            SalesChannelSeeder::class,
            DeliveryAndBankSeeder::class,
            ProductCategorySeeder::class,
            AttributeSeeder::class,
            ProductSeeder::class,
            CustomerSeeder::class,
            RestockSeeder::class,
            OrderSeeder::class,
            ExpenseSeeder::class,
            QuotationInvoiceSeeder::class,
        ]);
    }
}
