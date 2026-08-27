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

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN', 'admin'])->first() ?? User::first();
        $apparelCat = ProductCategory::where('code', 'CAT-APPAREL')->first();
        $accessoriesCat = ProductCategory::where('code', 'CAT-ACCESSORIES')->first();
        $electronicsCat = ProductCategory::where('code', 'CAT-ELECTRONICS')->first();

        $sizeAttr = Attribute::where('code', 'ATTR-SIZE')->first();
        $colorAttr = Attribute::where('code', 'ATTR-COLOR')->first();

        // -------------------------------------------------------------
        // Product 1: Classic Cotton T-Shirt (9 Cartesian Variants)
        // -------------------------------------------------------------
        $tshirt = Product::firstOrCreate(
            ['sku' => 'PROD-TSHIRT-001'],
            [
                'category_id' => $apparelCat->id,
                'name' => 'Classic Cotton T-Shirt',
                'barcode' => '8850011223301',
                'description' => '100% combed cotton everyday crewneck t-shirt',
                'purchase_price' => 8.00,
                'cost_price' => 8.00,
                'selling_price' => 18.00,
                'default_reorder_level' => 5,
                'image_url' => 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
                'is_active' => true,
                'is_composite' => false,
            ]
        );

        if ($sizeAttr && $colorAttr) {
            $tshirt->attributes()->syncWithoutDetaching([$sizeAttr->id, $colorAttr->id]);
        }

        $sizes = ['S', 'M', 'L'];
        $colors = ['Black', 'White', 'Navy Blue'];
        $barcodeBase = 8850011223310;

        foreach ($sizes as $sIdx => $sizeVal) {
            foreach ($colors as $cIdx => $colorVal) {
                $colorClean = strtoupper(str_replace(' ', '', $colorVal));
                $sku = "TSHIRT-{$sizeVal}-{$colorClean}";
                $barcode = (string) ($barcodeBase + ($sIdx * 3) + $cIdx + 1);
                $qty = ($sizeVal === 'S' && $colorVal === 'Navy Blue') ? 8 : 25;

                $variant = ProductVariant::firstOrCreate(
                    ['sku' => $sku],
                    [
                        'product_id' => $tshirt->id,
                        'name' => "Classic Cotton T-Shirt - {$sizeVal} / {$colorVal}",
                        'barcode' => $barcode,
                        'cost_price_override' => null,
                        'selling_price_override' => null,
                        'cost_price' => null,
                        'selling_price' => null,
                        'quantity_on_hand' => $qty,
                        'quantity_reserved' => 0,
                        'reorder_level' => 5,
                        'is_active' => true,
                    ]
                );

                $valSize = AttributeValue::where('attribute_id', $sizeAttr->id)->where(function ($q) use ($sizeVal) {
                    $q->where('value_name', $sizeVal)->orWhere('value', $sizeVal);
                })->first();
                $valColor = AttributeValue::where('attribute_id', $colorAttr->id)->where(function ($q) use ($colorVal) {
                    $q->where('value_name', $colorVal)->orWhere('value', $colorVal);
                })->first();
                if ($valSize && $valColor) {
                    $variant->attributeValues()->syncWithoutDetaching([$valSize->id, $valColor->id]);
                }

                StockMovement::firstOrCreate(
                    [
                        'variant_id' => $variant->id,
                        'movement_type' => 'INITIAL',
                    ],
                    [
                        'product_id' => $tshirt->id,
                        'type' => 'import',
                        'quantity_change' => $qty,
                        'quantity_before' => 0,
                        'quantity_after' => $qty,
                        'reference_id' => "INIT-{$sku}",
                        'notes' => "Initial inventory opening stock for {$sku}",
                        'user_id' => $admin?->id,
                        'created_by' => $admin?->id,
                        'created_at' => now()->subDays(15),
                    ]
                );
            }
        }

        // -------------------------------------------------------------
        // Product 2: Slim Fit Denim Jeans (6 Variants with Price Override)
        // -------------------------------------------------------------
        $jeans = Product::firstOrCreate(
            ['sku' => 'PROD-JEANS-001'],
            [
                'category_id' => $apparelCat->id,
                'name' => 'Slim Fit Denim Jeans',
                'barcode' => '8850011224401',
                'description' => 'Stretch denim with modern slim fit cut',
                'purchase_price' => 15.00,
                'cost_price' => 15.00,
                'selling_price' => 35.00,
                'default_reorder_level' => 5,
                'image_url' => 'https://images.unsplash.com/photo-1542272604-780c96856592',
                'is_active' => true,
                'is_composite' => false,
            ]
        );

        if ($sizeAttr && $colorAttr) {
            $jeans->attributes()->syncWithoutDetaching([$sizeAttr->id, $colorAttr->id]);
        }

        $jeansSizes = ['M', 'L', 'XL'];
        $jeansColors = ['Black', 'Navy Blue'];
        $jBarcodeBase = 8850011224410;

        foreach ($jeansSizes as $sIdx => $sizeVal) {
            foreach ($jeansColors as $cIdx => $colorVal) {
                $colorClean = strtoupper(str_replace(' ', '', $colorVal));
                $sku = "JEANS-{$sizeVal}-{$colorClean}";
                $barcode = (string) ($jBarcodeBase + ($sIdx * 2) + $cIdx + 1);
                $isXl = ($sizeVal === 'XL');
                $qty = ($isXl && $colorVal === 'Navy Blue') ? 4 : 15;

                $variant = ProductVariant::firstOrCreate(
                    ['sku' => $sku],
                    [
                        'product_id' => $jeans->id,
                        'name' => "Slim Fit Denim Jeans - {$sizeVal} / {$colorVal}",
                        'barcode' => $barcode,
                        'cost_price_override' => $isXl ? 16.50 : null,
                        'selling_price_override' => $isXl ? 38.00 : null,
                        'cost_price' => $isXl ? 16.50 : null,
                        'selling_price' => $isXl ? 38.00 : null,
                        'quantity_on_hand' => $qty,
                        'quantity_reserved' => 0,
                        'reorder_level' => 5,
                        'is_active' => true,
                    ]
                );

                $valSize = AttributeValue::where('attribute_id', $sizeAttr->id)->where(function ($q) use ($sizeVal) {
                    $q->where('value_name', $sizeVal)->orWhere('value', $sizeVal);
                })->first();
                $valColor = AttributeValue::where('attribute_id', $colorAttr->id)->where(function ($q) use ($colorVal) {
                    $q->where('value_name', $colorVal)->orWhere('value', $colorVal);
                })->first();
                if ($valSize && $valColor) {
                    $variant->attributeValues()->syncWithoutDetaching([$valSize->id, $valColor->id]);
                }

                StockMovement::firstOrCreate(
                    [
                        'variant_id' => $variant->id,
                        'movement_type' => 'INITIAL',
                    ],
                    [
                        'product_id' => $jeans->id,
                        'type' => 'import',
                        'quantity_change' => $qty,
                        'quantity_before' => 0,
                        'quantity_after' => $qty,
                        'reference_id' => "INIT-{$sku}",
                        'notes' => "Initial opening stock for {$sku}",
                        'user_id' => $admin?->id,
                        'created_by' => $admin?->id,
                        'created_at' => now()->subDays(15),
                    ]
                );
            }
        }

        // -------------------------------------------------------------
        // Product 3: Minimalist Canvas Backpack (2 Color Variants)
        // -------------------------------------------------------------
        $backpack = Product::firstOrCreate(
            ['sku' => 'PROD-BACKPACK-001'],
            [
                'category_id' => $accessoriesCat->id,
                'name' => 'Minimalist Canvas Backpack',
                'barcode' => '8850011225501',
                'description' => 'Water-resistant everyday travel backpack',
                'purchase_price' => 12.00,
                'cost_price' => 12.00,
                'selling_price' => 28.00,
                'default_reorder_level' => 5,
                'image_url' => 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
                'is_active' => true,
                'is_composite' => false,
            ]
        );

        if ($colorAttr) {
            $backpack->attributes()->syncWithoutDetaching([$colorAttr->id]);
        }

        foreach (['Black' => 15, 'Crimson Red' => 8] as $colorVal => $qty) {
            $colorClean = strtoupper(str_replace(' ', '', $colorVal));
            $sku = "BACKPACK-{$colorClean}";
            $barcode = ($colorVal === 'Black') ? '8850011225511' : '8850011225512';

            $variant = ProductVariant::firstOrCreate(
                ['sku' => $sku],
                [
                    'product_id' => $backpack->id,
                    'name' => "Minimalist Canvas Backpack - {$colorVal}",
                    'barcode' => $barcode,
                    'cost_price_override' => null,
                    'selling_price_override' => null,
                    'cost_price' => null,
                    'selling_price' => null,
                    'quantity_on_hand' => $qty,
                    'quantity_reserved' => 0,
                    'reorder_level' => 5,
                    'is_active' => true,
                ]
            );

            $valColor = AttributeValue::where('attribute_id', $colorAttr->id)->where(function ($q) use ($colorVal) {
                $q->where('value_name', $colorVal)->orWhere('value', $colorVal);
            })->first();
            if ($valColor) {
                $variant->attributeValues()->syncWithoutDetaching([$valColor->id]);
            }

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $variant->id,
                    'movement_type' => 'INITIAL',
                ],
                [
                    'product_id' => $backpack->id,
                    'type' => 'import',
                    'quantity_change' => $qty,
                    'quantity_before' => 0,
                    'quantity_after' => $qty,
                    'reference_id' => "INIT-{$sku}",
                    'notes' => "Initial inventory for {$sku}",
                    'user_id' => $admin?->id,
                    'created_by' => $admin?->id,
                    'created_at' => now()->subDays(15),
                ]
            );
        }

        // -------------------------------------------------------------
        // Product 4: Wireless Bluetooth Earbuds
        // -------------------------------------------------------------
        $earbuds = Product::firstOrCreate(
            ['sku' => 'PROD-EARBUDS-001'],
            [
                'category_id' => $electronicsCat->id,
                'name' => 'Wireless Bluetooth Earbuds',
                'barcode' => '8850011226601',
                'description' => 'Active noise cancelling wireless earbuds with charging case',
                'purchase_price' => 22.00,
                'cost_price' => 22.00,
                'selling_price' => 49.99,
                'default_reorder_level' => 5,
                'image_url' => 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df',
                'is_active' => true,
                'is_composite' => false,
            ]
        );

        if ($colorAttr) {
            $earbuds->attributes()->syncWithoutDetaching([$colorAttr->id]);
        }

        foreach (['Black' => 25, 'White' => 3] as $colorVal => $qty) {
            $sku = 'EARBUDS-' . strtoupper($colorVal);
            $barcode = ($colorVal === 'Black') ? '8850011226611' : '8850011226612';

            $variant = ProductVariant::firstOrCreate(
                ['sku' => $sku],
                [
                    'product_id' => $earbuds->id,
                    'name' => "Wireless Bluetooth Earbuds - {$colorVal}",
                    'barcode' => $barcode,
                    'cost_price_override' => null,
                    'selling_price_override' => null,
                    'cost_price' => null,
                    'selling_price' => null,
                    'quantity_on_hand' => $qty,
                    'quantity_reserved' => 0,
                    'reorder_level' => 5,
                    'is_active' => true,
                ]
            );

            $valColor = AttributeValue::where('attribute_id', $colorAttr->id)->where(function ($q) use ($colorVal) {
                $q->where('value_name', $colorVal)->orWhere('value', $colorVal);
            })->first();
            if ($valColor) {
                $variant->attributeValues()->syncWithoutDetaching([$valColor->id]);
            }

            StockMovement::firstOrCreate(
                [
                    'variant_id' => $variant->id,
                    'movement_type' => 'INITIAL',
                ],
                [
                    'product_id' => $earbuds->id,
                    'type' => 'import',
                    'quantity_change' => $qty,
                    'quantity_before' => 0,
                    'quantity_after' => $qty,
                    'reference_id' => "INIT-{$sku}",
                    'notes' => "Initial inventory for {$sku}",
                    'user_id' => $admin?->id,
                    'created_by' => $admin?->id,
                    'created_at' => now()->subDays(15),
                ]
            );
        }
    }
}
