<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\User;
use Illuminate\Database\Seeder;

class QuotationInvoiceSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::first();
        $customers = Customer::all();

        $sarah = $customers->firstWhere('name', 'Sarah Connor') ?? Customer::first();
        $david = $customers->firstWhere('name', 'David Miller');
        $jessica = $customers->firstWhere('name', 'Jessica Vance');

        // 1. Seed Quotations
        if (Quotation::count() === 0) {
            // Quote 1 (SENT)
            $q1 = Quotation::create([
                'quotation_number' => 'QT-2026-0042',
                'customer_id'      => $sarah?->id,
                'customer_name'    => 'Sarah Connor',
                'customer_phone'   => '+855 12 345 678',
                'customer_email'   => 'sarah.connor@gmail.com',
                'status'           => 'SENT',
                'subtotal'         => 390.00,
                'discount'         => 20.00,
                'total_amount'     => 370.00,
                'notes'            => 'Bulk corporate discount applied. Delivery to central office.',
                'valid_until'      => now()->addDays(20)->toDateString(),
                'user_id'          => $user?->id,
                'created_at'       => now()->subDays(3),
            ]);
            $q1->items()->createMany([
                [
                    'product_name' => 'Classic Cotton T-Shirt',
                    'sku'          => 'TS-COT-M-BLK',
                    'quantity'     => 10,
                    'unit_price'   => 18.00,
                    'line_total'   => 180.00,
                ],
                [
                    'product_name' => 'Premium Denim Jeans',
                    'sku'          => 'JN-DNM-32-BLU',
                    'quantity'     => 5,
                    'unit_price'   => 42.00,
                    'line_total'   => 210.00,
                ],
            ]);

            // Quote 2 (DRAFT)
            $q2 = Quotation::create([
                'quotation_number' => 'QT-2026-0043',
                'customer_id'      => $david?->id,
                'customer_name'    => 'David Miller',
                'customer_phone'   => '+855 98 765 432',
                'status'           => 'DRAFT',
                'subtotal'         => 179.00,
                'discount'         => 0.00,
                'total_amount'     => 179.00,
                'notes'            => 'Customer awaiting manager price approval.',
                'valid_until'      => now()->addDays(7)->toDateString(),
                'user_id'          => $user?->id,
                'created_at'       => now()->subDays(2),
            ]);
            $q2->items()->create([
                'product_name' => 'Wireless Earbuds Pro',
                'sku'          => 'AU-EAR-PRO-WHT',
                'quantity'     => 2,
                'unit_price'   => 89.50,
                'line_total'   => 179.00,
            ]);

            // Quote 3 (ACCEPTED)
            $q3 = Quotation::create([
                'quotation_number' => 'QT-2026-0044',
                'customer_id'      => $jessica?->id,
                'customer_name'    => 'Jessica Vance',
                'customer_phone'   => '+855 77 112 334',
                'status'           => 'ACCEPTED',
                'subtotal'         => 300.00,
                'discount'         => 15.00,
                'total_amount'     => 285.00,
                'valid_until'      => now()->addDays(10)->toDateString(),
                'user_id'          => $user?->id,
                'created_at'       => now()->subDays(4),
            ]);
            $q3->items()->create([
                'product_name' => 'Mechanical Keyboard RGB',
                'sku'          => 'KB-MEC-RGB-BLK',
                'quantity'     => 4,
                'unit_price'   => 75.00,
                'line_total'   => 300.00,
            ]);
        }

        // 2. Seed Invoices
        if (Invoice::count() === 0) {
            $order1 = Order::first();

            // Invoice 1 (PAID)
            $inv1 = Invoice::create([
                'invoice_number' => 'INV-2026-0891',
                'order_id'       => $order1?->id,
                'order_number'   => '#4093',
                'customer_id'    => $sarah?->id,
                'customer_name'  => 'Sarah Connor',
                'customer_phone' => '+855 12 345 678',
                'status'         => 'PAID',
                'total_amount'   => 145.00,
                'amount_paid'    => 145.00,
                'balance_due'    => 0.00,
                'due_date'       => now()->addDays(3)->toDateString(),
                'notes'          => 'Paid in full via ABA QR.',
                'user_id'        => $user?->id,
                'created_at'     => now()->subDays(1),
            ]);
            $inv1->items()->createMany([
                [
                    'product_name' => 'Classic Cotton T-Shirt (M / Black)',
                    'sku'          => 'TS-COT-M-BLK',
                    'quantity'     => 2,
                    'unit_price'   => 45.00,
                    'total_price'  => 90.00,
                ],
                [
                    'product_name' => 'Premium Denim Jeans (32 / Blue)',
                    'sku'          => 'JN-DNM-32-BLU',
                    'quantity'     => 1,
                    'unit_price'   => 55.00,
                    'total_price'  => 55.00,
                ],
            ]);
            $inv1->payments()->create([
                'amount'          => 145.00,
                'payment_method'  => 'ABA QR',
                'transaction_ref' => 'TXN-ABA-98124',
                'paid_at'         => now()->subDays(1),
                'recorded_by'     => 'Cashier',
            ]);

            // Invoice 2 (PARTIAL)
            $inv2 = Invoice::create([
                'invoice_number' => 'INV-2026-0892',
                'order_number'   => '#4091',
                'customer_id'    => $jessica?->id,
                'customer_name'  => 'Jessica Vance',
                'customer_phone' => '+855 77 112 334',
                'status'         => 'PARTIAL',
                'total_amount'   => 230.00,
                'amount_paid'    => 100.00,
                'balance_due'    => 130.00,
                'due_date'       => now()->addDays(6)->toDateString(),
                'notes'          => 'Initial 100$ deposit received in cash.',
                'user_id'        => $user?->id,
                'created_at'     => now()->subDays(2),
            ]);
            $inv2->items()->createMany([
                [
                    'product_name' => 'Mechanical Keyboard RGB',
                    'sku'          => 'KB-MEC-RGB-BLK',
                    'quantity'     => 3,
                    'unit_price'   => 60.00,
                    'total_price'  => 180.00,
                ],
                [
                    'product_name' => 'Ergonomic Mouse Wireless',
                    'sku'          => 'MS-ERG-WIR-BLK',
                    'quantity'     => 1,
                    'unit_price'   => 50.00,
                    'total_price'  => 50.00,
                ],
            ]);
            $inv2->payments()->create([
                'amount'          => 100.00,
                'payment_method'  => 'Cash',
                'transaction_ref' => 'CSH-0912',
                'paid_at'         => now()->subDays(2),
                'recorded_by'     => 'Cashier',
            ]);

            // Invoice 3 (OVERDUE)
            $inv3 = Invoice::create([
                'invoice_number' => 'INV-2026-0889',
                'order_number'   => '#4088',
                'customer_name'  => 'Sok Enterprise Corp',
                'customer_phone' => '+855 23 999 111',
                'status'         => 'OVERDUE',
                'total_amount'   => 700.00,
                'amount_paid'    => 0.00,
                'balance_due'    => 700.00,
                'due_date'       => now()->subDays(8)->toDateString(),
                'notes'          => 'Commercial contract invoice.',
                'user_id'        => $user?->id,
                'created_at'     => now()->subDays(20),
            ]);
            $inv3->items()->create([
                'product_name' => 'Office Desk Setup Pack',
                'sku'          => 'OFF-SET-STD',
                'quantity'     => 2,
                'unit_price'   => 350.00,
                'total_price'  => 700.00,
            ]);
        }
    }
}
