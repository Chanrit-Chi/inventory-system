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
use Tests\TestCase;

class ModelRelationshipTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_category_and_product_relationship(): void
    {
        $category = ProductCategory::create([
            'name' => 'Fashion & Apparel',
            'code' => 'CAT-FASHION',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Graphic T-Shirt',
            'sku' => 'TSHIRT-GRAPHIC',
            'cost_price' => 5.00,
            'selling_price' => 15.00,
        ]);

        $this->assertEquals($category->id, $product->category->id);
        $this->assertTrue($category->products->contains($product));
    }

    public function test_attribute_and_attribute_value_relationship(): void
    {
        $attribute = Attribute::create([
            'name' => 'Size',
            'code' => 'ATTR-SZ',
        ]);

        $value = AttributeValue::create([
            'attribute_id' => $attribute->id,
            'value' => 'Medium',
            'code' => 'SZ-MED',
        ]);

        $this->assertEquals($attribute->id, $value->attribute->id);
        $this->assertTrue($attribute->values->contains($value));
    }

    public function test_product_and_attribute_many_to_many(): void
    {
        $category = ProductCategory::create(['name' => 'Tech', 'code' => 'TECH']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Phone', 'sku' => 'PHONE-01']);
        $attribute = Attribute::create(['name' => 'Color', 'code' => 'CLR']);

        $product->attributes()->attach($attribute->id);

        $this->assertTrue($product->attributes->contains($attribute));
        $this->assertTrue($attribute->products->contains($product));
    }

    public function test_variant_and_attribute_values_many_to_many(): void
    {
        $category = ProductCategory::create(['name' => 'Tech', 'code' => 'TECH2']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Phone Pro', 'sku' => 'PHONE-02']);
        $variant = ProductVariant::create(['product_id' => $product->id, 'name' => 'Midnight Blue', 'sku' => 'PHONE-BLUE']);

        $attribute = Attribute::create(['name' => 'Color', 'code' => 'CLR2']);
        $attrVal = AttributeValue::create(['attribute_id' => $attribute->id, 'value' => 'Blue', 'code' => 'CLR-BLU']);

        $variant->attributeValues()->attach($attrVal->id);

        $this->assertTrue($variant->attributeValues->contains($attrVal));
        $this->assertTrue($attrVal->variants->contains($variant));
    }

    public function test_stock_movement_relationships(): void
    {
        $user = User::create(['name' => 'Admin User', 'email' => 'admin_sm@test.com', 'password' => 'secret', 'role' => 'admin']);
        $category = ProductCategory::create(['name' => 'Footwear', 'code' => 'FOOT']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Running Shoes', 'sku' => 'SHOES-01']);
        $variant = ProductVariant::create(['product_id' => $product->id, 'name' => 'Size 42', 'sku' => 'SHOES-42']);

        $movement = StockMovement::create([
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'type' => 'import',
            'quantity_change' => 50,
            'quantity_before' => 0,
            'quantity_after' => 50,
            'user_id' => $user->id,
        ]);

        $this->assertEquals($product->id, $movement->product->id);
        $this->assertEquals($variant->id, $movement->variant->id);
        $this->assertEquals($user->id, $movement->user->id);
        $this->assertTrue($product->stockMovements->contains($movement));
        $this->assertTrue($variant->stockMovements->contains($movement));
    }

    public function test_order_and_items_and_payment_relationships(): void
    {
        $user = User::create(['name' => 'Cashier', 'email' => 'cashier_order@test.com', 'password' => 'secret', 'role' => 'cashier']);
        $channel = SalesChannel::create(['name' => 'Physical POS', 'code' => 'POS-01', 'type' => 'pos']);
        $customer = Customer::create(['name' => 'John Doe', 'phone' => '+85511223344']);
        $category = ProductCategory::create(['name' => 'General', 'code' => 'GEN']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Hat', 'sku' => 'HAT-01', 'selling_price' => 10.00]);
        $variant = ProductVariant::create(['product_id' => $product->id, 'name' => 'Black Hat', 'sku' => 'HAT-BLK']);

        $order = Order::create([
            'order_number' => 'ORD-TEST-001',
            'sales_channel_id' => $channel->id,
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'total_amount' => 20.00,
            'discount_amount' => 0.00,
            'final_amount' => 20.00,
            'status' => 'completed',
            'payment_status' => 'paid',
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => 10.00,
            'subtotal' => 20.00,
            'discount_amount' => 0.00,
            'final_amount' => 20.00,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cash',
            'amount' => 20.00,
            'status' => 'completed',
        ]);

        $this->assertEquals($channel->id, $order->salesChannel->id);
        $this->assertEquals($customer->id, $order->customer->id);
        $this->assertEquals($user->id, $order->user->id);
        $this->assertTrue($order->items->contains($item));
        $this->assertTrue($order->payments->contains($payment));
        $this->assertEquals($order->id, $item->order->id);
        $this->assertEquals($order->id, $payment->order->id);
    }

    public function test_restock_session_and_details_relationships(): void
    {
        $user = User::create(['name' => 'Manager', 'email' => 'mgr_rst@test.com', 'password' => 'secret', 'role' => 'admin']);
        $category = ProductCategory::create(['name' => 'Electronics', 'code' => 'ELEC-RST']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Cable', 'sku' => 'CBL-01']);
        $variant = ProductVariant::create(['product_id' => $product->id, 'name' => 'USB-C', 'sku' => 'CBL-USBC']);

        $session = RestockSession::create([
            'session_code' => 'RST-TEST-001',
            'user_id' => $user->id,
            'status' => 'confirmed',
            'total_cost' => 100.00,
        ]);

        $detail = RestockDetail::create([
            'restock_session_id' => $session->id,
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 50,
            'unit_cost' => 2.00,
            'total_cost' => 100.00,
        ]);

        $this->assertEquals($user->id, $session->user->id);
        $this->assertTrue($session->details->contains($detail));
        $this->assertEquals($session->id, $detail->session->id);
        $this->assertEquals($product->id, $detail->product->id);
    }

    public function test_expense_relationship(): void
    {
        $user = User::create(['name' => 'Admin Expense', 'email' => 'admin_exp@test.com', 'password' => 'secret', 'role' => 'admin']);

        $expense = Expense::create([
            'user_id' => $user->id,
            'title' => 'Office Rent',
            'amount' => 500.00,
            'category' => 'Rent',
            'expense_date' => '2026-08-01',
        ]);

        $this->assertEquals($user->id, $expense->user->id);
        $this->assertTrue($user->expenses->contains($expense));
    }
}
