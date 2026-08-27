<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\User;
use App\Services\CheckoutService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderCancellationIdempotencyTest extends TestCase
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
            'name' => 'Beverages',
            'code' => 'BEV',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Iced Coffee',
            'sku'           => 'COFFEE-1',
            'cost_price'    => 1.5,
            'selling_price' => 3.0,
            'is_active'     => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'COFFEE-VAR-1',
            'quantity_on_hand' => 5,
            'is_active'        => true,
        ]);

        $this->channel = SalesChannel::create([
            'name'      => 'POS Counter',
            'code'      => 'POS-1',
            'type'      => 'POS',
            'is_active' => true,
        ]);
    }

    public function test_order_cancellation_restores_stock_and_is_strictly_idempotent(): void
    {
        Sanctum::actingAs($this->user);

        // 1. Checkout 5 items (max stock) -> stock becomes 0
        $checkoutService = app(CheckoutService::class);
        $order = $checkoutService->checkout([
            'client_mutation_id' => 'test-mutation-001',
            'channel_id'     => $this->channel->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'Cash',
            'payment_amount' => 15.0,
            'status'         => 'completed',
            'items'          => [
                [
                    'variant_id' => $this->variant->id,
                    'quantity'   => 5,
                    'unit_price' => 3.0,
                ],
            ],
        ]);

        $this->variant->refresh();
        $this->assertEquals(0, $this->variant->quantity_on_hand, 'Stock must be 0 after selling 5 items.');

        // 2. Cancel order for the first time -> status becomes cancelled, stock restored to 5
        $res1 = $this->patchJson("/api/v1/orders/{$order->id}/status", [
            'status' => 'cancelled',
        ]);

        $res1->assertStatus(200);
        $this->variant->refresh();
        $this->assertEquals(5, $this->variant->quantity_on_hand, 'Stock must be restored to 5 upon cancellation.');

        // 3. User clicks Cancel again (or repeated network call) -> Must NOT increase stock again!
        $res2 = $this->patchJson("/api/v1/orders/{$order->id}/status", [
            'status' => 'cancelled',
        ]);

        $res2->assertStatus(200);
        $this->variant->refresh();
        $this->assertEquals(5, $this->variant->quantity_on_hand, 'Stock must REMAIN 5 and not increase repeatedly.');

        // 4. Repeated clicks via general order update endpoint
        $res3 = $this->putJson("/api/v1/orders/{$order->id}", [
            'status' => 'cancelled',
        ]);
        $this->variant->refresh();
        $this->assertEquals(5, $this->variant->quantity_on_hand, 'Stock must stay 5 after multiple cancel calls.');

        // 5. Cannot transition a cancelled order back to pending or completed
        $res4 = $this->patchJson("/api/v1/orders/{$order->id}/status", [
            'status' => 'pending',
        ]);
        $res4->assertStatus(422);

        $res5 = $this->patchJson("/api/v1/orders/{$order->id}/status", [
            'status' => 'completed',
        ]);
        $res5->assertStatus(422);
    }
}
