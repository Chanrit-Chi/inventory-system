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
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ChallengerEmpiricalStressTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }
    }

    // =========================================================================
    // 1. PIVOT TABLES COMPOSITE PRIMARY KEYS & ATTACH / SYNC STRESS TESTS
    // =========================================================================

    public function test_product_attributes_composite_pk_and_sync_operations(): void
    {
        $cat = ProductCategory::create(['name' => 'Tech Pivot', 'code' => 'TECH-PIV']);
        $product = Product::create([
            'category_id' => $cat->id,
            'name' => 'Smart Watch',
            'sku' => 'SW-001',
            'cost_price' => 50,
            'selling_price' => 120,
        ]);

        $attr1 = Attribute::create(['name' => 'Color', 'code' => 'ATTR-CLR']);
        $attr2 = Attribute::create(['name' => 'Strap Material', 'code' => 'ATTR-STRAP']);
        $attr3 = Attribute::create(['name' => 'Display Size', 'code' => 'ATTR-DISP']);

        // 1. attach() single
        $product->attributes()->attach($attr1->id);
        $this->assertCount(1, $product->fresh()->attributes);
        $this->assertDatabaseHas('product_attributes', [
            'product_id' => $product->id,
            'attribute_id' => $attr1->id,
        ]);

        // 2. sync() multiple
        $product->attributes()->sync([$attr1->id, $attr2->id, $attr3->id]);
        $this->assertCount(3, $product->fresh()->attributes);
        $this->assertDatabaseCount('product_attributes', 3);

        // 3. sync() reducing elements
        $product->attributes()->sync([$attr2->id]);
        $this->assertCount(1, $product->fresh()->attributes);
        $this->assertEquals($attr2->id, $product->fresh()->attributes->first()->id);
        $this->assertDatabaseMissing('product_attributes', [
            'product_id' => $product->id,
            'attribute_id' => $attr1->id,
        ]);

        // 4. sync() empty array
        $product->attributes()->sync([]);
        $this->assertCount(0, $product->fresh()->attributes);
        $this->assertDatabaseCount('product_attributes', 0);

        // 5. syncWithoutDetaching()
        $product->attributes()->syncWithoutDetaching([$attr1->id]);
        $product->attributes()->syncWithoutDetaching([$attr2->id]);
        $this->assertCount(2, $product->fresh()->attributes);

        // 6. Direct Duplicate Prevention (Composite PK violation)
        $this->expectException(QueryException::class);
        DB::table('product_attributes')->insert([
            'product_id' => $product->id,
            'attribute_id' => $attr1->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_variant_attribute_values_composite_pk_and_sync_operations(): void
    {
        $cat = ProductCategory::create(['name' => 'Fashion Pivot', 'code' => 'FASH-PIV']);
        $product = Product::create([
            'category_id' => $cat->id,
            'name' => 'Sneakers',
            'sku' => 'SNK-001',
            'cost_price' => 30,
            'selling_price' => 80,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Sneakers Red 42',
            'sku' => 'SNK-RED-42',
        ]);

        $attrColor = Attribute::create(['name' => 'Color', 'code' => 'COL-SNK']);
        $attrSize = Attribute::create(['name' => 'Size', 'code' => 'SZ-SNK']);

        $valRed = AttributeValue::create(['attribute_id' => $attrColor->id, 'value' => 'Red', 'code' => 'VAL-RED']);
        $val42 = AttributeValue::create(['attribute_id' => $attrSize->id, 'value' => '42', 'code' => 'VAL-42']);
        $valBlue = AttributeValue::create(['attribute_id' => $attrColor->id, 'value' => 'Blue', 'code' => 'VAL-BLU']);

        // 1. attach()
        $variant->attributeValues()->attach($valRed->id);
        $this->assertCount(1, $variant->fresh()->attributeValues);
        $this->assertDatabaseHas('variant_attribute_values', [
            'variant_id' => $variant->id,
            'attribute_value_id' => $valRed->id,
        ]);

        // 2. sync() multiple
        $variant->attributeValues()->sync([$valRed->id, $val42->id]);
        $this->assertCount(2, $variant->fresh()->attributeValues);
        $this->assertDatabaseCount('variant_attribute_values', 2);

        // 3. sync() update
        $variant->attributeValues()->sync([$valBlue->id, $val42->id]);
        $this->assertCount(2, $variant->fresh()->attributeValues);
        $this->assertDatabaseMissing('variant_attribute_values', [
            'variant_id' => $variant->id,
            'attribute_value_id' => $valRed->id,
        ]);

        // 4. sync([])
        $variant->attributeValues()->sync([]);
        $this->assertCount(0, $variant->fresh()->attributeValues);
        $this->assertDatabaseCount('variant_attribute_values', 0);

        // 5. Direct Duplicate Prevention (Composite PK violation)
        $variant->attributeValues()->attach($valRed->id);
        $this->expectException(QueryException::class);
        DB::table('variant_attribute_values')->insert([
            'variant_id' => $variant->id,
            'attribute_value_id' => $valRed->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // =========================================================================
    // 2. SOFT DELETES & RESTORE LIFECYCLE ADVERSARIAL TESTS
    // =========================================================================

    public function test_products_soft_delete_and_restore_cycle(): void
    {
        $cat = ProductCategory::create(['name' => 'SD Cat Test', 'code' => 'SD-CAT-1']);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Product SD',
            'sku' => 'SKU-SD-01',
            'cost_price' => 10,
            'selling_price' => 20,
        ]);

        $this->assertDatabaseHas('products', ['id' => $prod->id, 'deleted_at' => null]);
        $this->assertCount(1, Product::all());

        // Soft delete
        $prod->delete();

        // 1. Standard query excludes soft deleted model
        $this->assertCount(0, Product::all());
        $this->assertNull(Product::find($prod->id));

        // 2. withTrashed includes soft deleted model
        $this->assertCount(1, Product::withTrashed()->get());
        $this->assertNotNull(Product::withTrashed()->find($prod->id));

        // 3. onlyTrashed includes only soft deleted model
        $this->assertCount(1, Product::onlyTrashed()->get());
        $this->assertEquals($prod->id, Product::onlyTrashed()->first()->id);

        // 4. Restore recovers model to standard query
        $prod->restore();
        $this->assertCount(1, Product::all());
        $this->assertNotNull(Product::find($prod->id));
        $this->assertNull($prod->fresh()->deleted_at);
    }

    public function test_product_variants_soft_delete_and_restore_cycle(): void
    {
        $cat = ProductCategory::create(['name' => 'SD Var Cat', 'code' => 'SD-VAR-CAT']);
        $prod = Product::create([
            'category_id' => $cat->id,
            'name' => 'Product For Variant SD',
            'sku' => 'SKU-SD-VAR-P',
            'cost_price' => 10,
            'selling_price' => 20,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $prod->id,
            'name' => 'Variant SD Alpha',
            'sku' => 'SKU-SD-VAR-A',
        ]);

        $this->assertCount(1, ProductVariant::all());

        $variant->delete();

        $this->assertCount(0, ProductVariant::all());
        $this->assertNull(ProductVariant::find($variant->id));
        $this->assertCount(1, ProductVariant::withTrashed()->get());
        $this->assertCount(1, ProductVariant::onlyTrashed()->get());

        $variant->restore();

        $this->assertCount(1, ProductVariant::all());
        $this->assertNotNull(ProductVariant::find($variant->id));
        $this->assertNull($variant->fresh()->deleted_at);
    }

    public function test_customers_soft_delete_and_restore_cycle(): void
    {
        $cust = Customer::create([
            'name' => 'Alice Trashed',
            'phone' => '+85512345678',
            'email' => 'alice@trashed.com',
        ]);

        $this->assertCount(1, Customer::all());

        $cust->delete();

        $this->assertCount(0, Customer::all());
        $this->assertNull(Customer::find($cust->id));
        $this->assertCount(1, Customer::withTrashed()->get());
        $this->assertCount(1, Customer::onlyTrashed()->get());

        $cust->restore();

        $this->assertCount(1, Customer::all());
        $this->assertNotNull(Customer::find($cust->id));
        $this->assertNull($cust->fresh()->deleted_at);
    }

    public function test_soft_deleted_customer_preserves_order_foreign_key(): void
    {
        $channel = SalesChannel::create(['name' => 'POS SD', 'code' => 'POS-SD-1', 'type' => 'pos']);
        $user = User::create(['name' => 'Cashier SD', 'email' => 'cashier_sd@test.com', 'password' => 'secret', 'role' => 'cashier']);
        $cust = Customer::create(['name' => 'Customer SD', 'phone' => '+85511998877']);

        $order = Order::create([
            'order_number' => 'ORD-SD-CUST-1',
            'sales_channel_id' => $channel->id,
            'customer_id' => $cust->id,
            'user_id' => $user->id,
            'total_amount' => 50,
            'final_amount' => 50,
        ]);

        // Soft delete customer
        $cust->delete();

        // Foreign key should still be intact on order
        $order->refresh();
        $this->assertEquals($cust->id, $order->customer_id);

        // Standard relationship withTrashed allows access to historical customer
        $this->assertNotNull(Customer::withTrashed()->find($order->customer_id));
    }

    // =========================================================================
    // 3. FOREIGN KEY CASCADING & RESTRICT ADVERSARIAL STRESS TESTS
    // =========================================================================

    public function test_attribute_cascade_deletes_values_and_product_attributes(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat Attr Test', 'code' => 'CAT-ATTR']);
        $product = Product::create([
            'category_id' => $cat->id,
            'name' => 'Product Attr Cascade',
            'sku' => 'SKU-ATTR-CAS',
            'cost_price' => 15,
            'selling_price' => 30,
        ]);
        $attr = Attribute::create(['name' => 'Material', 'code' => 'ATTR-MAT']);
        $val = AttributeValue::create(['attribute_id' => $attr->id, 'value' => 'Cotton', 'code' => 'VAL-COT']);

        $product->attributes()->attach($attr->id);

        $this->assertDatabaseHas('attributes', ['id' => $attr->id]);
        $this->assertDatabaseHas('attribute_values', ['id' => $val->id]);
        $this->assertDatabaseHas('product_attributes', [
            'product_id' => $product->id,
            'attribute_id' => $attr->id,
        ]);

        $attr->delete();

        $this->assertDatabaseMissing('attributes', ['id' => $attr->id]);
        $this->assertDatabaseMissing('attribute_values', ['id' => $val->id]);
        $this->assertDatabaseMissing('product_attributes', [
            'product_id' => $product->id,
            'attribute_id' => $attr->id,
        ]);
    }

    public function test_attribute_value_cascade_deletes_variant_attribute_values(): void
    {
        $cat = ProductCategory::create(['name' => 'Cat Attr Val', 'code' => 'CAT-AV']);
        $product = Product::create([
            'category_id' => $cat->id,
            'name' => 'Product AV Cascade',
            'sku' => 'SKU-AV-CAS',
            'cost_price' => 10,
            'selling_price' => 20,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Variant AV',
            'sku' => 'VAR-AV-CAS',
        ]);
        $attr = Attribute::create(['name' => 'Size AV', 'code' => 'ATTR-SZ-AV']);
        $val = AttributeValue::create(['attribute_id' => $attr->id, 'value' => 'Large', 'code' => 'VAL-LRG']);

        $variant->attributeValues()->attach($val->id);

        $this->assertDatabaseHas('variant_attribute_values', [
            'variant_id' => $variant->id,
            'attribute_value_id' => $val->id,
        ]);

        $val->delete();

        $this->assertDatabaseMissing('attribute_values', ['id' => $val->id]);
        $this->assertDatabaseMissing('variant_attribute_values', [
            'variant_id' => $variant->id,
            'attribute_value_id' => $val->id,
        ]);
    }
}
