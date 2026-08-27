<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\RestockSession;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\VariantAttributeValue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CheckConstraintAndDataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_unique_user_email_constraint(): void
    {
        User::create(['name' => 'User 1', 'email' => 'unique@example.com', 'password' => 'secret', 'role' => 'admin']);

        $this->expectException(QueryException::class);
        User::create(['name' => 'User 2', 'email' => 'unique@example.com', 'password' => 'secret', 'role' => 'cashier']);
    }

    public function test_unique_product_category_code_constraint(): void
    {
        ProductCategory::create(['name' => 'Cat 1', 'code' => 'UNIQUE-CAT']);

        $this->expectException(QueryException::class);
        ProductCategory::create(['name' => 'Cat 2', 'code' => 'UNIQUE-CAT']);
    }

    public function test_unique_product_sku_constraint(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat', 'code' => 'CAT-SKU']);
        Product::create(['category_id' => $cat->id, 'name' => 'P1', 'sku' => 'SKU-001']);

        $this->expectException(QueryException::class);
        Product::create(['category_id' => $cat->id, 'name' => 'P2', 'sku' => 'SKU-001']);
    }

    public function test_unique_product_variant_sku_constraint(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat', 'code' => 'CAT-VSKU']);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'P1', 'sku' => 'PROD-VSKU']);
        ProductVariant::create(['product_id' => $prod->id, 'name' => 'V1', 'sku' => 'V-SKU-001']);

        $this->expectException(QueryException::class);
        ProductVariant::create(['product_id' => $prod->id, 'name' => 'V2', 'sku' => 'V-SKU-001']);
    }

    public function test_unique_product_attribute_composite_constraint(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat', 'code' => 'CAT-PA']);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'P1', 'sku' => 'PROD-PA']);
        $attr = Attribute::create(['name' => 'Size', 'code' => 'ATTR-PA-SZ']);

        ProductAttribute::create(['product_id' => $prod->id, 'attribute_id' => $attr->id]);

        $this->expectException(QueryException::class);
        ProductAttribute::create(['product_id' => $prod->id, 'attribute_id' => $attr->id]);
    }

    public function test_unique_variant_attribute_value_composite_constraint(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat', 'code' => 'CAT-VAV']);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'P1', 'sku' => 'PROD-VAV']);
        $variant = ProductVariant::create(['product_id' => $prod->id, 'name' => 'V1', 'sku' => 'VAR-VAV-1']);
        $attr = Attribute::create(['name' => 'Color', 'code' => 'ATTR-VAV-CLR']);
        $val = AttributeValue::create(['attribute_id' => $attr->id, 'value' => 'Red', 'code' => 'VAL-RED']);

        VariantAttributeValue::create(['variant_id' => $variant->id, 'attribute_value_id' => $val->id]);

        $this->expectException(QueryException::class);
        VariantAttributeValue::create(['variant_id' => $variant->id, 'attribute_value_id' => $val->id]);
    }

    public function test_stock_movement_non_zero_quantity_change(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat', 'code' => 'CAT-SM']);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'P1', 'sku' => 'PROD-SM']);

        $movement = StockMovement::create([
            'product_id' => $prod->id,
            'type' => 'import',
            'quantity_change' => 10,
            'quantity_before' => 0,
            'quantity_after' => 10,
        ]);

        $this->assertNotEquals(0, $movement->quantity_change);
        $this->assertEquals(10, $movement->quantity_change);
    }
}
