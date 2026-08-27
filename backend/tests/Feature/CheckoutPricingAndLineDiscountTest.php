<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CheckoutPricingAndLineDiscountTest extends TestCase
{
    use RefreshDatabase;

    private User $cashierUser;
    private SalesChannel $channel;
    private Product $product;
    private ProductVariant $variant1;
    private ProductVariant $variant2;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable('personal_access_tokens')) {
            $this->artisan('migrate', ['--path' => 'vendor/laravel/sanctum/database/migrations']);
        }

        $this->cashierUser = User::create([
            'name'             => 'Cashier Sokha',
            'email'            => 'sokha@pos.local',
            'password'         => Hash::make('Secret123!'),
            'role'             => 'CASHIER',
            'is_active'        => true,
            'permission_group' => 'Staff',
        ]);

        $this->channel = SalesChannel::create([
            'name'      => 'Main POS Register',
            'code'      => 'POS-01',
            'type'      => 'POS',
            'is_active' => true,
        ]);

        $category = ProductCategory::create([
            'name' => 'General Store',
            'code' => 'GEN',
        ]);

        $this->product = Product::create([
            'category_id'    => $category->id,
            'name'           => 'Wireless Mouse',
            'sku'            => 'PROD-WM-001',
            'barcode'        => '8859990001',
            'purchase_price' => 10.00,
            'selling_price'  => 25.00,
            'is_active'      => true,
        ]);

        $this->variant1 = ProductVariant::create([
            'product_id'       => $this->product->id,
            'name'             => 'Black',
            'sku'              => 'WM-BLK',
            'barcode'          => '8859990002',
            'cost_price'       => 10.00,
            'selling_price'    => 25.00,
            'quantity_on_hand' => 50,
            'is_active'        => true,
        ]);

        $this->variant2 = ProductVariant::create([
            'product_id'             => $this->product->id,
            'name'                   => 'White RGB',
            'sku'                    => 'WM-WHT-RGB',
            'barcode'                => '8859990003',
            'cost_price'             => 12.00,
            'selling_price'          => 25.00,
            'selling_price_override' => 30.00,
            'quantity_on_hand'       => 40,
            'is_active'              => true,
        ]);

        $this->customer = Customer::create([
            'name'  => 'Loyal Client',
            'phone' => '+85512999888',
        ]);
    }

    public function test_checkout_uses_effective_selling_price_when_client_omits_unit_price(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // variant1 (25.00 * 2 = 50.00) + variant2 override (30.00 * 1 = 30.00) = 80.00
        $payload = [
            'client_mutation_id' => 'MUT-TEST-PRICE-001',
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 80.00,
            'items'              => [
                [
                    'variant_id' => $this->variant1->id,
                    'quantity'   => 2,
                ],
                [
                    'variant_id' => $this->variant2->id,
                    'quantity'   => 1,
                ],
            ],
            'customer'           => [
                'name'  => $this->customer->name,
                'phone' => $this->customer->phone,
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'subtotal'     => '80.00',
                    'total_amount' => '80.00',
                    'status'       => 'COMPLETED',
                ],
            ]);

        $order = Order::where('client_mutation_id', 'MUT-TEST-PRICE-001')->firstOrFail();
        $this->assertEquals(80.00, (float) $order->total_amount);

        // Verify OrderItem line items
        $item1 = OrderItem::where('order_id', $order->id)->where('variant_id', $this->variant1->id)->firstOrFail();
        $this->assertEquals(25.00, (float) $item1->unit_price);
        $this->assertEquals(50.00, (float) $item1->subtotal);
        $this->assertEquals(50.00, (float) $item1->total_price);

        $item2 = OrderItem::where('order_id', $order->id)->where('variant_id', $this->variant2->id)->firstOrFail();
        $this->assertEquals(30.00, (float) $item2->unit_price);
        $this->assertEquals(30.00, (float) $item2->subtotal);
        $this->assertEquals(30.00, (float) $item2->total_price);
    }

    public function test_checkout_with_line_item_discounts(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // Item 1: (25.00 * 2) - 5.00 discount = 45.00
        // Item 2: (30.00 * 1) - 2.00 discount = 28.00
        // Total Subtotal = 73.00
        $payload = [
            'client_mutation_id' => 'MUT-TEST-LINE-DISC-002',
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'KHQR',
            'payment_amount'     => 73.00,
            'items'              => [
                [
                    'variant_id'      => $this->variant1->id,
                    'quantity'        => 2,
                    'discount_amount' => 5.00,
                ],
                [
                    'variant_id'      => $this->variant2->id,
                    'quantity'        => 1,
                    'discount_amount' => 2.00,
                ],
            ],
            'customer'           => [
                'name'  => $this->customer->name,
                'phone' => $this->customer->phone,
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'subtotal'     => '73.00',
                    'total_amount' => '73.00',
                    'status'       => 'COMPLETED',
                ],
            ]);

        $order = Order::where('client_mutation_id', 'MUT-TEST-LINE-DISC-002')->firstOrFail();

        $item1 = OrderItem::where('order_id', $order->id)->where('variant_id', $this->variant1->id)->firstOrFail();
        $this->assertEquals(25.00, (float) $item1->unit_price);
        $this->assertEquals(50.00, (float) $item1->subtotal);
        $this->assertEquals(5.00, (float) $item1->discount_amount);
        $this->assertEquals(45.00, (float) $item1->total_price);
        $this->assertEquals(45.00, (float) $item1->final_amount);

        $item2 = OrderItem::where('order_id', $order->id)->where('variant_id', $this->variant2->id)->firstOrFail();
        $this->assertEquals(30.00, (float) $item2->unit_price);
        $this->assertEquals(30.00, (float) $item2->subtotal);
        $this->assertEquals(2.00, (float) $item2->discount_amount);
        $this->assertEquals(28.00, (float) $item2->total_price);
        $this->assertEquals(28.00, (float) $item2->final_amount);
    }

    public function test_checkout_with_combined_line_discount_and_global_order_discount(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // Item 1: (25.00 * 2) - 5.00 = 45.00 subtotal
        // Global order discount = 10.00
        // Final total_amount = 35.00
        $payload = [
            'client_mutation_id' => 'MUT-TEST-COMBINED-003',
            'channel_id'         => $this->channel->id,
            'payment_method'     => 'CASH',
            'discount'           => 10.00,
            'payment_amount'     => 35.00,
            'items'              => [
                [
                    'variant_id'      => $this->variant1->id,
                    'quantity'        => 2,
                    'discount_amount' => 5.00,
                ],
            ],
            'customer'           => [
                'name'  => $this->customer->name,
                'phone' => $this->customer->phone,
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'subtotal'     => '45.00',
                    'discount'     => '10.00',
                    'total_amount' => '35.00',
                ],
            ]);

        // Stock decrement check
        $this->assertEquals(48, $this->variant1->fresh()->quantity_on_hand);

        // Stock movement ledger check
        $movement = StockMovement::where('variant_id', $this->variant1->id)->latest('created_at')->firstOrFail();
        $this->assertEquals('SALE', $movement->movement_type);
        $this->assertEquals(-2, $movement->quantity_change);
        $this->assertEquals(50, $movement->quantity_before);
        $this->assertEquals(48, $movement->quantity_after);
    }
}
