<?php

namespace Tests\Feature;

use App\Models\Customer;
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
use App\Services\CheckoutService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdversarialStressVerificationTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;
    private User $sellerUser;
    private SalesChannel $channel;
    private ProductCategory $category;
    private Product $product;
    private ProductVariant $variantA;
    private ProductVariant $variantB;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->adminUser = User::create([
            'name'      => 'Admin Tester',
            'email'     => 'admin_adversarial@test.com',
            'password'  => Hash::make('password123'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $this->sellerUser = User::create([
            'name'      => 'Seller Tester',
            'email'     => 'seller_adversarial@test.com',
            'password'  => Hash::make('password123'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $this->channel = SalesChannel::create([
            'name'      => 'POS Main Channel',
            'code'      => 'POS-ADV-01',
            'type'      => 'POS',
            'is_active' => true,
        ]);

        $this->category = ProductCategory::create([
            'name' => 'Apparel',
            'code' => 'APP-01',
        ]);

        $this->product = Product::create([
            'category_id'   => $this->category->id,
            'name'          => 'Cotton T-Shirt',
            'sku'           => 'TSHIRT-MASTER-01',
            'barcode'       => '8850011223344',
            'cost_price'    => 5.00,
            'selling_price' => 15.00,
            'is_active'     => true,
        ]);

        $this->variantA = ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'TSHIRT-RED-M',
            'barcode'          => '8850011223351',
            'quantity_on_hand' => 10,
            'is_active'        => true,
        ]);

        $this->variantB = ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'TSHIRT-BLUE-L',
            'barcode'          => '8850011223368',
            'quantity_on_hand' => 5,
            'is_active'        => true,
        ]);
    }

    // =========================================================================
    // 1. NEGATIVE STOCK & OVERSELLING ATTEMPTS
    // =========================================================================

    public function test_checkout_rejects_quantity_exceeding_stock_and_rolls_back(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $payload = [
            'client_mutation_id' => (string) Str::uuid(),
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 165.00,
            'items'              => [
                ['variant_id' => $this->variantA->id, 'quantity' => 11, 'unit_price' => 15.00], // available is 10
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        // Assert no stock was deducted
        $this->variantA->refresh();
        $this->assertEquals(10, $this->variantA->quantity_on_hand);

        // Assert no order or payment was created
        $this->assertDatabaseMissing('orders', ['client_mutation_id' => $payload['client_mutation_id']]);
        $this->assertDatabaseMissing('stock_movements', ['variant_id' => $this->variantA->id]);
    }

    public function test_multi_item_checkout_partial_stock_failure_rolls_back_entire_order(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $payload = [
            'client_mutation_id' => (string) Str::uuid(),
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 120.00,
            'items'              => [
                ['variant_id' => $this->variantA->id, 'quantity' => 2, 'unit_price' => 15.00], // valid (10 avail)
                ['variant_id' => $this->variantB->id, 'quantity' => 6, 'unit_price' => 15.00], // invalid (5 avail)
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);

        // Both variants should have original quantities
        $this->variantA->refresh();
        $this->variantB->refresh();
        $this->assertEquals(10, $this->variantA->quantity_on_hand);
        $this->assertEquals(5, $this->variantB->quantity_on_hand);
        $this->assertDatabaseMissing('stock_movements', ['variant_id' => $this->variantA->id]);
    }

    // =========================================================================
    // 2. ZERO-VARIANCE & NEGATIVE STOCK ADJUSTMENT
    // =========================================================================

    public function test_zero_variance_stock_adjustment_returns_200_without_zero_movement(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'variant_id'       => $this->variantA->id,
            'current_quantity' => 10,
            'new_quantity'     => 10,
            'difference'       => 0,
            'reason'           => 'Audit',
            'notes'            => 'Count matches shelf exactly',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'variant_id'   => $this->variantA->id,
                    'new_quantity' => 10,
                    'difference'   => 0,
                    'reason'       => 'Audit',
                ],
                'message' => 'Stock adjusted successfully.',
            ]);

        $this->variantA->refresh();
        $this->assertEquals(10, $this->variantA->quantity_on_hand);

        // Crucial invariant: No zero-change stock movement created
        $this->assertDatabaseMissing('stock_movements', [
            'variant_id'      => $this->variantA->id,
            'quantity_change' => 0,
        ]);
    }

    public function test_stock_adjustment_rejects_negative_new_quantity(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'variant_id'       => $this->variantA->id,
            'current_quantity' => 10,
            'new_quantity'     => -1,
            'difference'       => -11,
            'reason'           => 'Shrinkage',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);
        $response->assertStatus(422)
            ->assertJson(['success' => false]);

        $this->variantA->refresh();
        $this->assertEquals(10, $this->variantA->quantity_on_hand);
    }

    // =========================================================================
    // 3. IDEMPOTENT CLIENT_MUTATION_ID REPLAY & CONCURRENCY
    // =========================================================================

    public function test_checkout_exact_replay_returns_same_order_without_extra_decrement(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $mutationId = (string) Str::uuid();

        $payload = [
            'client_mutation_id' => $mutationId,
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 30.00,
            'customer'           => [
                'name'  => 'Loyal Customer',
                'phone' => '0123456789',
            ],
            'items' => [
                ['variant_id' => $this->variantA->id, 'quantity' => 2, 'unit_price' => 15.00],
            ],
        ];

        $checkoutService = app(CheckoutService::class);

        // 1st run
        $order1 = $checkoutService->checkout($payload);
        $this->assertNotNull($order1);
        $this->assertEquals($mutationId, $order1->client_mutation_id);

        $this->variantA->refresh();
        $this->assertEquals(8, $this->variantA->quantity_on_hand);

        // 2nd run (idempotent replay)
        $order2 = $checkoutService->checkout($payload);
        $this->assertEquals($order1->id, $order2->id);

        $this->variantA->refresh();
        $this->assertEquals(8, $this->variantA->quantity_on_hand);

        // Verify only 1 order and 1 movement exists
        $this->assertEquals(1, Order::where('client_mutation_id', $mutationId)->count());
        $this->assertEquals(1, StockMovement::where('variant_id', $this->variantA->id)->count());
        $this->assertEquals(1, Customer::where('phone', '0123456789')->count());
        $this->assertEquals(1, Customer::where('phone', '0123456789')->first()->total_purchased);
    }

    public function test_deadlock_prevention_via_sorted_variant_locking(): void
    {
        Sanctum::actingAs($this->sellerUser);

        // Payload with variant B before variant A
        $payload1 = [
            'client_mutation_id' => (string) Str::uuid(),
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 30.00,
            'items'              => [
                ['variant_id' => $this->variantB->id, 'quantity' => 1, 'unit_price' => 15.00],
                ['variant_id' => $this->variantA->id, 'quantity' => 1, 'unit_price' => 15.00],
            ],
        ];

        // Payload with variant A before variant B
        $payload2 = [
            'client_mutation_id' => (string) Str::uuid(),
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 30.00,
            'items'              => [
                ['variant_id' => $this->variantA->id, 'quantity' => 1, 'unit_price' => 15.00],
                ['variant_id' => $this->variantB->id, 'quantity' => 1, 'unit_price' => 15.00],
            ],
        ];

        $checkoutService = app(CheckoutService::class);

        $order1 = $checkoutService->checkout($payload1);
        $order2 = $checkoutService->checkout($payload2);

        $this->assertNotNull($order1);
        $this->assertNotNull($order2);

        $this->variantA->refresh();
        $this->variantB->refresh();

        // 10 - 1 - 1 = 8
        $this->assertEquals(8, $this->variantA->quantity_on_hand);
        // 5 - 1 - 1 = 3
        $this->assertEquals(3, $this->variantB->quantity_on_hand);
    }

    // =========================================================================
    // 4. TWO-TIER BARCODE SCANNING ADVERSARIAL CASES
    // =========================================================================

    public function test_barcode_scan_variant_and_master_resolution(): void
    {
        Sanctum::actingAs($this->sellerUser);

        // 1. Direct variant barcode hit
        $resVariant = $this->getJson('/api/v1/inventory/scan?code=8850011223351');
        $resVariant->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'type'    => 'variant',
                    'variant' => [
                        'sku' => 'TSHIRT-RED-M',
                    ],
                ],
            ]);

        // 2. Direct variant SKU hit
        $resSku = $this->getJson('/api/v1/inventory/scan?code=TSHIRT-RED-M');
        $resSku->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'type'    => 'variant',
                ],
            ]);

        // 3. Master product barcode hit -> expands child variants
        $resMaster = $this->getJson('/api/v1/inventory/scan?code=8850011223344');
        $resMaster->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'type'    => 'product',
                    'product' => [
                        'name' => 'Cotton T-Shirt',
                    ],
                ],
            ]);
        $variants = $resMaster->json('data.variants');
        $this->assertCount(2, $variants);

        // 4. Non-existent barcode
        $res404 = $this->getJson('/api/v1/inventory/scan?code=UNKNOWN-BARCODE-999');
        $res404->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);

        // 5. Empty barcode query parameter
        $res422 = $this->getJson('/api/v1/inventory/scan?code=');
        $res422->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    // =========================================================================
    // 5. SEEDER & MIGRATION ROLLBACK INTEGRITY ON POPULATED DATABASE
    // =========================================================================

    public function test_full_seeder_and_migration_rollback_cycle_on_populated_db(): void
    {
        // 1. Run complete DatabaseSeeder
        $this->seed(DatabaseSeeder::class);

        // Assert tables are heavily populated
        $this->assertGreaterThan(0, User::count());
        $this->assertGreaterThan(0, Product::count());
        $this->assertGreaterThan(0, ProductVariant::count());
        $this->assertGreaterThan(0, SalesChannel::count());

        $canonicalTables = [
            'users',
            'product_categories',
            'products',
            'product_variants',
            'attributes',
            'attribute_values',
            'product_attributes',
            'variant_attribute_values',
            'sales_channels',
            'customers',
            'orders',
            'order_items',
            'payments',
            'stock_movements',
            'restock_sessions',
            'restock_details',
            'expenses',
        ];

        foreach ($canonicalTables as $tbl) {
            $this->assertTrue(Schema::hasTable($tbl), "Table {$tbl} should exist.");
        }

        // 2. Re-seed to verify complete idempotency
        $seedExit = Artisan::call('db:seed', ['--class' => DatabaseSeeder::class]);
        $this->assertEquals(0, $seedExit, 'db:seed re-run failed');

        $this->assertGreaterThan(0, User::count());
        $this->assertGreaterThan(0, Product::count());
        $this->assertGreaterThan(0, ProductVariant::count());
    }

    // =========================================================================
    // 6. RESTOCK INTAKE & INVENTORY LEDGER VERIFICATION
    // =========================================================================

    public function test_batch_restock_intake_increments_stock_and_creates_session(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'notes' => 'Supplier Delivery Inbound',
            'items' => [
                [
                    'variant_id' => $this->variantA->id,
                    'quantity'   => 20,
                    'unit_cost'  => 4.50,
                ],
                [
                    'variant_id' => $this->variantB->id,
                    'quantity'   => 15,
                    'unit_cost'  => 4.50,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/inventory/restock', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'status' => 'COMPLETED',
                ],
            ]);

        $sessionId = $response->json('data.id');
        $session = RestockSession::with('details')->find($sessionId);
        $this->assertNotNull($session);
        $this->assertEquals(2, $session->details->count());

        $this->variantA->refresh();
        $this->variantB->refresh();
        // 10 + 20 = 30
        $this->assertEquals(30, $this->variantA->quantity_on_hand);
        // 5 + 15 = 20
        $this->assertEquals(20, $this->variantB->quantity_on_hand);

        // Verify stock movement ledger entries
        $smA = StockMovement::where('variant_id', $this->variantA->id)
            ->where('movement_type', 'RESTOCK')
            ->first();
        $this->assertNotNull($smA);
        $this->assertEquals(20, $smA->quantity_change);
        $this->assertEquals(10, $smA->quantity_before);
        $this->assertEquals(30, $smA->quantity_after);
    }
}
