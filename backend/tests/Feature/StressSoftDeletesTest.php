<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StressSoftDeletesTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_soft_deletable_models(): void
    {
        $user = User::create(['name' => 'SD User', 'email' => 'sd@user.local', 'password' => 'secret', 'role' => 'cashier']);
        $cat = ProductCategory::create(['name' => 'SD Cat', 'code' => 'SD-CAT']);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'SD Prod', 'sku' => 'SD-PROD']);
        $variant = ProductVariant::create(['product_id' => $prod->id, 'name' => 'SD Var', 'sku' => 'SD-VAR']);
        $customer = Customer::create(['name' => 'SD Cust', 'phone' => '+85599887766']);
        $channel = SalesChannel::create(['name' => 'SD Channel', 'code' => 'SD-CHAN', 'type' => 'pos']);

        $order = Order::create([
            'order_number' => 'SD-ORD-001',
            'sales_channel_id' => $channel->id,
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'total_amount' => 10.00,
            'discount_amount' => 0.00,
            'final_amount' => 10.00,
            'status' => 'completed',
            'payment_status' => 'paid',
        ]);

        // Delete all soft-deletable entities
        $user->delete();
        $cat->delete();
        $prod->delete();
        $variant->delete();
        $customer->delete();
        $order->delete();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertSoftDeleted('product_categories', ['id' => $cat->id]);
        $this->assertSoftDeleted('products', ['id' => $prod->id]);
        $this->assertSoftDeleted('product_variants', ['id' => $variant->id]);
        $this->assertSoftDeleted('customers', ['id' => $customer->id]);
        $this->assertSoftDeleted('orders', ['id' => $order->id]);
    }
}
