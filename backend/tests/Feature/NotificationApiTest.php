<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\Quotation;
use App\Models\RestockSession;
use App\Models\User;
use App\Models\UserNotificationState;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use DatabaseMigrations;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->user = User::create([
            'name'     => 'Admin Test User',
            'email'    => 'admin.test@example.com',
            'password' => Hash::make('password123'),
            'role'     => 'ADMIN',
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/notifications');
        $response->assertStatus(401);
    }

    public function test_empty_database_returns_notifications_list(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/notifications');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);

        $countRes = $this->getJson('/api/v1/notifications/unread-count');
        $countRes->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => ['unread_count'],
            ]);
    }

    public function test_low_stock_variant_generates_warning_notification(): void
    {
        Sanctum::actingAs($this->user);

        $category = ProductCategory::create([
            'name' => 'Tech',
            'code' => 'TECH',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Gaming Mouse',
            'sku'           => 'MOU-GAM-01',
            'cost_price'    => 10,
            'selling_price' => 25,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'MOU-GAM-01-BLK',
            'cost_price'       => 10,
            'selling_price'    => 25,
            'quantity_on_hand' => 2,
            'reorder_level'    => 5,
        ]);

        $response = $this->getJson('/api/v1/notifications');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => [
                        'id',
                        'title',
                        'desc',
                        'time',
                        'variant',
                        'unread',
                        'to',
                        'type',
                    ],
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $notif = collect($data)->firstWhere('id', 'low_stock_' . $variant->id);

        $this->assertNotNull($notif);
        $this->assertEquals('low_stock_' . $variant->id, $notif['id']);
        $this->assertEquals('warning', $notif['variant']);
        $this->assertTrue($notif['unread']);
        $this->assertEquals('/inventory', $notif['to']);
        $this->assertStringContainsString('Gaming Mouse', $notif['title']);
    }

    public function test_mark_single_notification_as_read(): void
    {
        Sanctum::actingAs($this->user);

        $category = ProductCategory::create([
            'name' => 'Tech',
            'code' => 'TECH2',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Keyboard Pro',
            'sku'           => 'KEY-01',
            'cost_price'    => 15,
            'selling_price' => 40,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'KEY-01',
            'cost_price'       => 15,
            'selling_price'    => 40,
            'quantity_on_hand' => 1,
            'reorder_level'    => 10,
        ]);

        $notifId = 'low_stock_' . $variant->id;

        // Mark as read
        $patchRes = $this->patchJson("/api/v1/notifications/{$notifId}/read");
        $patchRes->assertStatus(200)
            ->assertJson(['success' => true]);

        $listRes = $this->getJson('/api/v1/notifications');
        $matched = collect($listRes->json('data'))->firstWhere('id', $notifId);
        $this->assertNotNull($matched);
        $this->assertFalse($matched['unread']);
    }

    public function test_mark_all_notifications_as_read(): void
    {
        Sanctum::actingAs($this->user);

        $category = ProductCategory::create([
            'name' => 'General',
            'code' => 'GEN1',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Item A',
            'sku'           => 'ITM-A',
            'cost_price'    => 5,
            'selling_price' => 10,
        ]);

        ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'ITM-A',
            'cost_price'       => 5,
            'selling_price'    => 10,
            'quantity_on_hand' => 1,
            'reorder_level'    => 5,
        ]);

        $order = Order::create([
            'user_id'      => $this->user->id,
            'order_number' => 'ORD-1001',
            'status'       => 'COMPLETED',
            'total_amount' => 150.00,
        ]);

        // Mark all read
        $postRes = $this->postJson('/api/v1/notifications/mark-all-read');
        $postRes->assertStatus(200)
            ->assertJson(['success' => true]);

        $countResAfter = $this->getJson('/api/v1/notifications/unread-count');
        $countResAfter->assertJson(['data' => ['unread_count' => 0]]);

        $listRes = $this->getJson('/api/v1/notifications');
        foreach ($listRes->json('data') as $notif) {
            $this->assertFalse($notif['unread']);
        }
    }

    public function test_dismiss_notification_hides_it_from_list(): void
    {
        Sanctum::actingAs($this->user);

        $category = ProductCategory::create([
            'name' => 'General',
            'code' => 'GEN2',
        ]);

        $product = Product::create([
            'category_id'   => $category->id,
            'name'          => 'Item B',
            'sku'           => 'ITM-B',
            'cost_price'    => 5,
            'selling_price' => 10,
        ]);

        $variant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'ITM-B',
            'cost_price'       => 5,
            'selling_price'    => 10,
            'quantity_on_hand' => 1,
            'reorder_level'    => 5,
        ]);

        $notifId = 'low_stock_' . $variant->id;

        $listBefore = $this->getJson('/api/v1/notifications');
        $this->assertNotNull(collect($listBefore->json('data'))->firstWhere('id', $notifId));

        // Dismiss
        $deleteRes = $this->deleteJson("/api/v1/notifications/{$notifId}");
        $deleteRes->assertStatus(200);

        $listAfter = $this->getJson('/api/v1/notifications');
        $this->assertNull(collect($listAfter->json('data'))->firstWhere('id', $notifId));
    }

    public function test_seller_cannot_see_audit_or_restock_notifications(): void
    {
        $seller = User::create([
            'name'     => 'Seller Test User',
            'email'    => 'seller.test@example.com',
            'password' => Hash::make('password123'),
            'role'     => 'SELLER',
        ]);

        Sanctum::actingAs($seller);

        // Create an audit log entry (simulate admin login)
        \App\Models\AuditLog::create([
            'source_type' => 'App\Models\User',
            'source_id'   => $seller->id,
            'action'      => 'user.login',
            'category'    => 'AUTH',
            'target'      => 'User: Admin User',
            'actor_name'  => 'Admin User',
            'occurred_at' => now(),
        ]);

        // Create a restock session
        $session = RestockSession::create([
            'user_id'      => $seller->id,
            'session_code' => 'RS-TEST-01',
            'status'       => 'verified',
            'total_cost'   => 500,
        ]);

        $response = $this->getJson('/api/v1/notifications');
        $response->assertStatus(200);

        $data = collect($response->json('data'));

        // Seller must NOT see audit notifications
        $auditNotifs = $data->filter(fn($n) => str_starts_with($n['id'], 'audit_'));
        $this->assertCount(0, $auditNotifs, 'Seller should NOT see audit notifications');

        // Seller must NOT see restock notifications
        $restockNotifs = $data->filter(fn($n) => str_starts_with($n['id'], 'restock_'));
        $this->assertCount(0, $restockNotifs, 'Seller should NOT see restock notifications');
    }

    public function test_admin_can_see_audit_and_restock_notifications(): void
    {
        Sanctum::actingAs($this->user); // $this->user is ADMIN

        // Create an audit log entry
        \App\Models\AuditLog::create([
            'source_type' => 'App\Models\User',
            'source_id'   => $this->user->id,
            'action'      => 'user.login',
            'category'    => 'AUTH',
            'target'      => 'User: Admin User',
            'actor_name'  => 'Admin User',
            'occurred_at' => now(),
        ]);

        // Create a restock session
        RestockSession::create([
            'user_id'      => $this->user->id,
            'session_code' => 'RS-ADMIN-01',
            'status'       => 'verified',
            'total_cost'   => 1200,
        ]);

        $response = $this->getJson('/api/v1/notifications');
        $response->assertStatus(200);

        $data = collect($response->json('data'));

        // Admin MUST see audit notifications
        $auditNotifs = $data->filter(fn($n) => str_starts_with($n['id'], 'audit_'));
        $this->assertNotEmpty($auditNotifs, 'Admin should see audit notifications');

        // Admin MUST see restock notifications
        $restockNotifs = $data->filter(fn($n) => str_starts_with($n['id'], 'restock_'));
        $this->assertNotEmpty($restockNotifs, 'Admin should see restock notifications');
    }
}
