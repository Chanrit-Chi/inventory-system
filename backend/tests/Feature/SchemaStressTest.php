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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SchemaStressTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_insertion_across_canonical_schema(): void
    {
        $admin = User::create([
            'name' => 'Stress Admin',
            'email' => 'admin_stress@example.com',
            'password' => 'secret',
            'role' => 'admin',
        ]);

        $channel = SalesChannel::create([
            'name' => 'Online Store',
            'code' => 'ONLINE-' . Str::random(4),
            'type' => 'online',
        ]);

        $customer = Customer::create([
            'name' => 'Stress Customer',
            'phone' => '+855' . rand(10000000, 99999999),
        ]);

        $category = ProductCategory::create([
            'name' => 'Apparel ' . Str::random(4),
            'code' => 'CAT-' . Str::random(6),
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Stress T-Shirt',
            'sku' => 'STRESS-TSHIRT-' . Str::random(4),
            'cost_price' => 5.00,
            'selling_price' => 15.00,
        ]);

        $attr = Attribute::create(['name' => 'Size ' . Str::random(4), 'code' => 'SIZE-' . Str::random(4)]);
        $val = AttributeValue::create(['attribute_id' => $attr->id, 'value' => 'L', 'code' => 'L-' . Str::random(4)]);

        ProductAttribute::create(['product_id' => $product->id, 'attribute_id' => $attr->id]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Stress T-Shirt L',
            'sku' => 'VAR-' . Str::random(6),
            'cost_price' => 5.00,
            'selling_price' => 15.00,
        ]);

        VariantAttributeValue::create(['variant_id' => $variant->id, 'attribute_value_id' => $val->id]);

        $movement = StockMovement::create([
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'type' => 'import',
            'quantity_change' => 100,
            'quantity_before' => 0,
            'quantity_after' => 100,
            'user_id' => $admin->id,
        ]);

        $order = Order::create([
            'order_number' => 'ORD-STR-' . Str::random(6),
            'sales_channel_id' => $channel->id,
            'customer_id' => $customer->id,
            'user_id' => $admin->id,
            'total_amount' => 15.00,
            'discount_amount' => 0.00,
            'final_amount' => 15.00,
            'status' => 'completed',
            'payment_status' => 'paid',
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => 15.00,
            'subtotal' => 15.00,
            'discount_amount' => 0.00,
            'final_amount' => 15.00,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cash',
            'amount' => 15.00,
            'status' => 'completed',
        ]);

        $session = RestockSession::create([
            'session_code' => 'RST-STR-' . Str::random(6),
            'user_id' => $admin->id,
            'status' => 'confirmed',
            'total_cost' => 50.00,
        ]);

        $detail = RestockDetail::create([
            'restock_session_id' => $session->id,
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 10,
            'unit_cost' => 5.00,
            'total_cost' => 50.00,
        ]);

        $expense = Expense::create([
            'user_id' => $admin->id,
            'title' => 'Packaging boxes',
            'amount' => 25.00,
            'category' => 'Supplies',
            'expense_date' => now()->toDateString(),
        ]);

        $this->assertNotNull($expense->id);
        $this->assertEquals(100, $movement->quantity_after);
        $this->assertEquals(15.00, $order->final_amount);
    }
}
