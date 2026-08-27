<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class OrderSeeder extends Seeder
{
    public function run(): void
    {
        $posChannel = SalesChannel::where('code', 'POS-MAIN')->first() ?? SalesChannel::first();
        $webChannel = SalesChannel::where('code', 'WEB-DIRECT')->first() ?? $posChannel;
        $tiktokChannel = SalesChannel::where('code', 'TIKTOK-SHOP')->orWhere('code', 'TIKTOK-KC-SHOP')->first() ?? $posChannel;

        $cashier = User::whereIn('role', ['SELLER', 'cashier'])->first() ?? User::first();
        $customer1 = Customer::where('phone', '+85512345678')->first();
        $customer2 = Customer::where('phone', '+85598765432')->first();
        $customer3 = Customer::where('phone', '+85577112233')->first();

        $tshirt = Product::where('sku', 'PROD-TSHIRT-001')->first();
        $jeans = Product::where('sku', 'PROD-JEANS-001')->first();
        $backpack = Product::where('sku', 'PROD-BACKPACK-001')->first();
        $earbuds = Product::where('sku', 'PROD-EARBUDS-001')->first();

        $variant1 = ProductVariant::where('sku', 'TSHIRT-M-BLACK')->first();
        $variant2 = ProductVariant::where('sku', 'JEANS-M-BLACK')->first();
        $variant3 = ProductVariant::where('sku', 'BACKPACK-BLACK')->first();
        $variant4 = ProductVariant::where('sku', 'EARBUDS-BLACK')->first();

        // -------------------------------------------------------------
        // Order 1: Completed POS Order with Cash Payment
        // -------------------------------------------------------------
        $order1 = Order::firstOrCreate(
            ['order_number' => 'ORD-20260818-0001'],
            [
                'client_mutation_id' => 'MUT-20260818-0001-POS',
                'channel_id' => $posChannel->id,
                'sales_channel_id' => $posChannel->id,
                'customer_id' => $customer1?->id,
                'user_id' => $cashier->id,
                'created_by' => $cashier->id,
                'subtotal' => 36.00,
                'discount' => 0.00,
                'discount_amount' => 0.00,
                'delivery_cost' => 0.00,
                'total_amount' => 36.00,
                'final_amount' => 36.00,
                'delivery_address' => 'In-store POS counter pickup',
                'region' => 'Phnom Penh',
                'status' => 'COMPLETED',
                'payment_status' => 'paid',
                'note' => 'POS Walk-in Sale',
                'notes' => 'POS Walk-in Sale',
            ]
        );

        if ($tshirt && $variant1) {
            OrderItem::firstOrCreate(
                [
                    'order_id' => $order1->id,
                    'variant_id' => $variant1->id,
                ],
                [
                    'product_id' => $tshirt->id,
                    'quantity' => 2,
                    'unit_price' => 18.00,
                    'total_price' => 36.00,
                    'subtotal' => 36.00,
                    'discount_amount' => 0.00,
                    'final_amount' => 36.00,
                ]
            );

            Payment::firstOrCreate(
                ['order_id' => $order1->id],
                [
                    'payment_method' => 'cash',
                    'amount' => 36.00,
                    'transaction_ref' => 'CASH-REC-001',
                    'reference_number' => 'CASH-REC-001',
                    'proof_image_url' => null,
                    'status' => 'completed',
                ]
            );

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $variant1->id,
                    'movement_type' => 'SALE',
                    'reference_id' => 'ORD-20260818-0001',
                ],
                [
                    'product_id' => $tshirt->id,
                    'type' => 'sale',
                    'quantity_change' => -2,
                    'quantity_before' => 45,
                    'quantity_after' => 43,
                    'notes' => 'Sale for order ORD-20260818-0001',
                    'user_id' => $cashier->id,
                    'created_by' => $cashier->id,
                    'created_at' => $order1->created_at ?? now(),
                ]
            );
        }

        // -------------------------------------------------------------
        // Order 2: Completed Web Order with Bank Transfer Payment
        // -------------------------------------------------------------
        $order2 = Order::firstOrCreate(
            ['order_number' => 'ORD-20260818-0002'],
            [
                'client_mutation_id' => 'MUT-20260818-0002-WEB',
                'channel_id' => $webChannel->id,
                'sales_channel_id' => $webChannel->id,
                'customer_id' => $customer2?->id,
                'user_id' => $cashier->id,
                'created_by' => $cashier->id,
                'subtotal' => 63.00,
                'discount' => 5.00,
                'discount_amount' => 5.00,
                'delivery_cost' => 0.00,
                'total_amount' => 58.00,
                'final_amount' => 58.00,
                'delivery_address' => 'Street 51, BKK1, Phnom Penh',
                'region' => 'Phnom Penh',
                'status' => 'COMPLETED',
                'payment_status' => 'paid',
                'note' => 'Online Web Store Order with express delivery',
                'notes' => 'Online Web Store Order with express delivery',
            ]
        );

        if ($jeans && $variant2 && $backpack && $variant3) {
            OrderItem::firstOrCreate(
                [
                    'order_id' => $order2->id,
                    'variant_id' => $variant2->id,
                ],
                [
                    'product_id' => $jeans->id,
                    'quantity' => 1,
                    'unit_price' => 35.00,
                    'total_price' => 30.00,
                    'subtotal' => 35.00,
                    'discount_amount' => 5.00,
                    'final_amount' => 30.00,
                ]
            );

            OrderItem::firstOrCreate(
                [
                    'order_id' => $order2->id,
                    'variant_id' => $variant3->id,
                ],
                [
                    'product_id' => $backpack->id,
                    'quantity' => 1,
                    'unit_price' => 28.00,
                    'total_price' => 28.00,
                    'subtotal' => 28.00,
                    'discount_amount' => 0.00,
                    'final_amount' => 28.00,
                ]
            );

            Payment::firstOrCreate(
                ['order_id' => $order2->id],
                [
                    'payment_method' => 'ABA_QR',
                    'amount' => 58.00,
                    'transaction_ref' => 'ABA-TXN-778899',
                    'reference_number' => 'ABA-TXN-778899',
                    'proof_image_url' => 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c',
                    'status' => 'completed',
                ]
            );

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $variant2->id,
                    'movement_type' => 'SALE',
                    'reference_id' => 'ORD-20260818-0002',
                ],
                [
                    'product_id' => $jeans->id,
                    'type' => 'sale',
                    'quantity_change' => -1,
                    'quantity_before' => 25,
                    'quantity_after' => 24,
                    'notes' => 'Sale for order ORD-20260818-0002',
                    'user_id' => $cashier->id,
                    'created_by' => $cashier->id,
                    'created_at' => $order2->created_at ?? now(),
                ]
            );

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $variant3->id,
                    'movement_type' => 'SALE',
                    'reference_id' => 'ORD-20260818-0002',
                ],
                [
                    'product_id' => $backpack->id,
                    'type' => 'sale',
                    'quantity_change' => -1,
                    'quantity_before' => 15,
                    'quantity_after' => 14,
                    'notes' => 'Sale for order ORD-20260818-0002',
                    'user_id' => $cashier->id,
                    'created_by' => $cashier->id,
                    'created_at' => $order2->created_at ?? now(),
                ]
            );
        }

        // -------------------------------------------------------------
        // Order 3: Pending TikTok Live Order
        // -------------------------------------------------------------
        $order3 = Order::firstOrCreate(
            ['order_number' => 'ORD-20260818-0003'],
            [
                'client_mutation_id' => 'MUT-20260818-0003-TIKTOK',
                'channel_id' => $tiktokChannel->id,
                'sales_channel_id' => $tiktokChannel->id,
                'customer_id' => $customer3?->id,
                'user_id' => $cashier->id,
                'created_by' => $cashier->id,
                'subtotal' => 49.99,
                'discount' => 0.00,
                'discount_amount' => 0.00,
                'delivery_cost' => 0.00,
                'total_amount' => 49.99,
                'final_amount' => 49.99,
                'delivery_address' => 'Russian Blvd, Toul Kork, Phnom Penh',
                'region' => 'Phnom Penh',
                'status' => 'PENDING',
                'payment_status' => 'unpaid',
                'note' => 'TikTok Shop Live checkout awaiting customer payment confirmation',
                'notes' => 'TikTok Shop Live checkout awaiting customer payment confirmation',
            ]
        );

        if ($earbuds && $variant4) {
            OrderItem::firstOrCreate(
                [
                    'order_id' => $order3->id,
                    'variant_id' => $variant4->id,
                ],
                [
                    'product_id' => $earbuds->id,
                    'quantity' => 1,
                    'unit_price' => 49.99,
                    'total_price' => 49.99,
                    'subtotal' => 49.99,
                    'discount_amount' => 0.00,
                    'final_amount' => 49.99,
                ]
            );
        }
    }
}
