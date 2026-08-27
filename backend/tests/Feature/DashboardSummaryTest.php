<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use DatabaseMigrations;

    private User $cashierUser;
    private User $adminUser;
    private SalesChannel $salesChannel;
    private ProductCategory $category;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->cashierUser = User::create([
            'name'      => 'Cashier User',
            'email'     => 'cashier@pos.local',
            'password'  => Hash::make('Password123!'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $this->adminUser = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@pos.local',
            'password'  => Hash::make('Password123!'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $this->salesChannel = SalesChannel::create([
            'name'      => 'Main Store POS',
            'code'      => 'POS-MAIN',
            'type'      => 'POS',
            'is_active' => true,
        ]);

        $this->category = ProductCategory::create([
            'name' => 'General',
            'code' => 'GEN',
        ]);

        $this->product = Product::create([
            'category_id'    => $this->category->id,
            'name'           => 'Test Product',
            'sku'            => 'PROD-TEST',
            'purchase_price' => 10.00,
            'selling_price'  => 20.00,
            'is_active'      => true,
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(401);
    }

    public function test_empty_database_returns_zero_metrics(): void
    {
        Sanctum::actingAs($this->cashierUser);

        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'net_revenue'                => 0.0,
                    'orders_count'               => 0,
                    'avg_basket_value'           => 0.0,
                    'digital_payment_percentage' => 0.0,
                    'units_sold'                 => 0,
                    'low_stock_skus'             => 0,
                    'revenue_trend'              => 0.0,
                    'daily_target_progress'      => 0.0,
                ],
            ]);
    }

    public function test_dashboard_summary_calculates_all_metrics_correctly(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // Create variants with various stock levels
        $v1 = ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'VAR-LOW-1',
            'quantity_on_hand' => 3, // <= 5 (low stock SKU 1)
            'is_active'        => true,
        ]);

        $v2 = ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'VAR-LOW-2',
            'quantity_on_hand' => 5, // <= 5 (low stock SKU 2)
            'is_active'        => true,
        ]);

        $v3 = ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'VAR-HIGH',
            'quantity_on_hand' => 20, // > 5 (not low stock)
            'is_active'        => true,
        ]);

        $vDeleted = ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'VAR-DELETED',
            'quantity_on_hand' => 1,
            'is_active'        => true,
        ]);
        $vDeleted->delete(); // Soft deleted (should not count as low stock)

        // 1. Order 1: Completed today, $200.00, 3 units, Cash payment
        $order1 = Order::create([
            'order_number' => 'ORD-TODAY-001',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 200.00,
            'total_amount' => 200.00,
        ]);
        $order1->created_at = Carbon::today()->addHours(9);
        $order1->save();

        OrderItem::create([
            'order_id'    => $order1->id,
            'variant_id'  => $v1->id,
            'quantity'    => 3,
            'unit_price'  => 66.67,
            'total_price' => 200.00,
        ]);

        $payment1 = Payment::create([
            'order_id'       => $order1->id,
            'payment_method' => 'Cash',
            'amount'         => 200.00,
            'status'         => 'completed',
        ]);
        $payment1->created_at = Carbon::today()->addHours(9);
        $payment1->save();

        // 2. Order 2: Completed today, $300.00, 2 units, Digital payment (ABA_QR)
        $order2 = Order::create([
            'order_number' => 'ORD-TODAY-002',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 300.00,
            'total_amount' => 300.00,
        ]);
        $order2->created_at = Carbon::today()->addHours(11);
        $order2->save();

        OrderItem::create([
            'order_id'    => $order2->id,
            'variant_id'  => $v2->id,
            'quantity'    => 2,
            'unit_price'  => 150.00,
            'total_price' => 300.00,
        ]);

        $payment2 = Payment::create([
            'order_id'       => $order2->id,
            'payment_method' => 'ABA_QR',
            'amount'         => 300.00,
            'status'         => 'completed',
        ]);
        $payment2->created_at = Carbon::today()->addHours(11);
        $payment2->save();

        // 3. Order 3: Pending today (should not be included in completed metrics)
        $orderPending = Order::create([
            'order_number' => 'ORD-TODAY-PENDING',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'PENDING',
            'subtotal'     => 150.00,
            'total_amount' => 150.00,
        ]);
        $orderPending->created_at = Carbon::today()->addHours(12);
        $orderPending->save();

        OrderItem::create([
            'order_id'    => $orderPending->id,
            'variant_id'  => $v3->id,
            'quantity'    => 1,
            'unit_price'  => 150.00,
            'total_price' => 150.00,
        ]);

        // 4. Order 4: Completed yesterday (used for trend calculation: $400.00)
        $orderYesterday = Order::create([
            'order_number' => 'ORD-YEST-001',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 400.00,
            'total_amount' => 400.00,
        ]);
        $orderYesterday->created_at = Carbon::yesterday()->addHours(14);
        $orderYesterday->save();

        OrderItem::create([
            'order_id'    => $orderYesterday->id,
            'variant_id'  => $v3->id,
            'quantity'    => 4,
            'unit_price'  => 100.00,
            'total_price' => 400.00,
        ]);

        $paymentYesterday = Payment::create([
            'order_id'       => $orderYesterday->id,
            'payment_method' => 'Cash',
            'amount'         => 400.00,
            'status'         => 'completed',
        ]);
        $paymentYesterday->created_at = Carbon::yesterday()->addHours(14);
        $paymentYesterday->save();

        // 5. Order 5: Soft-deleted today (should not be included)
        $orderDeleted = Order::create([
            'order_number' => 'ORD-TODAY-DEL',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 500.00,
            'total_amount' => 500.00,
        ]);
        $orderDeleted->created_at = Carbon::today()->addHours(10);
        $orderDeleted->save();
        $orderDeleted->delete();

        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'net_revenue'                => 500.00,
                    'orders_count'               => 2,
                    'avg_basket_value'           => 250.00,
                    'digital_payment_percentage' => 50.00,
                    'units_sold'                 => 5,
                    'low_stock_skus'             => 2,
                    'revenue_trend'              => 25.00,
                    'daily_target_progress'      => 5.00,
                ],
            ]);
    }

    public function test_revenue_trend_when_yesterday_is_zero_and_today_positive(): void
    {
        Sanctum::actingAs($this->cashierUser);

        $order = Order::create([
            'order_number' => 'ORD-TODAY-GROWTH',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 100.00,
            'total_amount' => 100.00,
        ]);
        $order->created_at = Carbon::today()->addHours(8);
        $order->save();

        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'net_revenue'           => 100.00,
                    'revenue_trend'         => 100.00,
                    'daily_target_progress' => 1.00,
                ],
            ]);
    }

    public function test_revenue_trend_negative_growth(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // Yesterday: 200
        $orderY = Order::create([
            'order_number' => 'ORD-YEST-HIGH',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 200.00,
            'total_amount' => 200.00,
        ]);
        $orderY->created_at = Carbon::yesterday()->addHours(10);
        $orderY->save();

        // Today: 100 -> (100 - 200) / 200 = -50.00%
        $orderT = Order::create([
            'order_number' => 'ORD-TODAY-LOW',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 100.00,
            'total_amount' => 100.00,
        ]);
        $orderT->created_at = Carbon::today()->addHours(10);
        $orderT->save();

        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'net_revenue'   => 100.00,
                    'revenue_trend' => -50.00,
                ],
            ]);
    }

    public function test_admin_and_cashier_can_both_access_dashboard_summary(): void
    {
        Sanctum::actingAs($this->adminUser);

        $responseAdmin = $this->getJson('/api/v1/dashboard/summary');
        $responseAdmin->assertStatus(200)->assertJson(['success' => true]);

        Sanctum::actingAs($this->cashierUser);

        $responseCashier = $this->getJson('/api/v1/dashboard/summary');
        $responseCashier->assertStatus(200)->assertJson(['success' => true]);

        // Manager and Super Admin access verification
        $managerUser = User::create([
            'name'      => 'Manager User',
            'email'     => 'manager@pos.local',
            'password'  => Hash::make('Password123!'),
            'role'      => 'MANAGER',
            'is_active' => true,
        ]);
        Sanctum::actingAs($managerUser);
        $this->getJson('/api/v1/dashboard/summary')->assertStatus(200)->assertJson(['success' => true]);

        $superAdminUser = User::create([
            'name'      => 'Super Admin',
            'email'     => 'superadmin@pos.local',
            'password'  => Hash::make('Password123!'),
            'role'      => 'SUPER_ADMIN',
            'is_active' => true,
        ]);
        Sanctum::actingAs($superAdminUser);
        $this->getJson('/api/v1/dashboard/summary')->assertStatus(200)->assertJson(['success' => true]);
    }

    public function test_end_of_day_and_start_of_day_timestamp_boundaries(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // 1. Order at start of today (00:00:00)
        $orderStartToday = Order::create([
            'order_number' => 'ORD-BOUNDARY-START',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 100.00,
            'total_amount' => 100.00,
        ]);
        $orderStartToday->created_at = Carbon::today()->startOfDay();
        $orderStartToday->save();

        Payment::create([
            'order_id'       => $orderStartToday->id,
            'payment_method' => 'Cash',
            'amount'         => 100.00,
            'status'         => 'completed',
        ])->update(['created_at' => Carbon::today()->startOfDay()]);

        // 2. Order at end of today (23:59:59.999)
        $orderEndToday = Order::create([
            'order_number' => 'ORD-BOUNDARY-END',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'Completed',
            'subtotal'     => 150.00,
            'total_amount' => 150.00,
        ]);
        $orderEndToday->created_at = Carbon::today()->setTime(23, 59, 59);
        $orderEndToday->save();

        Payment::create([
            'order_id'       => $orderEndToday->id,
            'payment_method' => 'ABA_QR',
            'amount'         => 150.00,
            'status'         => 'completed',
        ])->update(['created_at' => Carbon::today()->setTime(23, 59, 59)]);

        // 3. Order tomorrow at 00:00:00 (should NOT be counted in today's metrics)
        $orderTomorrow = Order::create([
            'order_number' => 'ORD-TOMORROW',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 500.00,
            'total_amount' => 500.00,
        ]);
        $orderTomorrow->created_at = Carbon::tomorrow()->startOfDay();
        $orderTomorrow->save();

        // 4. Order yesterday at 23:59:59 (should be counted in yesterday's revenue: $250.00)
        $orderYesterday = Order::create([
            'order_number' => 'ORD-YEST-BOUNDARY',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'completed',
            'subtotal'     => 250.00,
            'total_amount' => 250.00,
        ]);
        $orderYesterday->created_at = Carbon::yesterday()->setTime(23, 59, 59);
        $orderYesterday->save();

        $response = $this->getJson('/api/v1/dashboard/summary');

        // Today net revenue = 100 + 150 = 250.00
        // Orders count = 2
        // Yesterday revenue = 250.00 -> revenue_trend = 0.0%
        // Digital payments = 1 (ABA_QR) / 2 total = 50.0%
        // Target progress = 250 / 10000 = 2.50%
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'net_revenue'                => 250.00,
                    'orders_count'               => 2,
                    'avg_basket_value'           => 125.00,
                    'digital_payment_percentage' => 50.00,
                    'revenue_trend'              => 0.00,
                    'daily_target_progress'      => 2.50,
                ],
            ]);
    }

    public function test_low_stock_skus_boundary_values_and_negative_quantities(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // Negative stock: <= 5
        ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'SKU-NEG',
            'quantity_on_hand' => -2,
            'is_active'        => true,
        ]);

        // Zero stock: <= 5
        ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'SKU-ZERO',
            'quantity_on_hand' => 0,
            'is_active'        => true,
        ]);

        // Exactly 5: <= 5
        ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'SKU-FIVE',
            'quantity_on_hand' => 5,
            'is_active'        => true,
        ]);

        // Exactly 6: > 5 (not low stock)
        ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'SKU-SIX',
            'quantity_on_hand' => 6,
            'is_active'        => true,
        ]);

        // 100: > 5 (not low stock)
        ProductVariant::create([
            'product_id'       => $this->product->id,
            'sku'              => 'SKU-HIGH',
            'quantity_on_hand' => 100,
            'is_active'        => true,
        ]);

        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'low_stock_skus' => 3,
                ],
            ]);
    }

    public function test_payment_methods_case_whitespace_and_soft_delete_isolation(): void
    {
        Sanctum::actingAs($this->cashierUser);

        // Order 1: Cash with trailing spaces
        $order1 = Order::create([
            'order_number' => 'ORD-PAY-1',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 50.00,
            'total_amount' => 50.00,
        ]);
        $order1->created_at = Carbon::today()->addHours(2);
        $order1->save();

        Payment::create([
            'order_id'       => $order1->id,
            'payment_method' => '  CASH  ',
            'amount'         => 50.00,
        ])->update(['created_at' => Carbon::today()->addHours(2)]);

        // Order 2: Digital (Bank Transfer)
        $order2 = Order::create([
            'order_number' => 'ORD-PAY-2',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 150.00,
            'total_amount' => 150.00,
        ]);
        $order2->created_at = Carbon::today()->addHours(3);
        $order2->save();

        Payment::create([
            'order_id'       => $order2->id,
            'payment_method' => 'Bank Transfer',
            'amount'         => 150.00,
        ])->update(['created_at' => Carbon::today()->addHours(3)]);

        // Order 3: Soft-deleted order with a payment (should not count in digital or total payments)
        $order3 = Order::create([
            'order_number' => 'ORD-PAY-3-TRASHED',
            'channel_id'   => $this->salesChannel->id,
            'status'       => 'COMPLETED',
            'subtotal'     => 200.00,
            'total_amount' => 200.00,
        ]);
        $order3->created_at = Carbon::today()->addHours(4);
        $order3->save();

        Payment::create([
            'order_id'       => $order3->id,
            'payment_method' => 'Card',
            'amount'         => 200.00,
        ])->update(['created_at' => Carbon::today()->addHours(4)]);

        $order3->delete(); // Trashed

        $response = $this->getJson('/api/v1/dashboard/summary');

        // Only Order 1 (Cash) and Order 2 (Bank Transfer) are active.
        // Total payments = 2, Digital payments = 1 -> 50.0%
        // Net revenue = 50 + 150 = 200.00
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'net_revenue'                => 200.00,
                    'orders_count'               => 2,
                    'digital_payment_percentage' => 50.00,
                ],
            ]);
    }
}
