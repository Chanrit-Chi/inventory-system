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
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ChallengerVerificationTest extends TestCase
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
    // 1. FOREIGN KEY CONSTRAINT ENFORCEMENT STRESS TESTS
    // =========================================================================

    public function test_restrict_on_delete_product_category_with_products(): void
    {
        $category = ProductCategory::create([
            'name' => 'Cat Restrict',
            'code' => 'CAT-RESTRICT',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Prod Restrict',
            'sku' => 'SKU-RESTRICT-1',
            'cost_price' => 10,
            'selling_price' => 20,
        ]);

        $this->expectException(QueryException::class);
        $category->forceDelete();
    }

    public function test_restrict_on_delete_sales_channel_with_orders(): void
    {
        $channel = SalesChannel::create([
            'name' => 'POS Main',
            'code' => 'POS-MAIN',
            'type' => 'pos',
        ]);

        $user = User::create([
            'name' => 'Cashier User',
            'email' => 'cashier@test.com',
            'password' => 'secret',
            'role' => 'cashier',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-RESTRICT-1',
            'sales_channel_id' => $channel->id,
            'user_id' => $user->id,
            'total_amount' => 100,
            'discount_amount' => 0,
            'final_amount' => 100,
            'status' => 'completed',
            'payment_status' => 'paid',
        ]);

        $this->expectException(QueryException::class);
        $channel->delete();
    }

    public function test_restrict_on_delete_user_with_orders(): void
    {
        $channel = SalesChannel::create([
            'name' => 'Online Store',
            'code' => 'ONLINE-STORE',
            'type' => 'online',
        ]);

        $user = User::create([
            'name' => 'Seller User',
            'email' => 'seller@test.com',
            'password' => 'secret',
            'role' => 'admin',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-RESTRICT-2',
            'sales_channel_id' => $channel->id,
            'user_id' => $user->id,
            'total_amount' => 50,
            'discount_amount' => 0,
            'final_amount' => 50,
            'status' => 'completed',
            'payment_status' => 'paid',
        ]);

        $this->expectException(QueryException::class);
        $user->forceDelete();
    }

    public function test_restrict_on_delete_user_with_expenses(): void
    {
        $user = User::create([
            'name' => 'Expense Admin',
            'email' => 'expense_admin@test.com',
            'password' => 'secret',
            'role' => 'admin',
        ]);

        $expense = Expense::create([
            'user_id' => $user->id,
            'title' => 'Office Supplies',
            'amount' => 45.50,
            'category' => 'office',
            'expense_date' => now()->toDateString(),
        ]);

        $this->expectException(QueryException::class);
        $user->forceDelete();
    }

    public function test_restrict_on_delete_user_with_restock_sessions(): void
    {
        $user = User::create([
            'name' => 'Restock Manager',
            'email' => 'restock_mgr@test.com',
            'password' => 'secret',
            'role' => 'admin',
        ]);

        $session = RestockSession::create([
            'session_code' => 'RS-RESTRICT-1',
            'user_id' => $user->id,
            'status' => 'pending',
            'total_cost' => 100,
        ]);

        $this->expectException(QueryException::class);
        $user->forceDelete();
    }

    public function test_restrict_on_delete_product_with_order_items(): void
    {
        $category = ProductCategory::create(['name' => 'Cat 1', 'code' => 'CAT-1']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Shirt',
            'sku' => 'SKU-SHIRT-01',
            'cost_price' => 5,
            'selling_price' => 15,
        ]);
        $channel = SalesChannel::create(['name' => 'POS', 'code' => 'POS-1', 'type' => 'pos']);
        $user = User::create(['name' => 'U1', 'email' => 'u1@test.com', 'password' => 'secret', 'role' => 'admin']);
        $order = Order::create([
            'order_number' => 'ORD-001',
            'sales_channel_id' => $channel->id,
            'user_id' => $user->id,
            'total_amount' => 15,
            'final_amount' => 15,
        ]);

        $orderItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 15,
            'subtotal' => 15,
            'final_amount' => 15,
        ]);

        $this->expectException(QueryException::class);
        $product->forceDelete();
    }

    public function test_cascade_on_delete_product_to_variants_and_stock_movements(): void
    {
        $category = ProductCategory::create(['name' => 'Cat 2', 'code' => 'CAT-2']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Shoes',
            'sku' => 'SKU-SHOES-01',
            'cost_price' => 20,
            'selling_price' => 50,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Shoes Red 42',
            'sku' => 'SKU-SHOES-RED-42',
        ]);
        $movement = StockMovement::create([
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'type' => 'import',
            'quantity_change' => 10,
            'quantity_before' => 0,
            'quantity_after' => 10,
        ]);

        $this->assertDatabaseHas('product_variants', ['id' => $variant->id]);
        $this->assertDatabaseHas('stock_movements', ['id' => $movement->id]);

        $product->forceDelete();

        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);
        $this->assertDatabaseMissing('stock_movements', ['id' => $movement->id]);
    }

    public function test_cascade_on_delete_order_to_items_and_payments(): void
    {
        $category = ProductCategory::create(['name' => 'Cat 3', 'code' => 'CAT-3']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Hat',
            'sku' => 'SKU-HAT-01',
            'cost_price' => 5,
            'selling_price' => 10,
        ]);
        $channel = SalesChannel::create(['name' => 'POS', 'code' => 'POS-2', 'type' => 'pos']);
        $user = User::create(['name' => 'U2', 'email' => 'u2@test.com', 'password' => 'secret', 'role' => 'admin']);
        $order = Order::create([
            'order_number' => 'ORD-002',
            'sales_channel_id' => $channel->id,
            'user_id' => $user->id,
            'total_amount' => 10,
            'final_amount' => 10,
        ]);
        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 10,
            'subtotal' => 10,
            'final_amount' => 10,
        ]);
        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cash',
            'amount' => 10,
            'status' => 'completed',
        ]);

        $this->assertDatabaseHas('order_items', ['id' => $item->id]);
        $this->assertDatabaseHas('payments', ['id' => $payment->id]);

        $order->forceDelete();

        $this->assertDatabaseMissing('order_items', ['id' => $item->id]);
        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
    }

    public function test_cascade_on_delete_restock_session_to_details(): void
    {
        $category = ProductCategory::create(['name' => 'Cat Restock', 'code' => 'CAT-RS']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Restock Prod',
            'sku' => 'SKU-RS-01',
            'cost_price' => 10,
            'selling_price' => 25,
        ]);
        $user = User::create(['name' => 'Restock User', 'email' => 'rs_user@test.com', 'password' => 'secret', 'role' => 'admin']);
        $session = RestockSession::create([
            'session_code' => 'RS-001',
            'user_id' => $user->id,
            'status' => 'pending',
            'total_cost' => 100,
        ]);
        $detail = RestockDetail::create([
            'restock_session_id' => $session->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'unit_cost' => 10,
            'total_cost' => 100,
        ]);

        $this->assertDatabaseHas('restock_details', ['id' => $detail->id]);

        $session->delete();

        $this->assertDatabaseMissing('restock_details', ['id' => $detail->id]);
    }

    public function test_null_on_delete_customer_on_orders(): void
    {
        $channel = SalesChannel::create(['name' => 'POS', 'code' => 'POS-CUST', 'type' => 'pos']);
        $user = User::create(['name' => 'Cashier Cust', 'email' => 'cashier_cust@test.com', 'password' => 'secret', 'role' => 'cashier']);
        $customer = Customer::create([
            'name' => 'John Nullable',
            'email' => 'john_null@example.com',
            'phone' => '0987654321',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-NULL-CUST-1',
            'sales_channel_id' => $channel->id,
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'total_amount' => 50,
            'final_amount' => 50,
        ]);

        $this->assertEquals($customer->id, $order->customer_id);

        $customer->forceDelete();

        $order->refresh();
        $this->assertNull($order->customer_id);
    }

    public function test_set_null_on_delete_user_on_stock_movements(): void
    {
        $category = ProductCategory::create(['name' => 'Cat SM User', 'code' => 'CAT-SMU']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'SM User Prod',
            'sku' => 'SKU-SMU-01',
            'cost_price' => 10,
            'selling_price' => 20,
        ]);
        $user = User::create(['name' => 'SM Actor User', 'email' => 'sm_actor@test.com', 'password' => 'secret', 'role' => 'admin']);

        $movement = StockMovement::create([
            'product_id' => $product->id,
            'type' => 'import',
            'quantity_change' => 20,
            'quantity_before' => 0,
            'quantity_after' => 20,
            'user_id' => $user->id,
        ]);

        $this->assertEquals($user->id, $movement->user_id);

        $user->forceDelete();

        $movement->refresh();
        $this->assertNull($movement->user_id);
    }

    // =========================================================================
    // 2. UUID GENERATION & IMMUTABILITY ACROSS ALL 17 MODELS
    // =========================================================================

    public function test_uuid_generation_and_uniqueness_across_all_17_models(): void
    {
        $allGeneratedUuids = [];

        // 1. User
        for ($i = 0; $i < 10; $i++) {
            $m = User::create([
                'name' => "User {$i}",
                'email' => "user{$i}@bulk.com",
                'password' => 'secret',
                'role' => $i % 2 === 0 ? 'admin' : 'cashier',
            ]);
            $this->assertTrue(Str::isUuid($m->id), "User ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 2. ProductCategory
        for ($i = 0; $i < 10; $i++) {
            $m = ProductCategory::create([
                'name' => "Category {$i}",
                'code' => "CAT-BULK-{$i}",
            ]);
            $this->assertTrue(Str::isUuid($m->id), "ProductCategory ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 3. Attribute
        for ($i = 0; $i < 10; $i++) {
            $m = Attribute::create([
                'name' => "Attribute {$i}",
                'code' => "ATTR-BULK-{$i}",
            ]);
            $this->assertTrue(Str::isUuid($m->id), "Attribute ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 4. AttributeValue
        $firstAttr = Attribute::first();
        for ($i = 0; $i < 10; $i++) {
            $m = AttributeValue::create([
                'attribute_id' => $firstAttr->id,
                'value' => "Value {$i}",
                'code' => "VAL-BULK-{$i}",
            ]);
            $this->assertTrue(Str::isUuid($m->id), "AttributeValue ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 5. Product
        $firstCat = ProductCategory::first();
        for ($i = 0; $i < 10; $i++) {
            $m = Product::create([
                'category_id' => $firstCat->id,
                'name' => "Product {$i}",
                'sku' => "SKU-BULK-{$i}",
                'cost_price' => 10 + $i,
                'selling_price' => 20 + $i,
            ]);
            $this->assertTrue(Str::isUuid($m->id), "Product ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 6. ProductAttribute (Composite Pivot)
        $firstProd = Product::first();
        $prodAttr = ProductAttribute::create([
            'product_id' => $firstProd->id,
            'attribute_id' => $firstAttr->id,
        ]);
        $this->assertEquals($firstProd->id, $prodAttr->product_id);
        $this->assertEquals($firstAttr->id, $prodAttr->attribute_id);

        // 7. ProductVariant
        for ($i = 0; $i < 10; $i++) {
            $m = ProductVariant::create([
                'product_id' => $firstProd->id,
                'name' => "Variant {$i}",
                'sku' => "SKU-VAR-BULK-{$i}",
            ]);
            $this->assertTrue(Str::isUuid($m->id), "ProductVariant ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 8. VariantAttributeValue (Composite Pivot)
        $firstVar = ProductVariant::first();
        $firstVal = AttributeValue::first();
        $varAttrVal = VariantAttributeValue::create([
            'variant_id' => $firstVar->id,
            'attribute_value_id' => $firstVal->id,
        ]);
        $this->assertEquals($firstVar->id, $varAttrVal->variant_id);
        $this->assertEquals($firstVal->id, $varAttrVal->attribute_value_id);

        // 9. StockMovement
        $firstUser = User::first();
        for ($i = 0; $i < 10; $i++) {
            $m = StockMovement::create([
                'product_id' => $firstProd->id,
                'variant_id' => $firstVar->id,
                'type' => 'import',
                'quantity_change' => 10 + $i,
                'quantity_before' => 0,
                'quantity_after' => 10 + $i,
                'user_id' => $firstUser->id,
            ]);
            $this->assertTrue(Str::isUuid($m->id), "StockMovement ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 10. SalesChannel
        for ($i = 0; $i < 5; $i++) {
            $m = SalesChannel::create([
                'name' => "Channel {$i}",
                'code' => "CHAN-BULK-{$i}",
                'type' => 'pos',
            ]);
            $this->assertTrue(Str::isUuid($m->id), "SalesChannel ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 11. Customer
        for ($i = 0; $i < 10; $i++) {
            $m = Customer::create([
                'name' => "Customer {$i}",
                'email' => "customer{$i}@bulk.com",
                'phone' => "081234567{$i}",
            ]);
            $this->assertTrue(Str::isUuid($m->id), "Customer ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 12. Order
        $firstChan = SalesChannel::first();
        $firstCust = Customer::first();
        for ($i = 0; $i < 10; $i++) {
            $m = Order::create([
                'order_number' => "ORD-BULK-{$i}",
                'sales_channel_id' => $firstChan->id,
                'customer_id' => $firstCust->id,
                'user_id' => $firstUser->id,
                'total_amount' => 100,
                'final_amount' => 100,
            ]);
            $this->assertTrue(Str::isUuid($m->id), "Order ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 13. OrderItem
        $firstOrder = Order::first();
        for ($i = 0; $i < 10; $i++) {
            $m = OrderItem::create([
                'order_id' => $firstOrder->id,
                'product_id' => $firstProd->id,
                'variant_id' => $firstVar->id,
                'quantity' => 1,
                'unit_price' => 10,
                'subtotal' => 10,
                'final_amount' => 10,
            ]);
            $this->assertTrue(Str::isUuid($m->id), "OrderItem ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 14. Payment
        for ($i = 0; $i < 10; $i++) {
            $m = Payment::create([
                'order_id' => $firstOrder->id,
                'payment_method' => 'cash',
                'amount' => 10,
                'status' => 'completed',
            ]);
            $this->assertTrue(Str::isUuid($m->id), "Payment ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 15. RestockSession
        for ($i = 0; $i < 5; $i++) {
            $m = RestockSession::create([
                'session_code' => "RESTOCK-BULK-{$i}",
                'user_id' => $firstUser->id,
                'status' => 'pending',
                'total_cost' => 500,
            ]);
            $this->assertTrue(Str::isUuid($m->id), "RestockSession ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 16. RestockDetail
        $firstSession = RestockSession::first();
        for ($i = 0; $i < 10; $i++) {
            $m = RestockDetail::create([
                'restock_session_id' => $firstSession->id,
                'product_id' => $firstProd->id,
                'variant_id' => $firstVar->id,
                'quantity' => 5,
                'unit_cost' => 10,
                'total_cost' => 50,
            ]);
            $this->assertTrue(Str::isUuid($m->id), "RestockDetail ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // 17. Expense
        for ($i = 0; $i < 10; $i++) {
            $m = Expense::create([
                'user_id' => $firstUser->id,
                'title' => "Expense {$i}",
                'amount' => 100 + $i,
                'category' => 'operations',
                'expense_date' => now()->toDateString(),
            ]);
            $this->assertTrue(Str::isUuid($m->id), "Expense ID is not UUID: {$m->id}");
            $allGeneratedUuids[] = $m->id;
        }

        // Uniqueness verification across all models
        $totalCount = count($allGeneratedUuids);
        $uniqueCount = count(array_unique($allGeneratedUuids));
        $this->assertEquals($totalCount, $uniqueCount, "UUID collisions detected! Total: {$totalCount}, Unique: {$uniqueCount}");
        $this->assertGreaterThan(100, $totalCount);
    }

    // =========================================================================
    // 3. MIGRATION ROLLBACK & REFRESH STRESS TEST
    // =========================================================================

    public function test_migration_rollback_step_by_step_and_integrity(): void
    {
        $tables = [
            'expenses',
            'restock_details',
            'restock_sessions',
            'payments',
            'order_items',
            'orders',
            'customers',
            'sales_channels',
            'stock_movements',
            'variant_attribute_values',
            'product_variants',
            'product_attributes',
            'products',
            'attribute_values',
            'attributes',
            'product_categories',
            'users',
        ];

        // Ensure all tables are present initially
        foreach ($tables as $tbl) {
            $this->assertTrue(Schema::hasTable($tbl), "Initial check: table {$tbl} should exist.");
        }

        // Rollback all migration steps dynamically
        $migrationCount = count(\Illuminate\Support\Facades\File::files(database_path('migrations')));
        $exitCode = Artisan::call('migrate:rollback', ['--step' => $migrationCount]);
        $this->assertEquals(0, $exitCode, "migrate:rollback --step={$migrationCount} failed");

        // Verify all 17 tables are completely dropped
        foreach ($tables as $tbl) {
            $this->assertFalse(Schema::hasTable($tbl), "After rollback: table {$tbl} should NOT exist.");
        }

        // Re-run migrate
        $migrateExitCode = Artisan::call('migrate');
        $this->assertEquals(0, $migrateExitCode, 'migrate re-run failed');

        // Verify all 17 tables are restored
        foreach ($tables as $tbl) {
            $this->assertTrue(Schema::hasTable($tbl), "After re-migrate: table {$tbl} should exist.");
        }
    }

    // =========================================================================
    // 4. CHECK CONSTRAINT ON STOCK MOVEMENTS (quantity_change != 0)
    // =========================================================================

    public function test_stock_movement_quantity_change_zero_constraint(): void
    {
        $category = ProductCategory::create(['name' => 'Cat 4', 'code' => 'CAT-4']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Zero Qty Test Product',
            'sku' => 'SKU-ZERO-1',
            'cost_price' => 10,
            'selling_price' => 20,
        ]);

        $driver = DB::getDriverName();

        if (in_array($driver, ['pgsql', 'mysql'])) {
            $this->expectException(QueryException::class);
            StockMovement::create([
                'product_id' => $product->id,
                'type' => 'adjustment',
                'quantity_change' => 0,
                'quantity_before' => 10,
                'quantity_after' => 10,
            ]);
        } else {
            // SQLite driver: constraint statement was skipped during migration on SQLite
            $movement = StockMovement::create([
                'product_id' => $product->id,
                'type' => 'adjustment',
                'quantity_change' => 0,
                'quantity_before' => 10,
                'quantity_after' => 10,
            ]);
            $this->assertEquals(0, $movement->quantity_change);
        }
    }
}
