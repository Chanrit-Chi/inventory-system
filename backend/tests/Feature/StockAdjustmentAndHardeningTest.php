<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\CheckoutService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockAdjustmentAndHardeningTest extends TestCase
{
    use DatabaseMigrations;

    private User $user;
    private ProductVariant $variant;
    private SalesChannel $channel;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->user = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin_test@test.com',
            'password'  => Hash::make('password123'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $category = ProductCategory::create([
            'name' => 'General Category',
            'code' => 'GEN-CAT',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Test Product',
            'sku'           => 'PROD-SKU-1',
            'cost_price'    => 10,
            'selling_price' => 20,
            'is_active'     => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'VAR-SKU-1',
            'quantity_on_hand' => 50,
            'is_active'        => true,
        ]);

        $this->channel = SalesChannel::create([
            'name'      => 'Main POS',
            'code'      => 'POS-MAIN',
            'type'      => 'POS',
            'is_active' => true,
        ]);
    }

    public function test_stock_adjustment_successful_audit_and_ledger(): void
    {
        Sanctum::actingAs($this->user);

        $payload = [
            'variant_id'       => $this->variant->id,
            'current_quantity' => 50,
            'new_quantity'     => 45,
            'difference'       => -5,
            'reason'           => 'Damaged',
            'notes'            => 'Water damage on shelf',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'variant_id'   => $this->variant->id,
                    'new_quantity' => 45,
                    'difference'   => -5,
                    'reason'       => 'Damaged',
                ],
                'message' => 'Stock adjusted successfully.',
            ]);

        $this->variant->refresh();
        $this->assertEquals(45, $this->variant->quantity_on_hand);

        $movement = StockMovement::where('variant_id', $this->variant->id)->latest()->first();
        $this->assertNotNull($movement);
        $this->assertEquals('DAMAGE', $movement->movement_type);
        $this->assertEquals(-5, $movement->quantity_change);
        $this->assertEquals(50, $movement->quantity_before);
        $this->assertEquals(45, $movement->quantity_after);
        $this->assertEquals($this->user->id, $movement->user_id);
    }

    public function test_stock_adjustment_all_reason_mappings(): void
    {
        Sanctum::actingAs($this->user);

        $reasonMap = [
            'Audit'     => 'ADJUSTMENT',
            'Damaged'   => 'DAMAGE',
            'Restock'   => 'RESTOCK',
            'Return'    => 'RETURN',
            'Shrinkage' => 'SHRINKAGE',
        ];

        $currentQty = $this->variant->quantity_on_hand;
        foreach ($reasonMap as $reason => $expectedType) {
            $newQty = $currentQty + 2;
            $payload = [
                'variant_id'       => $this->variant->id,
                'current_quantity' => $currentQty,
                'new_quantity'     => $newQty,
                'difference'       => 2,
                'reason'           => $reason,
            ];

            $response = $this->postJson('/api/v1/inventory/adjust', $payload);
            $response->assertStatus(200);

            $this->variant->refresh();
            $this->assertEquals($newQty, $this->variant->quantity_on_hand);

            $movement = StockMovement::where('variant_id', $this->variant->id)
                ->where('movement_type', $expectedType)
                ->latest()
                ->first();

            $this->assertNotNull($movement, "Failed asserting movement exists for reason {$reason}");
            $this->assertEquals($expectedType, $movement->movement_type);
            $this->assertEquals(2, $movement->quantity_change);
            $this->assertEquals($currentQty, $movement->quantity_before);
            $this->assertEquals($newQty, $movement->quantity_after);

            $currentQty = $newQty;
        }
    }

    public function test_stock_adjustment_validation_rules(): void
    {
        Sanctum::actingAs($this->user);

        // Invalid reason
        $response = $this->postJson('/api/v1/inventory/adjust', [
            'variant_id'       => $this->variant->id,
            'current_quantity' => 50,
            'new_quantity'     => 40,
            'difference'       => -10,
            'reason'           => 'InvalidReason',
        ]);
        $response->assertStatus(422)
            ->assertJson(['success' => false]);

        // Negative quantity
        $response = $this->postJson('/api/v1/inventory/adjust', [
            'variant_id'       => $this->variant->id,
            'current_quantity' => 50,
            'new_quantity'     => -5,
            'difference'       => -55,
            'reason'           => 'Damaged',
        ]);
        $response->assertStatus(422)
            ->assertJson(['success' => false]);

        // Missing variant_id
        $response = $this->postJson('/api/v1/inventory/adjust', [
            'current_quantity' => 50,
            'new_quantity'     => 40,
            'difference'       => -10,
            'reason'           => 'Damaged',
        ]);
        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_stock_adjustment_succeeds_without_current_quantity_or_difference(): void
    {
        Sanctum::actingAs($this->user);

        // Minimal payload without current_quantity and difference
        $payload = [
            'variant_id'   => $this->variant->id,
            'new_quantity' => 35,
            'reason'       => 'Shrinkage',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'variant_id'   => $this->variant->id,
                    'new_quantity' => 35,
                    'difference'   => -15,
                    'reason'       => 'Shrinkage',
                ],
                'message' => 'Stock adjusted successfully.',
            ]);

        $this->variant->refresh();
        $this->assertEquals(35, $this->variant->quantity_on_hand);
    }

    public function test_audit_log_endpoint_returns_correct_fields(): void
    {
        Sanctum::actingAs($this->user);

        // Create a stock movement
        StockMovement::create([
            'variant_id'      => $this->variant->id,
            'product_id'      => $this->variant->product_id,
            'movement_type'   => 'ADJUSTMENT',
            'quantity_before' => 50,
            'quantity_after'  => 40,
            'quantity_change' => -10,
            'reference_id'    => 'ADJ-TEST-1',
            'notes'           => 'Cycle count discrepancy',
            'user_id'         => $this->user->id,
            'created_by'      => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/audit-logs');
        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $firstLog = $data[0];
        $this->assertArrayHasKey('id', $firstLog);
        $this->assertArrayHasKey('action', $firstLog);
        $this->assertArrayHasKey('target', $firstLog);
        $this->assertArrayHasKey('by', $firstLog);
        $this->assertArrayHasKey('time', $firstLog);
        $this->assertEquals($this->user->name, $firstLog['by']);
        $this->assertStringContainsString('-10', $firstLog['target']);
    }

    public function test_health_check_endpoint(): void
    {
        $response = $this->getJson('/api/v1/health');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'status' => 'healthy',
                ],
            ]);
    }

    public function test_checkout_idempotency_and_stock_locking(): void
    {
        Sanctum::actingAs($this->user);

        $v2 = ProductVariant::create([
            'product_id'       => $this->variant->product_id,
            'sku'              => 'VAR-SKU-2',
            'quantity_on_hand' => 30,
            'is_active'        => true,
        ]);

        $payload = [
            'client_mutation_id' => 'MUT-TEST-12345',
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 100.0,
            'items'              => [
                ['variant_id' => $v2->id, 'quantity' => 2, 'unit_price' => 25.0],
                ['variant_id' => $this->variant->id, 'quantity' => 1, 'unit_price' => 50.0],
            ],
        ];

        $checkoutService = app(CheckoutService::class);
        $order1 = $checkoutService->checkout($payload);
        $this->assertNotNull($order1);
        $this->assertEquals('MUT-TEST-12345', $order1->client_mutation_id);

        $this->variant->refresh();
        $v2->refresh();
        $this->assertEquals(49, $this->variant->quantity_on_hand);
        $this->assertEquals(28, $v2->quantity_on_hand);

        // Replay exact same mutation ID - should return same order without double decrement
        $order2 = $checkoutService->checkout($payload);
        $this->assertEquals($order1->id, $order2->id);

        $this->variant->refresh();
        $v2->refresh();
        $this->assertEquals(49, $this->variant->quantity_on_hand);
        $this->assertEquals(28, $v2->quantity_on_hand);
    }
}
