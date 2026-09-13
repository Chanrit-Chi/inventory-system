<?php

namespace Database\Seeders;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class ExtraProductSeeder extends Seeder
{
    public function run(): void
    {
        $admin   = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN', 'admin'])->first() ?? User::first();
        $apparel = ProductCategory::where('code', 'CAT-APPAREL')->first();
        $acc     = ProductCategory::where('code', 'CAT-ACCESSORIES')->first();
        $elec    = ProductCategory::where('code', 'CAT-ELECTRONICS')->first();

        $sizeAttr  = Attribute::where('code', 'ATTR-SIZE')->first();
        $colorAttr = Attribute::where('code', 'ATTR-COLOR')->first();

        // Helper: create a simple product with one variant (no attribute)
        $simple = function (
            string $sku,
            string $name,
            string $barcode,
            ?object $cat,
            float $cost,
            float $sell,
            int $qty,
            int $reorder = 5,
            ?string $image = null,
            string $desc = ''
        ) use ($admin): void {
            $product = Product::firstOrCreate(
                ['sku' => $sku],
                [
                    'category_id'          => $cat?->id,
                    'name'                 => $name,
                    'barcode'              => $barcode,
                    'description'          => $desc,
                    'purchase_price'       => $cost,
                    'cost_price'           => $cost,
                    'selling_price'        => $sell,
                    'default_reorder_level'=> $reorder,
                    'image_url'            => $image,
                    'is_active'            => true,
                    'is_composite'         => false,
                ]
            );

            $varSku = $sku . '-VAR';
            $variant = ProductVariant::firstOrCreate(
                ['sku' => $varSku],
                [
                    'product_id'            => $product->id,
                    'name'                  => $name,
                    'barcode'               => $barcode . '1',
                    'cost_price_override'   => null,
                    'selling_price_override'=> null,
                    'cost_price'            => null,
                    'selling_price'         => null,
                    'quantity_on_hand'      => $qty,
                    'quantity_reserved'     => 0,
                    'reorder_level'         => $reorder,
                    'is_active'             => true,
                ]
            );

            StockMovement::firstOrCreate(
                ['variant_id' => $variant->id, 'movement_type' => 'INITIAL'],
                [
                    'product_id'      => $product->id,
                    'type'            => 'import',
                    'quantity_change' => $qty,
                    'quantity_before' => 0,
                    'quantity_after'  => $qty,
                    'reference_id'    => "INIT-{$varSku}",
                    'notes'           => "Initial stock for {$name}",
                    'user_id'         => $admin?->id,
                    'created_by'      => $admin?->id,
                    'created_at'      => now()->subDays(10),
                ]
            );
        };

        // Helper: create product with color variants
        $withColors = function (
            string $prodSku,
            string $name,
            string $barcodeBase,
            ?object $cat,
            float $cost,
            float $sell,
            array $colorQtys,
            int $reorder = 5,
            ?string $image = null,
            string $desc = ''
        ) use ($admin, $colorAttr): void {
            $product = Product::firstOrCreate(
                ['sku' => $prodSku],
                [
                    'category_id'          => $cat?->id,
                    'name'                 => $name,
                    'barcode'              => $barcodeBase,
                    'description'          => $desc,
                    'purchase_price'       => $cost,
                    'cost_price'           => $cost,
                    'selling_price'        => $sell,
                    'default_reorder_level'=> $reorder,
                    'image_url'            => $image,
                    'is_active'            => true,
                    'is_composite'         => false,
                ]
            );

            if ($colorAttr) {
                $product->attributes()->syncWithoutDetaching([$colorAttr->id]);
            }

            $i = 1;
            foreach ($colorQtys as $colorVal => $qty) {
                $colorClean = strtoupper(str_replace([' ', '-'], '', $colorVal));
                $varSku     = $prodSku . '-' . $colorClean;
                $barcode    = $barcodeBase . $i;

                $variant = ProductVariant::firstOrCreate(
                    ['sku' => $varSku],
                    [
                        'product_id'            => $product->id,
                        'name'                  => "{$name} - {$colorVal}",
                        'barcode'               => $barcode,
                        'cost_price_override'   => null,
                        'selling_price_override'=> null,
                        'cost_price'            => null,
                        'selling_price'         => null,
                        'quantity_on_hand'      => $qty,
                        'quantity_reserved'     => 0,
                        'reorder_level'         => $reorder,
                        'is_active'             => true,
                    ]
                );

                if ($colorAttr) {
                    $val = AttributeValue::where('attribute_id', $colorAttr->id)
                        ->where(fn($q) => $q->where('value_name', $colorVal)->orWhere('value', $colorVal))
                        ->first();
                    if ($val) {
                        $variant->attributeValues()->syncWithoutDetaching([$val->id]);
                    }
                }

                StockMovement::firstOrCreate(
                    ['variant_id' => $variant->id, 'movement_type' => 'INITIAL'],
                    [
                        'product_id'      => $product->id,
                        'type'            => 'import',
                        'quantity_change' => $qty,
                        'quantity_before' => 0,
                        'quantity_after'  => $qty,
                        'reference_id'    => "INIT-{$varSku}",
                        'notes'           => "Initial stock for {$varSku}",
                        'user_id'         => $admin?->id,
                        'created_by'      => $admin?->id,
                        'created_at'      => now()->subDays(10),
                    ]
                );

                $i++;
            }
        };

        // Helper: create product with size variants
        $withSizes = function (
            string $prodSku,
            string $name,
            string $barcodeBase,
            ?object $cat,
            float $cost,
            float $sell,
            array $sizeQtys,
            int $reorder = 5,
            ?string $image = null,
            string $desc = ''
        ) use ($admin, $sizeAttr): void {
            $product = Product::firstOrCreate(
                ['sku' => $prodSku],
                [
                    'category_id'          => $cat?->id,
                    'name'                 => $name,
                    'barcode'              => $barcodeBase,
                    'description'          => $desc,
                    'purchase_price'       => $cost,
                    'cost_price'           => $cost,
                    'selling_price'        => $sell,
                    'default_reorder_level'=> $reorder,
                    'image_url'            => $image,
                    'is_active'            => true,
                    'is_composite'         => false,
                ]
            );

            if ($sizeAttr) {
                $product->attributes()->syncWithoutDetaching([$sizeAttr->id]);
            }

            $i = 1;
            foreach ($sizeQtys as $sizeVal => $qty) {
                $varSku  = $prodSku . '-' . $sizeVal;
                $barcode = $barcodeBase . $i;

                $variant = ProductVariant::firstOrCreate(
                    ['sku' => $varSku],
                    [
                        'product_id'            => $product->id,
                        'name'                  => "{$name} - {$sizeVal}",
                        'barcode'               => $barcode,
                        'cost_price_override'   => null,
                        'selling_price_override'=> null,
                        'cost_price'            => null,
                        'selling_price'         => null,
                        'quantity_on_hand'      => $qty,
                        'quantity_reserved'     => 0,
                        'reorder_level'         => $reorder,
                        'is_active'             => true,
                    ]
                );

                if ($sizeAttr) {
                    $val = AttributeValue::where('attribute_id', $sizeAttr->id)
                        ->where(fn($q) => $q->where('value_name', $sizeVal)->orWhere('value', $sizeVal))
                        ->first();
                    if ($val) {
                        $variant->attributeValues()->syncWithoutDetaching([$val->id]);
                    }
                }

                StockMovement::firstOrCreate(
                    ['variant_id' => $variant->id, 'movement_type' => 'INITIAL'],
                    [
                        'product_id'      => $product->id,
                        'type'            => 'import',
                        'quantity_change' => $qty,
                        'quantity_before' => 0,
                        'quantity_after'  => $qty,
                        'reference_id'    => "INIT-{$varSku}",
                        'notes'           => "Initial stock for {$varSku}",
                        'user_id'         => $admin?->id,
                        'created_by'      => $admin?->id,
                        'created_at'      => now()->subDays(10),
                    ]
                );

                $i++;
            }
        };

        // ── APPAREL (12 products) ──────────────────────────────────────

        $withColors('PROD-POLO-001', 'Classic Polo Shirt', '8860021001', $apparel,
            9.00, 22.00, ['White' => 20, 'Black' => 18, 'Navy Blue' => 12, 'Forest Green' => 8], 5,
            'https://images.unsplash.com/photo-1625910513601-b0fb0d17b1e8');

        $withSizes('PROD-HOODIE-001', 'Fleece Pullover Hoodie', '8860021002', $apparel,
            14.00, 34.00, ['S' => 10, 'M' => 20, 'L' => 15, 'XL' => 8, 'XXL' => 4], 5,
            'https://images.unsplash.com/photo-1556821840-3a63f15732ce');

        $withColors('PROD-SHORTS-001', 'Athletic Running Shorts', '8860021003', $apparel,
            7.00, 17.00, ['Black' => 25, 'Navy Blue' => 15, 'Crimson Red' => 10], 5,
            'https://images.unsplash.com/photo-1591257464793-f7bd807db5bd');

        $withSizes('PROD-DRESS-001', 'Linen Midi Dress', '8860021004', $apparel,
            16.00, 42.00, ['S' => 8, 'M' => 14, 'L' => 10, 'XL' => 5], 4,
            'https://images.unsplash.com/photo-1539008835657-9e8e9680c956');

        $withColors('PROD-JACKET-001', 'Lightweight Bomber Jacket', '8860021005', $apparel,
            20.00, 55.00, ['Black' => 12, 'Olive Green' => 8, 'Navy Blue' => 6], 4,
            'https://images.unsplash.com/photo-1551537482-f2075a1d41f2');

        $withSizes('PROD-CARGO-001', 'Cargo Utility Pants', '8860021006', $apparel,
            13.00, 32.00, ['M' => 18, 'L' => 20, 'XL' => 12, 'XXL' => 6], 5,
            'https://images.unsplash.com/photo-1582552938357-32b906df40cb');

        $withColors('PROD-TANKTOP-001', 'Ribbed Sleeveless Tank Top', '8860021007', $apparel,
            5.00, 13.00, ['White' => 30, 'Black' => 25, 'Beige' => 12], 8,
            'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c');

        $simple('PROD-SCARF-001', 'Merino Wool Scarf', '8860021008', $apparel,
            8.00, 25.00, 20, 4, 'https://images.unsplash.com/photo-1481833761820-0509d3217039', 'Soft merino wool winter scarf');

        $withColors('PROD-SOCKS-001', 'Ankle Cushion Socks 3-Pack', '8860021009', $apparel,
            3.50, 9.00, ['White' => 40, 'Black' => 35, 'Grey' => 20], 10,
            'https://images.unsplash.com/photo-1582781613746-0e39a49e2d5a');

        $withSizes('PROD-BLAZER-001', 'Slim Fit Formal Blazer', '8860021010', $apparel,
            28.00, 75.00, ['S' => 5, 'M' => 10, 'L' => 8, 'XL' => 4], 3,
            'https://images.unsplash.com/photo-1594938298603-c8148c4b4b6e');

        $simple('PROD-BELT-001', 'Genuine Leather Belt', '8860021011', $apparel,
            6.00, 18.00, 30, 5, 'https://images.unsplash.com/photo-1624222247344-550fb60583dc', 'Full-grain leather reversible belt');

        $withColors('PROD-CAP-001', 'Structured Baseball Cap', '8860021012', $apparel,
            5.50, 16.00, ['Black' => 25, 'Navy Blue' => 18, 'Beige' => 14, 'Forest Green' => 10], 5,
            'https://images.unsplash.com/photo-1588850561407-ed78c282e89b');

        // ── ACCESSORIES (10 products) ──────────────────────────────────

        $withColors('PROD-TOTE-001', 'Cotton Canvas Tote Bag', '8860022001', $acc,
            4.00, 12.00, ['Natural' => 30, 'Black' => 20, 'Navy Blue' => 15], 8,
            'https://images.unsplash.com/photo-1604177091072-b7a97e21b01c');

        $simple('PROD-WALLET-001', 'Slim Bifold Leather Wallet', '8860022002', $acc,
            7.50, 22.00, 25, 5, 'https://images.unsplash.com/photo-1627123424574-724758594e93', 'RFID-blocking full-grain leather bifold');

        $withColors('PROD-SUNGLASSES-001', 'Polarized UV400 Sunglasses', '8860022003', $acc,
            9.00, 29.00, ['Black' => 20, 'Tortoise' => 12, 'Gold' => 8], 4,
            'https://images.unsplash.com/photo-1511499767150-a48a237f0083');

        $simple('PROD-UMBRELLA-001', 'Auto Open Compact Umbrella', '8860022004', $acc,
            6.50, 19.00, 18, 4, 'https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb', 'Windproof fibreglass ribs auto-open');

        $withColors('PROD-KEYCHAIN-001', 'Leather Key Organiser', '8860022005', $acc,
            3.00, 9.00, ['Brown' => 30, 'Black' => 25], 8,
            'https://images.unsplash.com/photo-1544816155-12df9643f363');

        $simple('PROD-CARDHOLDER-001', 'Minimalist Card Holder', '8860022006', $acc,
            4.50, 14.00, 20, 5, 'https://images.unsplash.com/photo-1618172193763-c511deb635ca', 'Slim 8-card aluminium cardholder');

        $simple('PROD-WATCH-001', 'Quartz Analogue Watch', '8860022007', $acc,
            18.00, 55.00, 10, 3, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30', 'Japanese quartz movement stainless case');

        $withColors('PROD-BANGLE-001', 'Stainless Steel Bangle Bracelet', '8860022008', $acc,
            4.00, 12.00, ['Silver' => 20, 'Gold' => 15, 'Rose Gold' => 10], 5,
            'https://images.unsplash.com/photo-1611591437281-460bfbe1220a');

        $simple('PROD-HATBOX-001', 'Round Foldable Bucket Hat', '8860022009', $acc,
            5.00, 15.00, 22, 5, 'https://images.unsplash.com/photo-1521369909029-2afed882baee', 'Reversible packable bucket hat');

        $simple('PROD-GLOVES-001', 'Touchscreen Compatible Gloves', '8860022010', $acc,
            6.00, 18.00, 16, 4, 'https://images.unsplash.com/photo-1547955922-85912e223015', 'Winter knit gloves with conductive fingertips');

        // ── ELECTRONICS (8 products) ───────────────────────────────────

        $simple('PROD-POWERBANK-001', '20000mAh Power Bank', '8860023001', $elec,
            12.00, 35.00, 20, 4, 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5', '65W PD fast-charge dual USB-C');

        $simple('PROD-CABLE-USBC-001', 'USB-C to USB-C Braided Cable 1m', '8860023002', $elec,
            2.50, 9.00, 50, 10, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64', '240W 40Gbps nylon braided cable');

        $withColors('PROD-SPEAKER-001', 'Portable Bluetooth Speaker', '8860023003', $elec,
            18.00, 48.00, ['Black' => 14, 'Teal' => 8, 'Coral' => 6], 4,
            'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1');

        $simple('PROD-MOUSEPAD-001', 'XL Extended Gaming Mouse Pad', '8860023004', $elec,
            4.50, 14.00, 25, 5, 'https://images.unsplash.com/photo-1591488320449-011701bb6704', 'Non-slip rubber base 800×400mm');

        $simple('PROD-WEBCAM-001', '1080p USB Webcam', '8860023005', $elec,
            14.00, 39.00, 12, 4, 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04', 'Auto-focus 60fps with built-in mic');

        $simple('PROD-LEDSTRIP-001', 'Smart LED Strip 5m', '8860023006', $elec,
            8.00, 24.00, 18, 4, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64', 'RGB Wi-Fi app-controlled 5m strip');

        $simple('PROD-STAND-001', 'Adjustable Laptop Stand', '8860023007', $elec,
            9.00, 28.00, 15, 4, 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46', 'Aluminium 6-angle ergonomic stand');

        $simple('PROD-KBMECHANICAL-001', 'Compact TKL Mechanical Keyboard', '8860023008', $elec,
            22.00, 65.00, 8, 3, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3', 'Tenkeyless hot-swap brown switches');
    }
}
