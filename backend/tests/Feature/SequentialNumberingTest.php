<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Quotation;
use App\Models\SalesChannel;
use App\Models\User;
use App\Services\CheckoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SequentialNumberingTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_number_generates_option_b_sequential_format(): void
    {
        $year = '2026';

        // 1. Initial generation for year
        $num1 = Order::generateOrderNumber($year);
        $this->assertEquals("ORD-{$year}-00001", $num1);

        $order1 = Order::create([
            'order_number' => $num1,
            'status'       => 'COMPLETED',
        ]);

        // 2. Second generation should increment
        $num2 = Order::generateOrderNumber($year);
        $this->assertEquals("ORD-{$year}-00002", $num2);

        $order2 = Order::create([
            'order_number' => $num2,
            'status'       => 'COMPLETED',
        ]);

        // 3. Third generation should increment
        $num3 = Order::generateOrderNumber($year);
        $this->assertEquals("ORD-{$year}-00003", $num3);

        $order3 = Order::create([
            'order_number' => $num3,
            'status'       => 'COMPLETED',
        ]);
    }

    public function test_soft_deleted_order_does_not_cause_sequence_collision(): void
    {
        $year = '2026';

        $order1 = Order::create([
            'order_number' => "ORD-{$year}-00001",
            'status'       => 'COMPLETED',
        ]);
        $order2 = Order::create([
            'order_number' => "ORD-{$year}-00002",
            'status'       => 'COMPLETED',
        ]);

        // Delete the latest order
        $order2->delete();
        $this->assertSoftDeleted('orders', ['id' => $order2->id]);

        // Next generated number must be 00003, not colliding with 00002
        $next = Order::generateOrderNumber($year);
        $this->assertEquals("ORD-{$year}-00003", $next);
    }

    public function test_invoice_number_generates_option_b_sequential_format(): void
    {
        $year = '2026';

        $num1 = Invoice::generateInvoiceNumber($year);
        $this->assertEquals("INV-{$year}-00001", $num1);

        $inv1 = Invoice::create([
            'invoice_number' => $num1,
            'customer_name'  => 'Test Customer',
            'status'         => 'SENT',
        ]);

        $num2 = Invoice::generateInvoiceNumber($year);
        $this->assertEquals("INV-{$year}-00002", $num2);

        $inv2 = Invoice::create([
            'invoice_number' => $num2,
            'customer_name'  => 'Test Customer 2',
            'status'         => 'SENT',
        ]);

        // Soft delete latest invoice
        $inv2->delete();

        $num3 = Invoice::generateInvoiceNumber($year);
        $this->assertEquals("INV-{$year}-00003", $num3);
    }

    public function test_quotation_number_generates_option_b_sequential_format(): void
    {
        $year = '2026';

        $num1 = Quotation::generateQuotationNumber($year);
        $this->assertEquals("QT-{$year}-00001", $num1);

        $qt1 = Quotation::create([
            'quotation_number' => $num1,
            'customer_name'    => 'Client Corp',
            'status'           => 'DRAFT',
        ]);

        $num2 = Quotation::generateQuotationNumber($year);
        $this->assertEquals("QT-{$year}-00002", $num2);

        $qt2 = Quotation::create([
            'quotation_number' => $num2,
            'customer_name'    => 'Client Corp 2',
            'status'           => 'DRAFT',
        ]);

        // Soft delete
        $qt2->delete();

        $num3 = Quotation::generateQuotationNumber($year);
        $this->assertEquals("QT-{$year}-00003", $num3);
    }

    public function test_pos_checkout_end_to_end_assigns_option_b_order_number(): void
    {
        $user = User::create([
            'name'     => 'Cashier',
            'email'    => 'cashier_seq@test.com',
            'password' => bcrypt('password123'),
            'role'     => 'CASHIER',
        ]);
        Sanctum::actingAs($user);

        $channel = SalesChannel::create(['name' => 'POS Main', 'code' => 'POS-01']);
        $product = Product::create([
            'name'      => 'Test Product',
            'is_active' => true,
        ]);
        $variant = ProductVariant::create([
            'product_id'        => $product->id,
            'sku'               => 'TEST-SKU-001',
            'cost_price'        => 5.00,
            'selling_price'     => 10.00,
            'quantity_on_hand'  => 50,
        ]);

        $payload = [
            'client_mutation_id' => (string) \Illuminate\Support\Str::uuid(),
            'channel_id'         => $channel->id,
            'items'              => [
                [
                    'variant_id' => $variant->id,
                    'quantity'   => 2,
                    'unit_price' => 10.00,
                ],
            ],
            'payment_method'     => 'Cash',
            'payment_amount'     => 20.00,
            'payments'           => [
                [
                    'payment_method' => 'Cash',
                    'amount'         => 20.00,
                ],
            ],
        ];

        $checkoutService = app(CheckoutService::class);
        $order = $checkoutService->checkout($payload);

        $year = date('Y');
        $this->assertMatchesRegularExpression("/^ORD-{$year}-\\d{5}$/", $order->order_number);
        $this->assertEquals("ORD-{$year}-00001", $order->order_number);

        // Next checkout produces 00002
        $payload['client_mutation_id'] = (string) \Illuminate\Support\Str::uuid();
        $order2 = $checkoutService->checkout($payload);
        $this->assertEquals("ORD-{$year}-00002", $order2->order_number);
    }
}
