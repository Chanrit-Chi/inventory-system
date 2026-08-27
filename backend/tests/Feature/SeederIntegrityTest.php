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
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\RestockDetail;
use App\Models\RestockSession;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_executes_and_populates_all_domain_entities(): void
    {
        $this->seed(DatabaseSeeder::class);

        // Assert Users seeded
        $this->assertGreaterThanOrEqual(3, User::count());
        $this->assertDatabaseHas('users', ['email' => 'admin@inventory.local', 'role' => 'SUPER_ADMIN']);
        $this->assertDatabaseHas('users', ['email' => 'cashier1@inventory.local', 'role' => 'SELLER']);

        // Assert Sales Channels seeded
        $this->assertGreaterThanOrEqual(5, SalesChannel::count());
        $this->assertDatabaseHas('sales_channels', ['code' => 'POS-MAIN', 'type' => 'pos']);

        // Assert Product Categories seeded
        $this->assertGreaterThanOrEqual(4, ProductCategory::count());
        $this->assertDatabaseHas('product_categories', ['code' => 'CAT-APPAREL']);

        // Assert Attributes & Values seeded
        $this->assertGreaterThanOrEqual(3, Attribute::count());
        $this->assertGreaterThanOrEqual(10, AttributeValue::count());
        $this->assertDatabaseHas('attributes', ['code' => 'ATTR-SIZE']);
        $this->assertDatabaseHas('attribute_values', ['code' => 'SIZE-M']);

        // Assert Products, Variants & Stock Movements seeded
        $this->assertGreaterThanOrEqual(4, Product::count());
        $this->assertGreaterThanOrEqual(15, ProductVariant::count());
        $this->assertGreaterThanOrEqual(15, StockMovement::count());
        $this->assertDatabaseHas('products', ['sku' => 'PROD-TSHIRT-001']);
        $this->assertDatabaseHas('product_variants', ['sku' => 'TSHIRT-M-BLACK']);

        // Assert Customers seeded
        $this->assertGreaterThanOrEqual(4, Customer::count());
        $this->assertDatabaseHas('customers', ['phone' => '+85512345678']);

        // Assert Restock Sessions & Details seeded
        $this->assertGreaterThanOrEqual(2, RestockSession::count());
        $this->assertGreaterThanOrEqual(2, RestockDetail::count());
        $this->assertDatabaseHas('restock_sessions', ['session_code' => 'RST-202608-001']);

        // Assert Orders, Order Items & Payments seeded
        $this->assertGreaterThanOrEqual(3, Order::count());
        $this->assertGreaterThanOrEqual(3, OrderItem::count());
        $this->assertGreaterThanOrEqual(2, Payment::count());
        $this->assertDatabaseHas('orders', ['order_number' => 'ORD-20260818-0001']);
        $posOrder = Order::where('order_number', 'ORD-20260818-0001')->first();
        $this->assertNotNull($posOrder);
        $this->assertEquals('SELLER', $posOrder->user->role);

        // Assert Expenses seeded
        $this->assertGreaterThanOrEqual(5, Expense::count());
        $this->assertDatabaseHas('expenses', ['category' => 'Rent & Facility']);
    }
}
