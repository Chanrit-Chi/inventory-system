<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\VariantAttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductVariantReductionAndSimpleSwitchTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        if (!\Illuminate\Support\Facades\Schema::hasTable('personal_access_tokens')) {
            $this->artisan('migrate', ['--path' => 'vendor/laravel/sanctum/database/migrations']);
        }

        $this->admin = User::create([
            'name'             => 'Admin User',
            'email'            => 'admin@inventory.local',
            'password'         => Hash::make('Secret123!'),
            'role'             => 'ADMIN',
            'is_active'        => true,
            'permission_group' => 'Admin',
        ]);
        Sanctum::actingAs($this->admin);
    }

    public function test_variable_product_reduced_to_single_attribute_removes_unselected_variants_and_attributes(): void
    {
        $attrSize = Attribute::create(['name' => 'Size', 'code' => 'SIZE']);
        $valS = AttributeValue::create(['attribute_id' => $attrSize->id, 'value_name' => 'S']);
        $valM = AttributeValue::create(['attribute_id' => $attrSize->id, 'value_name' => 'M']);

        $attrColor = Attribute::create(['name' => 'Color', 'code' => 'COLOR']);
        $valRed = AttributeValue::create(['attribute_id' => $attrColor->id, 'value_name' => 'Red']);
        $valBlue = AttributeValue::create(['attribute_id' => $attrColor->id, 'value_name' => 'Blue']);

        $product = Product::create([
            'name'           => 'Product A9',
            'purchase_price' => 10.00,
            'selling_price'  => 25.00,
            'is_active'      => true,
        ]);
        ProductAttribute::create(['product_id' => $product->id, 'attribute_id' => $attrSize->id]);
        ProductAttribute::create(['product_id' => $product->id, 'attribute_id' => $attrColor->id]);

        // 4 combinations: S/Red, S/Blue, M/Red, M/Blue
        $v1 = ProductVariant::create(['product_id' => $product->id, 'name' => 'S / Red', 'sku' => 'A9-S-RED', 'cost_price' => 10, 'selling_price' => 25]);
        VariantAttributeValue::create(['variant_id' => $v1->id, 'attribute_value_id' => $valS->id]);
        VariantAttributeValue::create(['variant_id' => $v1->id, 'attribute_value_id' => $valRed->id]);

        $v2 = ProductVariant::create(['product_id' => $product->id, 'name' => 'S / Blue', 'sku' => 'A9-S-BLU', 'cost_price' => 10, 'selling_price' => 25]);
        VariantAttributeValue::create(['variant_id' => $v2->id, 'attribute_value_id' => $valS->id]);
        VariantAttributeValue::create(['variant_id' => $v2->id, 'attribute_value_id' => $valBlue->id]);

        $v3 = ProductVariant::create(['product_id' => $product->id, 'name' => 'M / Red', 'sku' => 'A9-M-RED', 'cost_price' => 10, 'selling_price' => 25]);
        VariantAttributeValue::create(['variant_id' => $v3->id, 'attribute_value_id' => $valM->id]);
        VariantAttributeValue::create(['variant_id' => $v3->id, 'attribute_value_id' => $valRed->id]);

        $v4 = ProductVariant::create(['product_id' => $product->id, 'name' => 'M / Blue', 'sku' => 'A9-M-BLU', 'cost_price' => 10, 'selling_price' => 25]);
        VariantAttributeValue::create(['variant_id' => $v4->id, 'attribute_value_id' => $valM->id]);
        VariantAttributeValue::create(['variant_id' => $v4->id, 'attribute_value_id' => $valBlue->id]);

        // Add a historical movement to v4 to ensure soft-deletion preserves history
        $movement = StockMovement::create([
            'product_id'      => $product->id,
            'variant_id'      => $v4->id,
            'movement_type'   => 'INITIAL',
            'quantity_change' => 10,
            'quantity_before' => 0,
            'quantity_after'  => 10,
        ]);

        // Now update from Size & Color to Size only (S and M)
        $updatePayload = [
            'name'           => 'Product A9 (Size Only)',
            'purchase_price' => 10.00,
            'selling_price'  => 25.00,
            'product_type'   => 'VARIABLE',
            'variants'       => [
                [
                    'name'             => 'S',
                    'sku'              => 'A9-S',
                    'selling_price'    => 25.00,
                    'cost_price'       => 10.00,
                    'attribute_values' => [
                        ['id' => $valS->id, 'value_name' => 'S', 'attribute' => ['name' => 'Size']],
                    ],
                ],
                [
                    'name'             => 'M',
                    'sku'              => 'A9-M',
                    'selling_price'    => 25.00,
                    'cost_price'       => 10.00,
                    'attribute_values' => [
                        ['id' => $valM->id, 'value_name' => 'M', 'attribute' => ['name' => 'Size']],
                    ],
                ],
            ],
        ];

        $res = $this->putJson("/api/v1/products/{$product->id}", $updatePayload);
        $res->assertStatus(200);

        // Fetch detail to simulate page refresh
        $showRes = $this->getJson("/api/v1/products/{$product->id}");
        $showRes->assertStatus(200);
        $data = $showRes->json('data');

        $this->assertCount(2, $data['variants']);
        $this->assertEquals(['S', 'M'], array_column($data['variants'], 'name'));
        $this->assertCount(1, $data['product_attributes']);
        $this->assertEquals('Size', $data['product_attributes'][0]['attribute']['name']);

        // Historical movement still points to soft-deleted v4
        $this->assertEquals('M / Blue', $movement->fresh()->variant()->withTrashed()->first()->name);
    }

    public function test_variable_product_switched_to_simple_product_clears_attributes_and_consolidation(): void
    {
        $attrSize = Attribute::create(['name' => 'Size', 'code' => 'SIZE']);
        $valS = AttributeValue::create(['attribute_id' => $attrSize->id, 'value_name' => 'S']);
        $valM = AttributeValue::create(['attribute_id' => $attrSize->id, 'value_name' => 'M']);

        $product = Product::create([
            'name'           => 'Product A9 Variable',
            'purchase_price' => 12.00,
            'selling_price'  => 30.00,
            'is_active'      => true,
        ]);
        ProductAttribute::create(['product_id' => $product->id, 'attribute_id' => $attrSize->id]);

        $v1 = ProductVariant::create(['product_id' => $product->id, 'name' => 'S', 'sku' => 'A9-S', 'cost_price' => 12, 'selling_price' => 30]);
        VariantAttributeValue::create(['variant_id' => $v1->id, 'attribute_value_id' => $valS->id]);

        $v2 = ProductVariant::create(['product_id' => $product->id, 'name' => 'M', 'sku' => 'A9-M', 'cost_price' => 12, 'selling_price' => 30]);
        VariantAttributeValue::create(['variant_id' => $v2->id, 'attribute_value_id' => $valM->id]);

        StockMovement::create([
            'product_id'      => $product->id,
            'variant_id'      => $v2->id,
            'movement_type'   => 'INITIAL',
            'quantity_change' => 5,
            'quantity_before' => 0,
            'quantity_after'  => 5,
        ]);

        // Switch to SIMPLE product
        $simplePayload = [
            'name'             => 'Product A9 Simple',
            'purchase_price'   => 12.00,
            'selling_price'    => 30.00,
            'product_type'     => 'SIMPLE',
            'quantity_on_hand' => 15,
            'variants'         => [
                [
                    'id'               => $v1->id,
                    'name'             => 'Standard',
                    'sku'              => 'A9-STD',
                    'selling_price'    => 30.00,
                    'cost_price'       => 12.00,
                    'quantity_on_hand' => 15,
                    'attribute_values' => [],
                ],
            ],
        ];

        $res = $this->putJson("/api/v1/products/{$product->id}", $simplePayload);
        $res->assertStatus(200);

        // Fetch detail to simulate page refresh
        $showRes = $this->getJson("/api/v1/products/{$product->id}");
        $showRes->assertStatus(200);
        $data = $showRes->json('data');

        $this->assertCount(1, $data['variants']);
        $this->assertEquals('Standard', $data['variants'][0]['name']);
        $this->assertEmpty($data['variants'][0]['attribute_values']);
        $this->assertEmpty($data['product_attributes']);
    }
}
