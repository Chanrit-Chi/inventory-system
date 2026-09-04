<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\PushToken;
use App\Models\RestockSession;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }
    }

    // =========================================================================
    // 1. PUSH TOKEN API ENDPOINTS (REGISTRATION & TRANSFER)
    // =========================================================================

    public function test_push_token_registration_requires_authentication(): void
    {
        $response = $this->postJson('/api/v1/push-tokens', [
            'token' => 'ExponentPushToken[unauthenticated-device]',
        ]);
        $response->assertStatus(401);
    }

    public function test_push_token_registration_validation_fails_on_missing_or_invalid_token(): void
    {
        $user = User::create([
            'name' => 'Validation User',
            'email' => 'valid@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        // Missing token
        $res1 = $this->postJson('/api/v1/push-tokens', []);
        $res1->assertStatus(422);

        // Token too short (< 10 chars)
        $res2 = $this->postJson('/api/v1/push-tokens', [
            'token' => 'short',
        ]);
        $res2->assertStatus(422);

        // Invalid platform
        $res3 = $this->postJson('/api/v1/push-tokens', [
            'token' => 'ExponentPushToken[valid-length-token]',
            'platform' => 'invalid_os',
        ]);
        $res3->assertStatus(422);
    }

    public function test_authenticated_user_can_register_push_token(): void
    {
        $user = User::create([
            'name' => 'Seller Device User',
            'email' => 'seller.device@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        $payload = [
            'token' => 'ExponentPushToken[device-abc-123]',
            'device_name' => 'Samsung Galaxy S24',
            'platform' => 'android',
        ];

        $response = $this->postJson('/api/v1/push-tokens', $payload);
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user_id' => $user->id,
                    'token' => 'ExponentPushToken[device-abc-123]',
                    'device_name' => 'Samsung Galaxy S24',
                    'platform' => 'android',
                ],
            ]);

        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[device-abc-123]',
            'device_name' => 'Samsung Galaxy S24',
            'platform' => 'android',
        ]);
    }

    public function test_push_token_registration_updates_existing_token_details(): void
    {
        $user = User::create([
            'name' => 'Update Device User',
            'email' => 'update.device@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        $token = 'ExponentPushToken[existing-token-update]';

        $this->postJson('/api/v1/push-tokens', [
            'token' => $token,
            'device_name' => 'Old Device Name',
            'platform' => 'ios',
        ])->assertStatus(200);

        $this->postJson('/api/v1/push-tokens', [
            'token' => $token,
            'device_name' => 'New iPhone 15 Pro',
            'platform' => 'ios',
        ])->assertStatus(200);

        $this->assertEquals(1, PushToken::where('token', $token)->count());
        $this->assertDatabaseHas('push_tokens', [
            'token' => $token,
            'device_name' => 'New iPhone 15 Pro',
        ]);
    }

    public function test_push_token_registration_transfers_token_between_users(): void
    {
        $userA = User::create([
            'name' => 'Staff Alice',
            'email' => 'alice@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        $userB = User::create([
            'name' => 'Staff Bob',
            'email' => 'bob@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        $sharedToken = 'ExponentPushToken[counter-pos-tablet-01]';

        // Alice logs into the shared POS tablet
        Sanctum::actingAs($userA);
        $resA = $this->postJson('/api/v1/push-tokens', [
            'token' => $sharedToken,
            'device_name' => 'POS Tablet #1',
            'platform' => 'android',
        ]);
        $resA->assertStatus(200);

        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $userA->id,
            'token' => $sharedToken,
        ]);

        // Bob logs into the same shared POS tablet (reassignment)
        Sanctum::actingAs($userB);
        $resB = $this->postJson('/api/v1/push-tokens', [
            'token' => $sharedToken,
            'device_name' => 'POS Tablet #1 (Bob)',
            'platform' => 'android',
        ]);
        $resB->assertStatus(200);

        // Token must now be bound to Bob
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $userB->id,
            'token' => $sharedToken,
            'device_name' => 'POS Tablet #1 (Bob)',
        ]);
        // Alice must no longer hold the token
        $this->assertDatabaseMissing('push_tokens', [
            'user_id' => $userA->id,
            'token' => $sharedToken,
        ]);
        // Invariant: exactly 1 row exists
        $this->assertEquals(1, PushToken::where('token', $sharedToken)->count());
    }

    // =========================================================================
    // 2. PUSH TOKEN DEREGISTRATION & IDEMPOTENCY
    // =========================================================================

    public function test_push_token_deregistration_requires_authentication(): void
    {
        $response = $this->deleteJson('/api/v1/push-tokens/ExponentPushToken[unauth]');
        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_deregister_push_token(): void
    {
        $user = User::create([
            'name' => 'Logout User',
            'email' => 'logout@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        $token = 'ExponentPushToken[logout-device-token]';
        PushToken::create([
            'user_id' => $user->id,
            'token' => $token,
            'device_name' => 'Pixel 7',
            'platform' => 'android',
        ]);

        $this->assertDatabaseHas('push_tokens', ['token' => $token]);

        $response = $this->deleteJson("/api/v1/push-tokens/{$token}");
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Push token deregistered successfully.',
            ]);

        $this->assertDatabaseMissing('push_tokens', ['token' => $token]);
    }

    public function test_push_token_deregistration_handles_url_encoded_and_raw_tokens(): void
    {
        $user = User::create([
            'name' => 'Encoded User',
            'email' => 'encoded@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        $rawToken = 'ExponentPushToken[bracket-token-XYZ]';
        PushToken::create([
            'user_id' => $user->id,
            'token' => $rawToken,
            'device_name' => 'iPad Air',
            'platform' => 'ios',
        ]);

        $encoded = urlencode($rawToken);
        $response = $this->deleteJson("/api/v1/push-tokens/{$encoded}");
        $response->assertStatus(200);

        $this->assertDatabaseMissing('push_tokens', ['token' => $rawToken]);
    }

    public function test_push_token_deregistration_is_idempotent(): void
    {
        $user = User::create([
            'name' => 'Idempotent User',
            'email' => 'idempotent@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        // Non-existent token deletion must succeed with HTTP 200
        $response = $this->deleteJson('/api/v1/push-tokens/' . urlencode('ExponentPushToken[never-existed]'));
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Push token deregistered successfully.',
            ]);
    }

    public function test_user_cannot_delete_another_users_push_token(): void
    {
        $userA = User::create([
            'name' => 'User A',
            'email' => 'usera.delete@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        $userB = User::create([
            'name' => 'User B',
            'email' => 'userb.delete@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        $tokenB = 'ExponentPushToken[user-b-device-token]';
        PushToken::create([
            'user_id' => $userB->id,
            'token' => $tokenB,
        ]);

        Sanctum::actingAs($userA);

        $response = $this->deleteJson('/api/v1/push-tokens/' . urlencode($tokenB));
        $response->assertStatus(200);

        // Token belonging to user B must remain intact
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $userB->id,
            'token' => $tokenB,
        ]);
    }

    // =========================================================================
    // 3. PUSH NOTIFICATION SERVICE (SINGLE USER & MULTI-DEVICE)
    // =========================================================================

    public function test_send_to_user_dispatches_http_post_to_expo(): void
    {
        $token = 'ExponentPushToken[user-single-token]';

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 'ticket-12345'],
                ],
            ], 200),
        ]);

        $user = User::create([
            'name' => 'Single Target',
            'email' => 'target@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'MANAGER',
        ]);
        PushToken::create([
            'user_id' => $user->id,
            'token' => $token,
            'platform' => 'ios',
        ]);

        $service = new PushNotificationService();
        $result = $service->sendToUser($user, [
            'title' => 'Test Title',
            'body' => 'Test Body Message',
            'data' => ['key' => 'value'],
        ]);

        $this->assertEquals(1, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($token) {
            $data = $request->data();
            return count($data) === 1 &&
                $data[0]['to'] === $token &&
                $data[0]['title'] === 'Test Title' &&
                $data[0]['body'] === 'Test Body Message' &&
                $data[0]['data']['key'] === 'value';
        });
    }

    public function test_send_to_user_with_no_tokens_skips_http_request(): void
    {
        Http::fake();

        $user = User::create([
            'name' => 'Tokenless User',
            'email' => 'tokenless@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        $service = new PushNotificationService();
        $result = $service->sendToUser($user, [
            'title' => 'No token',
            'body' => 'Should not send',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);

        Http::assertNothingSent();
    }

    public function test_send_to_user_skips_when_user_is_inactive(): void
    {
        Http::fake();

        $user = User::create([
            'name' => 'Inactive User',
            'email' => 'inactive@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'MANAGER',
            'is_active' => false,
        ]);
        PushToken::create([
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[inactive-user-token]',
        ]);

        $service = new PushNotificationService();
        $result = $service->sendToUser($user, [
            'title' => 'Should Not Send',
            'body' => 'User is inactive',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);

        Http::assertNothingSent();
    }

    public function test_send_to_user_with_multiple_devices_sends_to_all_tokens(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 'ticket-phone'],
                    ['status' => 'ok', 'id' => 'ticket-tablet'],
                ],
            ], 200),
        ]);

        $user = User::create([
            'name' => 'Multi Device User',
            'email' => 'multidev@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'MANAGER',
        ]);
        PushToken::create(['user_id' => $user->id, 'token' => 'ExponentPushToken[dev-phone]', 'platform' => 'android']);
        PushToken::create(['user_id' => $user->id, 'token' => 'ExponentPushToken[dev-tablet]', 'platform' => 'ios']);

        $service = new PushNotificationService();
        $result = $service->sendToUser($user, [
            'title' => 'Multi Device',
            'body' => 'Alert on both devices',
        ]);

        $this->assertEquals(2, $result['sent']);
        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array('ExponentPushToken[dev-phone]', $tokens) &&
                in_array('ExponentPushToken[dev-tablet]', $tokens);
        });
    }

    // =========================================================================
    // 4. ROLE-AWARE DISPATCH METHODS
    // =========================================================================

    public function test_notify_low_stock_dispatches_to_admin_manager_seller(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 't1'],
                    ['status' => 'ok', 'id' => 't2'],
                    ['status' => 'ok', 'id' => 't3'],
                ],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Admin User', 'email' => 'adm.stock@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        $mgr = User::create(['name' => 'Mgr User', 'email' => 'mgr.stock@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER']);
        $seller = User::create(['name' => 'Seller User', 'email' => 'slr.stock@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[stock-adm]']);
        PushToken::create(['user_id' => $mgr->id, 'token' => 'ExponentPushToken[stock-mgr]']);
        PushToken::create(['user_id' => $seller->id, 'token' => 'ExponentPushToken[stock-slr]']);

        $cat = ProductCategory::create(['name' => 'Hardware', 'code' => 'HDW']);
        $prod = Product::create(['category_id' => $cat->id, 'name' => 'Barcode Scanner', 'sku' => 'SCN-01', 'cost_price' => 50, 'selling_price' => 100]);
        $variant = ProductVariant::create([
            'product_id' => $prod->id,
            'sku' => 'SCN-01-USB',
            'cost_price' => 50,
            'selling_price' => 100,
            'quantity_on_hand' => 2,
            'reorder_level' => 5,
        ]);
        $variant->setRelation('product', $prod);

        $service = new PushNotificationService();
        $result = $service->notifyLowStock($variant);

        $this->assertEquals(3, $result['sent']);
        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();
            $first = $request->data()[0];
            return in_array('ExponentPushToken[stock-adm]', $tokens) &&
                in_array('ExponentPushToken[stock-mgr]', $tokens) &&
                in_array('ExponentPushToken[stock-slr]', $tokens) &&
                str_contains($first['title'], 'Low Stock Alert') &&
                $first['data']['type'] === 'low_stock';
        });
    }

    public function test_notify_restock_completed_strictly_excludes_sellers(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 't1'],
                    ['status' => 'ok', 'id' => 't2'],
                ],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Admin R', 'email' => 'adm.rst@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        $mgr = User::create(['name' => 'Mgr R', 'email' => 'mgr.rst@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER']);
        $seller = User::create(['name' => 'Seller R', 'email' => 'slr.rst@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[rst-adm]']);
        PushToken::create(['user_id' => $mgr->id, 'token' => 'ExponentPushToken[rst-mgr]']);
        PushToken::create(['user_id' => $seller->id, 'token' => 'ExponentPushToken[rst-slr]']);

        $session = RestockSession::create([
            'user_id' => $admin->id,
            'session_code' => 'RS-TEST-99',
            'status' => 'verified',
            'total_cost' => 1250.00,
        ]);

        $service = new PushNotificationService();
        $result = $service->notifyRestockCompleted($session);

        $this->assertEquals(2, $result['sent']);
        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array('ExponentPushToken[rst-adm]', $tokens) &&
                in_array('ExponentPushToken[rst-mgr]', $tokens) &&
                !in_array('ExponentPushToken[rst-slr]', $tokens); // Seller strictly excluded
        });
    }

    public function test_notify_security_event_strictly_limits_to_admins(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 't1'],
                ],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Sec Admin', 'email' => 'sec.adm@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        $mgr = User::create(['name' => 'Sec Mgr', 'email' => 'sec.mgr@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER']);
        $seller = User::create(['name' => 'Sec Seller', 'email' => 'sec.slr@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[sec-adm-tok]']);
        PushToken::create(['user_id' => $mgr->id, 'token' => 'ExponentPushToken[sec-mgr-tok]']);
        PushToken::create(['user_id' => $seller->id, 'token' => 'ExponentPushToken[sec-slr-tok]']);

        $log = AuditLog::create([
            'source_type' => 'App\Models\User',
            'source_id' => $admin->id,
            'action' => 'user.permission_escalated',
            'category' => 'SECURITY',
            'target' => 'Role: Super Admin',
            'actor_name' => 'Sec Admin',
            'occurred_at' => now(),
        ]);

        $service = new PushNotificationService();
        $result = $service->notifySecurityEvent($log);

        $this->assertEquals(1, $result['sent']);
        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array('ExponentPushToken[sec-adm-tok]', $tokens) &&
                !in_array('ExponentPushToken[sec-mgr-tok]', $tokens) &&
                !in_array('ExponentPushToken[sec-slr-tok]', $tokens);
        });
    }

    public function test_notify_invoice_overdue_dispatches_to_admin_manager_seller(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok'],
                    ['status' => 'ok'],
                    ['status' => 'ok'],
                ],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Inv Adm', 'email' => 'inv.adm@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        $mgr = User::create(['name' => 'Inv Mgr', 'email' => 'inv.mgr@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER']);
        $seller = User::create(['name' => 'Inv Slr', 'email' => 'inv.slr@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[inv-adm]']);
        PushToken::create(['user_id' => $mgr->id, 'token' => 'ExponentPushToken[inv-mgr]']);
        PushToken::create(['user_id' => $seller->id, 'token' => 'ExponentPushToken[inv-slr]']);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-2026-999',
            'customer_name' => 'Acme Corp',
            'status' => 'OVERDUE',
            'total_amount' => 5000.00,
            'balance_due' => 2500.00,
            'due_date' => now()->subDays(5),
            'user_id' => $admin->id,
        ]);

        $service = new PushNotificationService();
        $result = $service->notifyInvoiceOverdue($invoice);

        $this->assertEquals(3, $result['sent']);
        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();
            $msg = $request->data()[0];
            return in_array('ExponentPushToken[inv-adm]', $tokens) &&
                in_array('ExponentPushToken[inv-mgr]', $tokens) &&
                in_array('ExponentPushToken[inv-slr]', $tokens) &&
                $msg['data']['type'] === 'invoice';
        });
    }

    // =========================================================================
    // 5. ORDER COMPLETED SELLER ISOLATION FILTERING
    // =========================================================================

    public function test_notify_order_completed_sends_to_admins_managers_and_matching_seller_only(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok'],
                    ['status' => 'ok'],
                    ['status' => 'ok'],
                ],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Ord Admin', 'email' => 'ord.adm@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        $mgr = User::create(['name' => 'Ord Mgr', 'email' => 'ord.mgr@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER']);
        $sellerA = User::create(['name' => 'Seller Alice', 'email' => 'sellerA@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);
        $sellerB = User::create(['name' => 'Seller Bob', 'email' => 'sellerB@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[ord-adm]']);
        PushToken::create(['user_id' => $mgr->id, 'token' => 'ExponentPushToken[ord-mgr]']);
        PushToken::create(['user_id' => $sellerA->id, 'token' => 'ExponentPushToken[ord-sellerA]']);
        PushToken::create(['user_id' => $sellerB->id, 'token' => 'ExponentPushToken[ord-sellerB]']);

        // Order created by Alice ($sellerA)
        $order = Order::create([
            'order_number' => 'ORD-10088',
            'user_id' => $sellerA->id,
            'seller_id' => $sellerA->id,
            'status' => 'COMPLETED',
            'total_amount' => 199.50,
        ]);

        $service = new PushNotificationService();
        $result = $service->notifyOrderCompleted($order);

        $this->assertEquals(3, $result['sent']);
        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();

            $hasAdmin = in_array('ExponentPushToken[ord-adm]', $tokens);
            $hasMgr = in_array('ExponentPushToken[ord-mgr]', $tokens);
            $hasSellerA = in_array('ExponentPushToken[ord-sellerA]', $tokens);
            $hasSellerB = in_array('ExponentPushToken[ord-sellerB]', $tokens);

            // Invariant: Admin, Manager, and Alice receive it. Bob receives 0 notifications!
            return $hasAdmin && $hasMgr && $hasSellerA && !$hasSellerB;
        });
    }

    public function test_notify_order_completed_when_seller_id_matches(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok'],
                    ['status' => 'ok'],
                ],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Admin Only', 'email' => 'adm.only@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        $sellerActive = User::create(['name' => 'Seller Active', 'email' => 'active.slr@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);
        $sellerIdle = User::create(['name' => 'Seller Idle', 'email' => 'idle.slr@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[adm-only]']);
        PushToken::create(['user_id' => $sellerActive->id, 'token' => 'ExponentPushToken[seller-act]']);
        PushToken::create(['user_id' => $sellerIdle->id, 'token' => 'ExponentPushToken[seller-idl]']);

        // Order where seller_id is explicitly set to $sellerActive
        $order = Order::create([
            'order_number' => 'ORD-10099',
            'user_id' => $admin->id,
            'seller_id' => $sellerActive->id,
            'status' => 'COMPLETED',
            'total_amount' => 75.00,
        ]);

        $service = new PushNotificationService();
        $service->notifyOrderCompleted($order);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array('ExponentPushToken[adm-only]', $tokens) &&
                in_array('ExponentPushToken[seller-act]', $tokens) &&
                !in_array('ExponentPushToken[seller-idl]', $tokens);
        });
    }

    // =========================================================================
    // 6. DEAD TOKEN AUTOMATIC PRUNING
    // =========================================================================

    public function test_expo_devicenotregistered_error_automatically_prunes_token_from_database(): void
    {
        $validToken = 'ExponentPushToken[valid-alive-token]';
        $deadToken = 'ExponentPushToken[dead-unregistered-token]';

        $user = User::create(['name' => 'Prune User', 'email' => 'prune@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        PushToken::create(['user_id' => $user->id, 'token' => $validToken]);
        PushToken::create(['user_id' => $user->id, 'token' => $deadToken]);

        $this->assertDatabaseHas('push_tokens', ['token' => $validToken]);
        $this->assertDatabaseHas('push_tokens', ['token' => $deadToken]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 'ticket-ok-1'],
                    [
                        'status' => 'error',
                        'message' => "\"{$deadToken}\" is not a registered push notification recipient",
                        'details' => [
                            'error' => 'DeviceNotRegistered',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$validToken, $deadToken], [
            'title' => 'Prune Test',
            'body' => 'Testing dead token purge',
        ]);

        $this->assertEquals(1, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEquals([$deadToken], $result['purged']);

        // Invariant: Alive token remains intact, dead token is deleted
        $this->assertDatabaseHas('push_tokens', ['token' => $validToken]);
        $this->assertDatabaseMissing('push_tokens', ['token' => $deadToken]);
    }

    public function test_expo_transient_error_does_not_prune_token(): void
    {
        $token = 'ExponentPushToken[rate-limited-token]';

        $user = User::create(['name' => 'Rate User', 'email' => 'rate@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        PushToken::create(['user_id' => $user->id, 'token' => $token]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    [
                        'status' => 'error',
                        'message' => 'Message Rate Exceeded',
                        'details' => [
                            'error' => 'MessageRateExceeded',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$token], [
            'title' => 'Rate Limit Test',
            'body' => 'Should not prune',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEmpty($result['purged']);

        // Token must NOT be deleted for transient errors
        $this->assertDatabaseHas('push_tokens', ['token' => $token]);
    }

    // =========================================================================
    // 7. BATCH CHUNKING (>100 TOKENS) & RESILIENCE
    // =========================================================================

    public function test_send_push_chunks_batches_greater_than_100_tokens(): void
    {
        $tokens = [];
        for ($i = 1; $i <= 105; $i++) {
            $tokens[] = "ExponentPushToken[stress-test-batch-token-{$i}]";
        }

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function (\Illuminate\Http\Client\Request $request) {
                $messages = $request->data();
                $tickets = array_map(function ($msg, $i) {
                    return ['status' => 'ok', 'id' => 'ticket-' . $i];
                }, $messages, array_keys($messages));

                return Http::response(['data' => $tickets], 200);
            },
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Batch 105 Test',
            'body' => 'Testing 100-chunk pagination',
        ]);

        // Exactly 2 HTTP requests sent: 1st chunk = 100, 2nd chunk = 5
        Http::assertSentCount(2);

        $this->assertEquals(105, $result['sent']);
        $this->assertEquals(0, $result['failed']);
        $this->assertEmpty($result['purged']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            return count($request->data()) === 100;
        });

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            return count($request->data()) === 5;
        });
    }

    public function test_send_push_handles_http_failure_gracefully(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response(['errors' => ['Server error']], 500),
        ]);

        $tokens = ['ExponentPushToken[tok-1]', 'ExponentPushToken[tok-2]'];

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Error Test',
            'body' => 'Testing 500 handling',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(2, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    public function test_send_push_handles_connection_exception_gracefully(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('Connection timeout');
            },
        ]);

        $tokens = ['ExponentPushToken[timeout-tok]'];

        $service = new PushNotificationService();
        $result = $service->sendPush($tokens, [
            'title' => 'Timeout Test',
            'body' => 'Testing timeout handling',
        ]);

        $this->assertEquals(0, $result['sent']);
        $this->assertEquals(1, $result['failed']);
        $this->assertEmpty($result['purged']);
    }

    // =========================================================================
    // 8. MODEL & RELATIONSHIP INTEGRITY
    // =========================================================================

    public function test_user_push_tokens_relationship_and_cascade_delete(): void
    {
        $user = User::create([
            'name' => 'Cascade User',
            'email' => 'cascade@test.com',
            'password' => Hash::make('p'),
            'role' => 'SELLER',
        ]);

        $token1 = PushToken::create(['user_id' => $user->id, 'token' => 'ExponentPushToken[cascade-1]']);
        $token2 = PushToken::create(['user_id' => $user->id, 'token' => 'ExponentPushToken[cascade-2]']);

        $this->assertCount(2, $user->pushTokens);
        $this->assertTrue($user->pushTokens->contains($token1));
        $this->assertTrue($user->pushTokens->contains($token2));

        // When user is force-deleted from database, foreign key cascade deletes tokens
        $user->forceDelete();

        $this->assertDatabaseMissing('push_tokens', ['id' => $token1->id]);
        $this->assertDatabaseMissing('push_tokens', ['id' => $token2->id]);
    }

    public function test_push_token_user_relationship(): void
    {
        $user = User::create([
            'name' => 'BelongsTo User',
            'email' => 'belongsto@test.com',
            'password' => Hash::make('p'),
            'role' => 'MANAGER',
        ]);

        $token = PushToken::create([
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[belongs-to-token]',
        ]);

        $this->assertNotNull($token->user);
        $this->assertEquals($user->id, $token->user->id);
    }
}
