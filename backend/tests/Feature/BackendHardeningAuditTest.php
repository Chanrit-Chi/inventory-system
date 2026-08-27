<?php

namespace Tests\Feature;

use App\Events\InvoicePaymentRecorded;
use App\Events\OrderPlaced;
use App\Events\OrderStatusChanged;
use App\Events\StockAdjusted;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\Quotation;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BackendHardeningAuditTest extends TestCase
{
    use RefreshDatabase;

    private User $cashierUser;
    private User $managerUser;
    private User $adminUser;
    private SalesChannel $channel;
    private ProductCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->channel = SalesChannel::create([
            'name' => 'Main POS',
            'code' => 'POS-MAIN',
            'type' => 'pos',
            'is_active' => true,
        ]);

        $this->category = ProductCategory::create([
            'name' => 'Beverages',
            'code' => 'BEV',
        ]);

        $this->cashierUser = User::create([
            'name'      => 'Cashier Staff',
            'email'     => 'cashier@store.local',
            'password'  => bcrypt('password'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $this->managerUser = User::create([
            'name'      => 'Store Manager',
            'email'     => 'manager@store.local',
            'password'  => bcrypt('password'),
            'role'      => 'MANAGER',
            'is_active' => true,
        ]);

        $this->adminUser = User::create([
            'name'      => 'System Admin',
            'email'     => 'admin@store.local',
            'password'  => bcrypt('password'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);
    }

    public function test_cashier_cannot_delete_invoice_or_quotation_but_manager_can(): void
    {
        $invoice = Invoice::create([
            'invoice_number' => 'INV-TEST-001',
            'customer_name'  => 'Test Customer',
            'total_amount'   => 100.00,
            'amount_paid'    => 0,
            'balance_due'    => 100.00,
            'status'         => 'SENT',
        ]);

        $quotation = Quotation::create([
            'quotation_number' => 'QTN-TEST-001',
            'customer_name'    => 'Test Customer',
            'total_amount'     => 100.00,
            'status'           => 'DRAFT',
        ]);

        // Cashier attempt deletion -> 403
        $this->actingAs($this->cashierUser, 'sanctum')
            ->deleteJson("/api/v1/invoices/{$invoice->id}")
            ->assertStatus(403);

        $this->actingAs($this->cashierUser, 'sanctum')
            ->deleteJson("/api/v1/quotations/{$quotation->id}")
            ->assertStatus(403);

        // Manager attempt deletion -> 200
        $this->actingAs($this->managerUser, 'sanctum')
            ->deleteJson("/api/v1/invoices/{$invoice->id}")
            ->assertStatus(200);

        $this->actingAs($this->managerUser, 'sanctum')
            ->deleteJson("/api/v1/quotations/{$quotation->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('invoices', ['id' => $invoice->id]);
        $this->assertSoftDeleted('quotations', ['id' => $quotation->id]);
    }

    public function test_cashier_cannot_cancel_order_without_permission_but_manager_can(): void
    {
        $order = Order::create([
            'order_number'       => 'ORD-CANCEL-001',
            'client_mutation_id' => 'MUT-CANCEL-001',
            'channel_id'         => $this->channel->id,
            'status'             => 'COMPLETED',
            'payment_status'     => 'PAID',
            'subtotal'           => 50.00,
            'total_amount'       => 50.00,
        ]);

        // Cashier attempt cancellation -> 403
        $this->actingAs($this->cashierUser, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", [
                'status' => 'CANCELLED',
                'notes'  => 'Unauthorized cashier cancellation attempt',
            ])
            ->assertStatus(403);

        // Manager attempt cancellation -> 200
        $this->actingAs($this->managerUser, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", [
                'status' => 'CANCELLED',
                'notes'  => 'Manager approved cancellation',
            ])
            ->assertStatus(200);

        $order->refresh();
        $this->assertEquals('cancelled', strtolower($order->status));
    }

    public function test_product_destroy_falls_back_to_deactivation_when_transaction_history_exists(): void
    {
        $product = Product::create([
            'name'           => 'Historical Product',
            'category_id'    => $this->category->id,
            'purchase_price' => 10.00,
            'selling_price'  => 20.00,
            'is_active'      => true,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'name'             => 'Standard',
            'sku'              => 'HIST-001',
            'selling_price'    => 20.00,
            'quantity_on_hand' => 10,
            'is_active'        => true,
        ]);

        // Create linked order item
        $order = Order::create([
            'order_number'   => 'ORD-HIST-001',
            'channel_id'     => $this->channel->id,
            'status'         => 'COMPLETED',
            'total_amount'   => 20.00,
        ]);

        OrderItem::create([
            'order_id'     => $order->id,
            'product_id'   => $product->id,
            'variant_id'   => $variant->id,
            'quantity'     => 1,
            'unit_price'   => 20.00,
            'total_price'  => 20.00,
            'subtotal'     => 20.00,
            'final_amount' => 20.00,
        ]);

        $this->actingAs($this->adminUser, 'sanctum')
            ->deleteJson("/api/v1/products/{$product->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.deactivated', true);

        $product->refresh();
        $variant->refresh();
        $this->assertFalse((bool)$product->is_active);
        $this->assertFalse((bool)$variant->is_active);
        $this->assertNull($product->deleted_at);
    }

    public function test_stock_adjustment_idempotency_with_client_mutation_id(): void
    {
        $product = Product::create([
            'name'           => 'Idempotent Item',
            'category_id'    => $this->category->id,
            'purchase_price' => 5.00,
            'selling_price'  => 10.00,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'name'             => 'Standard',
            'sku'              => 'IDEMP-001',
            'quantity_on_hand' => 10,
        ]);

        $payload = [
            'client_mutation_id' => 'MUT-ADJ-UNIQUE-12345',
            'variant_id'         => $variant->id,
            'new_quantity'       => 15,
            'reason'             => 'Audit',
            'notes'              => 'Recounted shelf inventory',
        ];

        // First adjustment
        $this->actingAs($this->managerUser, 'sanctum')
            ->postJson('/api/v1/inventory/adjust', $payload)
            ->assertStatus(200);

        $this->assertEquals(15, $variant->fresh()->quantity_on_hand);
        $this->assertDatabaseCount('stock_movements', 1);

        // Second adjustment with identical mutation key
        $this->actingAs($this->managerUser, 'sanctum')
            ->postJson('/api/v1/inventory/adjust', $payload)
            ->assertStatus(200);

        $this->assertEquals(15, $variant->fresh()->quantity_on_hand);
        // Ensure no duplicate stock movement created
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_invoice_soft_delete_cascades_to_payments_and_items(): void
    {
        $invoice = Invoice::create([
            'invoice_number' => 'INV-CASCADE-001',
            'customer_name'  => 'Cascade Customer',
            'total_amount'   => 150.00,
            'amount_paid'    => 50.00,
            'balance_due'    => 100.00,
            'status'         => 'PARTIAL',
        ]);

        $item = $invoice->items()->create([
            'product_name' => 'Widget A',
            'sku'          => 'WGT-A',
            'quantity'     => 3,
            'unit_price'   => 50.00,
            'total_price'  => 150.00,
        ]);

        $payment = $invoice->payments()->create([
            'amount'         => 50.00,
            'payment_method' => 'Cash',
            'paid_at'        => now(),
        ]);

        $this->actingAs($this->adminUser, 'sanctum')
            ->deleteJson("/api/v1/invoices/{$invoice->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('invoices', ['id' => $invoice->id]);
        $this->assertSoftDeleted('invoice_items', ['id' => $item->id]);
        $this->assertSoftDeleted('invoice_payments', ['id' => $payment->id]);
    }

    public function test_stock_movement_retains_soft_deleted_user_relation(): void
    {
        $user = User::create([
            'name'      => 'Departed Staff',
            'email'     => 'departed@store.local',
            'password'  => bcrypt('password'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $product = Product::create([
            'name'           => 'Audit Tracked Item',
            'purchase_price' => 5.00,
            'selling_price'  => 10.00,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'name'             => 'Standard',
            'sku'              => 'AUDIT-001',
            'quantity_on_hand' => 20,
        ]);

        $movement = StockMovement::create([
            'product_id'      => $product->id,
            'variant_id'      => $variant->id,
            'movement_type'   => 'ADJUSTMENT',
            'quantity_before' => 20,
            'quantity_after'  => 25,
            'quantity_change' => 5,
            'user_id'         => $user->id,
            'created_by'      => $user->id,
        ]);

        // Soft delete user
        $user->delete();
        $this->assertSoftDeleted('users', ['id' => $user->id]);

        $freshMovement = StockMovement::find($movement->id);
        $this->assertNotNull($freshMovement->user);
        $this->assertEquals('Departed Staff', $freshMovement->user->name);
        $this->assertNotNull($freshMovement->creator);
        $this->assertEquals('Departed Staff', $freshMovement->creator->name);
    }

    public function test_domain_events_dispatched_on_checkout_and_stock_adjustment(): void
    {
        Event::fake([
            OrderPlaced::class,
            StockAdjusted::class,
            InvoicePaymentRecorded::class,
        ]);

        $product = Product::create([
            'name'           => 'Event Item',
            'category_id'    => $this->category->id,
            'purchase_price' => 5.00,
            'selling_price'  => 10.00,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'name'             => 'Standard',
            'sku'              => 'EVENT-001',
            'quantity_on_hand' => 50,
        ]);

        // 1. Checkout -> OrderPlaced
        $this->actingAs($this->cashierUser, 'sanctum')
            ->postJson('/api/v1/orders/checkout', [
                'client_mutation_id' => 'MUT-EVT-001',
                'channel_id'         => $this->channel->id,
                'payment_method'     => 'Cash',
                'payment_amount'     => 10.00,
                'items'              => [
                    ['variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 10.00],
                ],
            ])
            ->assertStatus(201);

        Event::assertDispatched(OrderPlaced::class);

        // 2. Stock Adjustment -> StockAdjusted
        $this->actingAs($this->managerUser, 'sanctum')
            ->postJson('/api/v1/inventory/adjust', [
                'variant_id'   => $variant->id,
                'new_quantity' => 45,
                'reason'       => 'Damaged',
            ])
            ->assertStatus(200);

        Event::assertDispatched(StockAdjusted::class);

        // 3. Invoice Payment -> InvoicePaymentRecorded
        $invoice = Invoice::create([
            'invoice_number' => 'INV-EVT-001',
            'customer_name'  => 'Evt Customer',
            'total_amount'   => 100.00,
            'amount_paid'    => 0,
            'balance_due'    => 100.00,
            'status'         => 'SENT',
        ]);

        $this->actingAs($this->cashierUser, 'sanctum')
            ->postJson("/api/v1/invoices/{$invoice->id}/payments", [
                'amount'         => 50.00,
                'payment_method' => 'Cash',
            ])
            ->assertStatus(201);

        Event::assertDispatched(InvoicePaymentRecorded::class);
    }

    public function test_seller_with_orders_cancel_permission_can_cancel_order(): void
    {
        $role = \App\Models\Role::create([
            'name' => 'Privileged Cashier',
            'slug' => 'PRIV_CASHIER',
        ]);
        $perm = \App\Models\Permission::firstOrCreate([
            'slug'   => 'orders:cancel',
            'name'   => 'Cancel Orders',
            'module' => 'orders',
        ]);
        $role->permissions()->attach($perm->id);

        $customSeller = User::create([
            'name'      => 'Custom Seller',
            'email'     => 'custom_seller@store.local',
            'password'  => bcrypt('password'),
            'role'      => 'PRIV_CASHIER',
            'role_id'   => $role->id,
            'is_active' => true,
        ]);

        $order = Order::create([
            'order_number'       => 'ORD-PRIV-001',
            'client_mutation_id' => 'MUT-PRIV-001',
            'channel_id'         => $this->channel->id,
            'status'             => 'COMPLETED',
            'payment_status'     => 'PAID',
            'total_amount'       => 25.00,
        ]);

        $this->actingAs($customSeller, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", [
                'status' => 'CANCELLED',
                'notes'  => 'Privileged seller cancelled order',
            ])
            ->assertStatus(200);

        $this->assertEquals('cancelled', strtolower($order->fresh()->status));
    }

    public function test_product_update_form_request_validation(): void
    {
        $product = Product::create([
            'name'           => 'Valid Item',
            'category_id'    => $this->category->id,
            'purchase_price' => 10.00,
            'selling_price'  => 20.00,
        ]);

        // Negative price should fail with 422
        $this->actingAs($this->adminUser, 'sanctum')
            ->patchJson("/api/v1/products/{$product->id}", [
                'selling_price' => -5.00,
            ])
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        // Valid update succeeds with 200
        $this->actingAs($this->adminUser, 'sanctum')
            ->patchJson("/api/v1/products/{$product->id}", [
                'name'          => 'Updated Item Name',
                'selling_price' => 25.00,
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.product.name', 'Updated Item Name');
    }

    public function test_full_variant_lifecycle(): void
    {
        // 1. Create simple product
        $res = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/products', [
                'name'           => 'Multi T-Shirt',
                'category_id'    => $this->category->id,
                'purchase_price' => 10.00,
                'selling_price'  => 20.00,
                'stock'          => 15,
            ])
            ->assertStatus(201);

        $prodId = $res->json('data.id') ?? $res->json('data.product.id');

        // 2. Convert to variable product with multiple variants
        $updateRes = $this->actingAs($this->adminUser, 'sanctum')
            ->putJson("/api/v1/products/{$prodId}", [
                'name'     => 'Multi T-Shirt',
                'variants' => [
                    [
                        'name'          => 'Red / Small',
                        'sku'           => 'TSHIRT-RED-S',
                        'selling_price' => 22.00,
                        'stock'         => 8,
                    ],
                    [
                        'name'          => 'Blue / Large',
                        'sku'           => 'TSHIRT-BLU-L',
                        'selling_price' => 24.00,
                        'stock'         => 12,
                    ],
                ],
            ])
            ->assertStatus(200);

        $this->assertCount(2, $updateRes->json('data.variants'));
        $this->assertDatabaseHas('product_variants', ['sku' => 'TSHIRT-RED-S', 'quantity_on_hand' => 8]);
        $this->assertDatabaseHas('product_variants', ['sku' => 'TSHIRT-BLU-L', 'quantity_on_hand' => 12]);
    }
}
