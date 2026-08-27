<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\RestockDetail;
use App\Models\RestockSession;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class RestockSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN', 'admin'])->first() ?? User::first();

        // 1. Confirmed Historical Restock Session
        $session1 = RestockSession::firstOrCreate(
            ['session_code' => 'RST-202608-001'],
            [
                'session_date' => now()->subDays(5),
                'user_id' => $admin->id,
                'created_by' => $admin->id,
                'status' => 'COMPLETED',
                'total_cost' => 290.00,
                'notes' => 'Batch restock receipt from Primary Apparel Supplier',
                'confirmed_at' => now()->subDays(5),
            ]
        );

        $tshirt = Product::where('sku', 'PROD-TSHIRT-001')->first();
        $jeans = Product::where('sku', 'PROD-JEANS-001')->first();

        $v1 = ProductVariant::where('sku', 'TSHIRT-M-BLACK')->first();
        $v2 = ProductVariant::where('sku', 'JEANS-M-BLACK')->first();

        if ($tshirt && $v1) {
            RestockDetail::firstOrCreate(
                [
                    'restock_session_id' => $session1->id,
                    'variant_id' => $v1->id,
                ],
                [
                    'product_id' => $tshirt->id,
                    'scanned_barcode' => $v1->barcode,
                    'quantity' => 20,
                    'unit_cost' => 7.50,
                    'total_cost' => 150.00,
                ]
            );

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $v1->id,
                    'movement_type' => 'RESTOCK',
                    'reference_id' => 'RST-202608-001',
                ],
                [
                    'product_id' => $tshirt->id,
                    'type' => 'restock',
                    'quantity_change' => 20,
                    'quantity_before' => 25,
                    'quantity_after' => 45,
                    'notes' => 'Restock session batch receipt RST-202608-001',
                    'user_id' => $admin->id,
                    'created_by' => $admin->id,
                    'created_at' => $session1->confirmed_at ?? now(),
                ]
            );
        }

        if ($jeans && $v2) {
            RestockDetail::firstOrCreate(
                [
                    'restock_session_id' => $session1->id,
                    'variant_id' => $v2->id,
                ],
                [
                    'product_id' => $jeans->id,
                    'scanned_barcode' => $v2->barcode,
                    'quantity' => 10,
                    'unit_cost' => 14.00,
                    'total_cost' => 140.00,
                ]
            );

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $v2->id,
                    'movement_type' => 'RESTOCK',
                    'reference_id' => 'RST-202608-001',
                ],
                [
                    'product_id' => $jeans->id,
                    'type' => 'restock',
                    'quantity_change' => 10,
                    'quantity_before' => 15,
                    'quantity_after' => 25,
                    'notes' => 'Restock session batch receipt RST-202608-001',
                    'user_id' => $admin->id,
                    'created_by' => $admin->id,
                    'created_at' => $session1->confirmed_at ?? now(),
                ]
            );
        }

        // 2. Pending Active Restock Session
        $session2 = RestockSession::firstOrCreate(
            ['session_code' => 'RST-202608-002'],
            [
                'session_date' => now(),
                'user_id' => $admin->id,
                'created_by' => $admin->id,
                'status' => 'DRAFT',
                'total_cost' => 172.50,
                'notes' => 'Pending restock session for accessories and audio',
                'confirmed_at' => null,
            ]
        );

        $backpack = Product::where('sku', 'PROD-BACKPACK-001')->first();
        $v3 = ProductVariant::where('sku', 'BACKPACK-BLACK')->first();

        if ($backpack && $v3) {
            RestockDetail::firstOrCreate(
                [
                    'restock_session_id' => $session2->id,
                    'variant_id' => $v3->id,
                ],
                [
                    'product_id' => $backpack->id,
                    'scanned_barcode' => $v3->barcode,
                    'quantity' => 15,
                    'unit_cost' => 11.50,
                    'total_cost' => 172.50,
                ]
            );
        }
    }
}
