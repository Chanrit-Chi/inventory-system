<?php

namespace Database\Seeders;

use App\Models\Expense;
use App\Models\User;
use Illuminate\Database\Seeder;

class ExpenseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN', 'admin'])->first() ?? User::first();

        $expenses = [
            [
                'title' => 'Retail Store Rental — August 2026',
                'amount' => 1200.00,
                'category' => 'Rent & Facility',
                'payment_method' => 'bank_transfer',
                'notes' => 'Monthly commercial retail store unit rent',
                'expense_date' => now()->startOfMonth()->toDateString(),
            ],
            [
                'title' => 'Electricity & High-Speed Internet Utilities',
                'amount' => 185.50,
                'category' => 'Utilities',
                'payment_method' => 'bank_transfer',
                'notes' => 'Store AC power, lighting, and fiber wifi',
                'expense_date' => now()->subDays(10)->toDateString(),
            ],
            [
                'title' => 'Branded Shipping Boxes & Thermal Paper Rolls',
                'amount' => 95.00,
                'category' => 'Packaging & Supplies',
                'payment_method' => 'cash',
                'notes' => '500 custom mailer boxes + 20 receipt rolls',
                'expense_date' => now()->subDays(7)->toDateString(),
            ],
            [
                'title' => 'Facebook & TikTok Ads Campaign',
                'amount' => 250.00,
                'category' => 'Marketing',
                'payment_method' => 'card',
                'notes' => 'Mid-month omnichannel sales promotion boost',
                'expense_date' => now()->subDays(3)->toDateString(),
            ],
            [
                'title' => 'Local Motorcycle Delivery Courier Fees',
                'amount' => 45.00,
                'category' => 'Logistics & Shipping',
                'payment_method' => 'cash',
                'notes' => 'Intra-city express package delivery dispatch',
                'expense_date' => now()->subDay()->toDateString(),
            ],
        ];

        foreach ($expenses as $expenseData) {
            Expense::firstOrCreate(
                [
                    'title' => $expenseData['title'],
                    'expense_date' => $expenseData['expense_date'],
                ],
                array_merge($expenseData, [
                    'user_id' => $admin?->id,
                    'created_by' => $admin?->id,
                ])
            );
        }
    }
}
