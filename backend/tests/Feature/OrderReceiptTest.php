<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OrderReceiptTest extends TestCase
{
    use DatabaseMigrations;

    private Order $order;
    private StoreSetting $setting;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $user = User::create([
            'name'      => 'Alice Cashier',
            'email'     => 'alice_receipt@test.com',
            'password'  => Hash::make('password123'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $channel = SalesChannel::create([
            'name'      => 'Main POS Counter',
            'code'      => 'POS-1',
            'type'      => 'RETAIL',
            'is_active' => true,
        ]);

        $category = ProductCategory::create([
            'name' => 'Beverages',
            'code' => 'BEV',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Espresso Roast',
            'sku'           => 'ESP-001',
            'cost_price'    => 2.0,
            'selling_price' => 4.5,
            'is_active'     => true,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'ESP-001-REG',
            'cost_price'       => 2.0,
            'selling_price'    => 4.5,
            'quantity_on_hand' => 100,
        ]);

        $this->order = Order::create([
            'order_number' => 'ORD-2026-99999',
            'channel_id'   => $channel->id,
            'user_id'      => $user->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 9.00,
            'total_amount' => 9.00,
            'note'         => 'Customer requested extra hot',
        ]);

        OrderItem::create([
            'order_id'    => $this->order->id,
            'product_id'  => $product->id,
            'variant_id'  => $variant->id,
            'quantity'    => 2,
            'unit_price'  => 4.50,
            'total_price' => 9.00,
        ]);

        Payment::create([
            'order_id'       => $this->order->id,
            'payment_method' => 'Cash',
            'amount'         => 9.00,
            'status'         => 'COMPLETED',
        ]);

        $this->setting = StoreSetting::current();
        $this->setting->update([
            'store_name'     => 'My Thermal Cafe',
            'store_address'  => '123 Coffee Lane',
            'store_phone'    => '+1-555-0199',
            'receipt_header' => 'OFFICIAL TAX RECEIPT',
            'receipt_footer' => 'Thank you for visiting!',
        ]);
    }

    public function test_order_receipt_renders_html_successfully(): void
    {
        $response = $this->get("/api/v1/orders/{$this->order->id}/receipt", ['Accept' => 'text/html']);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/html; charset=UTF-8');
        
        $content = $response->getContent();
        $this->assertStringContainsString('My Thermal Cafe', $content);
        $this->assertStringContainsString('ORD-2026-99999', $content);
        $this->assertStringContainsString('Espresso Roast', $content);
        $this->assertStringContainsString('Alice Cashier', $content);
        $this->assertStringContainsString('$9.00', $content);
        $this->assertStringContainsString('window.print()', $content);
    }

    public function test_order_receipt_returns_json_when_requested(): void
    {
        $response = $this->getJson("/api/v1/orders/{$this->order->id}/receipt");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'id'           => $this->order->id,
                'order_number' => 'ORD-2026-99999',
            ],
        ]);
    }

    public function test_order_receipt_returns_404_when_order_not_found(): void
    {
        $response = $this->get('/api/v1/orders/00000000-0000-0000-0000-000000000000/receipt');

        $response->assertStatus(404);
    }
}
