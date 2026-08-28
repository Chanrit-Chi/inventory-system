<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\RestockDetail;
use App\Models\RestockSession;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\VariantAttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class MigrationAndSchemaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that all 17 canonical tables exist in the database.
     */
    public function test_all_17_canonical_tables_exist(): void
    {
        $expectedTables = [
            'users',
            'product_categories',
            'attributes',
            'attribute_values',
            'products',
            'product_attributes',
            'product_variants',
            'variant_attribute_values',
            'stock_movements',
            'sales_channels',
            'customers',
            'orders',
            'order_items',
            'payments',
            'restock_sessions',
            'restock_details',
            'expenses',
        ];

        foreach ($expectedTables as $table) {
            $this->assertTrue(Schema::hasTable($table), "Table '{$table}' does not exist in schema.");
        }
    }

    /**
     * Test that columns exist on key tables.
     */
    public function test_table_columns_match_specification(): void
    {
        // users
        $this->assertTrue(Schema::hasColumns('users', ['id', 'name', 'email', 'password', 'role', 'remember_token', 'created_at', 'updated_at', 'deleted_at']));

        // product_categories
        $this->assertTrue(Schema::hasColumns('product_categories', ['id', 'name', 'code', 'description', 'created_at', 'updated_at', 'deleted_at']));

        // attributes
        $this->assertTrue(Schema::hasColumns('attributes', ['id', 'name', 'code', 'description', 'is_active', 'created_at', 'updated_at']));

        // attribute_values
        $this->assertTrue(Schema::hasColumns('attribute_values', ['id', 'attribute_id', 'value_name', 'value', 'code', 'is_active', 'created_at', 'updated_at']));

        // products
        $this->assertTrue(Schema::hasColumns('products', ['id', 'category_id', 'name', 'sku', 'barcode', 'description', 'purchase_price', 'cost_price', 'selling_price', 'default_reorder_level', 'image_url', 'is_active', 'is_composite', 'created_at', 'updated_at', 'deleted_at']));

        // product_attributes (composite PK)
        $this->assertTrue(Schema::hasColumns('product_attributes', ['product_id', 'attribute_id', 'created_at', 'updated_at']));

        // product_variants
        $this->assertTrue(Schema::hasColumns('product_variants', ['id', 'product_id', 'name', 'sku', 'barcode', 'cost_price_override', 'selling_price_override', 'cost_price', 'selling_price', 'quantity_on_hand', 'quantity_reserved', 'reorder_level', 'is_active', 'created_at', 'updated_at', 'deleted_at']));

        // variant_attribute_values (composite PK)
        $this->assertTrue(Schema::hasColumns('variant_attribute_values', ['variant_id', 'attribute_value_id', 'created_at', 'updated_at']));

        // stock_movements
        $this->assertTrue(Schema::hasColumns('stock_movements', ['id', 'product_id', 'variant_id', 'movement_type', 'type', 'quantity_change', 'quantity_before', 'quantity_after', 'reference_id', 'notes', 'user_id', 'created_at']));

        // sales_channels
        $this->assertTrue(Schema::hasColumns('sales_channels', ['id', 'name', 'code', 'type', 'image_url', 'is_active', 'created_at', 'updated_at']));

        // customers
        $this->assertTrue(Schema::hasColumns('customers', ['id', 'name', 'email', 'phone', 'address', 'total_purchased', 'total_spent', 'last_purchase_at', 'created_at', 'updated_at', 'deleted_at']));

        // orders
        $this->assertTrue(Schema::hasColumns('orders', ['id', 'order_number', 'client_mutation_id', 'channel_id', 'sales_channel_id', 'customer_id', 'user_id', 'created_by', 'status', 'payment_status', 'subtotal', 'discount', 'discount_amount', 'delivery_cost', 'total_amount', 'final_amount', 'delivery_address', 'region', 'note', 'notes', 'created_at', 'updated_at', 'deleted_at']));

        // order_items
        $this->assertTrue(Schema::hasColumns('order_items', ['id', 'order_id', 'product_id', 'variant_id', 'quantity', 'unit_price', 'total_price', 'subtotal', 'discount_amount', 'final_amount', 'created_at', 'updated_at']));

        // payments
        $this->assertTrue(Schema::hasColumns('payments', ['id', 'order_id', 'payment_method', 'amount', 'transaction_ref', 'reference_number', 'proof_image_url', 'status', 'created_at', 'updated_at']));

        // restock_sessions
        $this->assertTrue(Schema::hasColumns('restock_sessions', ['id', 'session_code', 'session_date', 'user_id', 'created_by', 'status', 'total_cost', 'notes', 'confirmed_at', 'created_at', 'updated_at']));

        // restock_details
        $this->assertTrue(Schema::hasColumns('restock_details', ['id', 'restock_session_id', 'product_id', 'variant_id', 'scanned_barcode', 'quantity', 'unit_cost', 'total_cost', 'created_at', 'updated_at']));

        // expenses
        $this->assertTrue(Schema::hasColumns('expenses', ['id', 'user_id', 'created_by', 'title', 'amount', 'category', 'payment_method', 'notes', 'expense_date', 'created_at', 'updated_at']));
    }

    /**
     * Test UUID auto-generation on model creation.
     */
    public function test_uuid_primary_keys_auto_generated(): void
    {
        $category = ProductCategory::create([
            'name' => 'Test Category',
            'code' => 'TEST-CAT',
        ]);

        $this->assertTrue(Str::isUuid($category->id));

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Test Product',
            'sku' => 'TEST-PROD-001',
            'purchase_price' => 10.00,
            'cost_price' => 10.00,
            'selling_price' => 20.00,
        ]);

        $this->assertTrue(Str::isUuid($product->id));
    }

    /**
     * Test cascade deletion behavior on dependent tables.
     */
    public function test_cascade_deletions_work_properly(): void
    {
        $category = ProductCategory::create([
            'name' => 'Cascade Category',
            'code' => 'CASCADE-CAT',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Parent Product',
            'sku' => 'CASCADE-P1',
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Variant 1',
            'sku' => 'CASCADE-V1',
        ]);

        $attr = Attribute::create([
            'name' => 'Test Color',
            'code' => 'ATTR-TEST-COLOR',
        ]);

        $attrVal = AttributeValue::create([
            'attribute_id' => $attr->id,
            'value' => 'Red',
            'code' => 'VAL-RED',
        ]);

        ProductAttribute::create([
            'product_id' => $product->id,
            'attribute_id' => $attr->id,
        ]);

        VariantAttributeValue::create([
            'variant_id' => $variant->id,
            'attribute_value_id' => $attrVal->id,
        ]);

        $this->assertDatabaseHas('product_variants', ['id' => $variant->id]);
        $this->assertDatabaseHas('product_attributes', ['product_id' => $product->id, 'attribute_id' => $attr->id]);
        $this->assertDatabaseHas('variant_attribute_values', ['variant_id' => $variant->id, 'attribute_value_id' => $attrVal->id]);

        // Force delete product
        $product->forceDelete();

        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);
        $this->assertDatabaseMissing('product_attributes', ['product_id' => $product->id, 'attribute_id' => $attr->id]);
        $this->assertDatabaseMissing('variant_attribute_values', ['variant_id' => $variant->id, 'attribute_value_id' => $attrVal->id]);
    }

    /**
     * Test soft deletes on configured models.
     */
    public function test_soft_deletes_behavior(): void
    {
        $user = User::create([
            'name' => 'Test User',
            'email' => 'softdelete@example.com',
            'password' => 'password',
            'role' => 'cashier',
        ]);

        $user->delete();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertNull(User::find($user->id));
        $this->assertNotNull(User::withTrashed()->find($user->id));
    }

    /**
     * Test composite indexes exist on high-frequency query tables.
     */
    public function test_composite_indexes_exist(): void
    {
        $indexes = \Illuminate\Support\Facades\Schema::getIndexes('product_variants');
        $hasCompositeIndex = false;

        foreach ($indexes as $index) {
            $cols = $index['columns'] ?? [];
            if ($cols === ['product_id', 'is_active']) {
                $hasCompositeIndex = true;
                break;
            }
        }

        $this->assertTrue($hasCompositeIndex, 'Composite index on product_variants(product_id, is_active) must exist.');
    }
}
