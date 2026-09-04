<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\PushToken;
use App\Models\User;
use App\Services\PushNotificationService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdversarialPushTokenStressTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }
    }

    /**
     * EMPIRICAL CHALLENGE 1:
     * Sequential token reassignment across 3 users and cyclic reassignment.
     * Invariant: Only the most recent user owns the token; prior users retain 0 tokens.
     */
    public function test_three_users_consecutive_token_reassignment_lifecycle(): void
    {
        $sharedToken = 'ExponentPushToken[pos-counter-shared-001]';

        $user1 = User::create([
            'name' => 'Cashier User One',
            'email' => 'cashier1@stress-test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        $user2 = User::create([
            'name' => 'Cashier User Two',
            'email' => 'cashier2@stress-test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        $user3 = User::create([
            'name' => 'Cashier User Three',
            'email' => 'cashier3@stress-test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        // Step 1: User 1 registers token
        Sanctum::actingAs($user1);
        $res1 = $this->postJson('/api/v1/push-tokens', [
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Shift 1',
            'platform' => 'android',
        ]);
        $res1->assertStatus(200);

        $this->assertEquals(1, PushToken::where('token', $sharedToken)->count());
        $this->assertEquals(1, $user1->pushTokens()->count());
        $this->assertEquals(0, $user2->pushTokens()->count());
        $this->assertEquals(0, $user3->pushTokens()->count());
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user1->id,
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Shift 1',
        ]);

        // Step 2: User 2 logs in on the same device (reassignment)
        Sanctum::actingAs($user2);
        $res2 = $this->postJson('/api/v1/push-tokens', [
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Shift 2',
            'platform' => 'android',
        ]);
        $res2->assertStatus(200);

        $this->assertEquals(1, PushToken::where('token', $sharedToken)->count());
        $this->assertEquals(0, $user1->pushTokens()->count(), 'User 1 must no longer hold the reassigned token');
        $this->assertEquals(1, $user2->pushTokens()->count(), 'User 2 must now hold the token');
        $this->assertEquals(0, $user3->pushTokens()->count());
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user2->id,
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Shift 2',
        ]);

        // Step 3: User 3 logs in on the same device (second reassignment)
        Sanctum::actingAs($user3);
        $res3 = $this->postJson('/api/v1/push-tokens', [
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Shift 3',
            'platform' => 'android',
        ]);
        $res3->assertStatus(200);

        $this->assertEquals(1, PushToken::where('token', $sharedToken)->count());
        $this->assertEquals(0, $user1->pushTokens()->count(), 'User 1 must retain 0 tokens');
        $this->assertEquals(0, $user2->pushTokens()->count(), 'User 2 must retain 0 tokens');
        $this->assertEquals(1, $user3->pushTokens()->count(), 'User 3 must now be the sole owner');
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user3->id,
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Shift 3',
        ]);

        // Step 4: Cyclic reassignment - User 1 comes back for the next morning shift
        Sanctum::actingAs($user1);
        $res4 = $this->postJson('/api/v1/push-tokens', [
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Next Morning',
            'platform' => 'android',
        ]);
        $res4->assertStatus(200);

        $this->assertEquals(1, PushToken::where('token', $sharedToken)->count());
        $this->assertEquals(1, $user1->pushTokens()->count(), 'User 1 re-acquired the token');
        $this->assertEquals(0, $user2->pushTokens()->count());
        $this->assertEquals(0, $user3->pushTokens()->count(), 'User 3 must have lost the token');
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user1->id,
            'token' => $sharedToken,
            'device_name' => 'POS Terminal 1 - Next Morning',
        ]);
    }

    /**
     * EMPIRICAL CHALLENGE 2:
     * Single user registering multiple distinct device tokens (e.g. 5 devices).
     * Verifies all tokens are preserved, dispatched to, and selective deletion works.
     */
    public function test_user_registers_multiple_distinct_tokens_and_dispatches_to_all(): void
    {
        $user = User::create([
            'name' => 'Power User Multi Device',
            'email' => 'poweruser@stress-test.com',
            'password' => Hash::make('secret123'),
            'role' => 'MANAGER',
        ]);
        Sanctum::actingAs($user);

        $tokens = [
            'ExponentPushToken[device-mobile-phone-01]',
            'ExponentPushToken[device-counter-tablet-02]',
            'ExponentPushToken[device-backoffice-laptop-03]',
            'ExponentPushToken[device-warehouse-scanner-04]',
            'ExponentPushToken[device-ipad-pro-05]',
        ];

        foreach ($tokens as $idx => $t) {
            $res = $this->postJson('/api/v1/push-tokens', [
                'token' => $t,
                'device_name' => "Device #{$idx}",
                'platform' => $idx % 2 === 0 ? 'android' : 'ios',
            ]);
            $res->assertStatus(200);
        }

        // Invariant: User has exactly 5 tokens registered
        $this->assertEquals(5, $user->pushTokens()->count());
        $this->assertEquals(5, PushToken::where('user_id', $user->id)->count());

        // Test push dispatch reaches all 5 tokens
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => array_fill(0, 5, ['status' => 'ok']),
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendToUser($user, [
            'title' => 'Broadcast to All My Devices',
            'body' => 'Testing 5 devices dispatch',
        ]);

        $this->assertEquals(5, $result['sent']);
        $this->assertEquals(0, $result['failed']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tokens) {
            $dispatchedTokens = collect($request->data())->pluck('to')->all();
            return count($dispatchedTokens) === 5 &&
                   empty(array_diff($tokens, $dispatchedTokens));
        });

        // Deregister device 3 (warehouse scanner)
        $deregRes = $this->deleteJson('/api/v1/push-tokens/' . urlencode($tokens[3]));
        $deregRes->assertStatus(200);

        $this->assertEquals(4, $user->pushTokens()->count());
        $this->assertDatabaseMissing('push_tokens', ['token' => $tokens[3]]);
        $this->assertDatabaseHas('push_tokens', ['token' => $tokens[0]]);
        $this->assertDatabaseHas('push_tokens', ['token' => $tokens[1]]);
        $this->assertDatabaseHas('push_tokens', ['token' => $tokens[2]]);
        $this->assertDatabaseHas('push_tokens', ['token' => $tokens[4]]);

        // User B reassigns device 1 (mobile phone)
        $userB = User::create([
            'name' => 'User B Transferee',
            'email' => 'userb@stress-test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($userB);

        $this->postJson('/api/v1/push-tokens', [
            'token' => $tokens[0],
            'device_name' => 'Transferred Phone',
        ])->assertStatus(200);

        // User A now has 3 tokens left; User B has 1
        $this->assertEquals(3, $user->pushTokens()->count());
        $this->assertEquals(1, $userB->pushTokens()->count());
        $this->assertDatabaseHas('push_tokens', ['user_id' => $userB->id, 'token' => $tokens[0]]);
    }

    /**
     * EMPIRICAL CHALLENGE 3A:
     * Seller order isolation: Matching seller receives notification,
     * non-matching seller and cashier receive ZERO.
     */
    public function test_order_completed_sends_to_admin_manager_and_matching_seller_only(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            $count = count($request->data());
            return Http::response([
                'data' => array_fill(0, $count, ['status' => 'ok']),
            ], 200);
        });

        $admin = User::create(['name' => 'Global Admin', 'email' => 'gadmin@stress.com', 'password' => Hash::make('p'), 'role' => 'ADMIN', 'is_active' => true]);
        $mgr = User::create(['name' => 'Store Manager', 'email' => 'smgr@stress.com', 'password' => Hash::make('p'), 'role' => 'MANAGER', 'is_active' => true]);
        $matchingSeller = User::create(['name' => 'Seller Match', 'email' => 'match@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);
        $unrelatedSeller = User::create(['name' => 'Seller Other', 'email' => 'other@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);
        $cashierUser = User::create(['name' => 'Cashier User', 'email' => 'cashier@stress.com', 'password' => Hash::make('p'), 'role' => 'CASHIER', 'is_active' => true]);

        $tAdmin = 'ExponentPushToken[admin-tok-01]';
        $tMgr = 'ExponentPushToken[mgr-tok-02]';
        $tMatch = 'ExponentPushToken[match-seller-tok-03]';
        $tOther = 'ExponentPushToken[other-seller-tok-04]';
        $tCashier = 'ExponentPushToken[cashier-tok-05]';

        PushToken::create(['user_id' => $admin->id, 'token' => $tAdmin]);
        PushToken::create(['user_id' => $mgr->id, 'token' => $tMgr]);
        PushToken::create(['user_id' => $matchingSeller->id, 'token' => $tMatch]);
        PushToken::create(['user_id' => $unrelatedSeller->id, 'token' => $tOther]);
        PushToken::create(['user_id' => $cashierUser->id, 'token' => $tCashier]);

        $order = Order::create([
            'order_number' => 'ORD-MATCH-101',
            'user_id' => $admin->id,
            'seller_id' => $matchingSeller->id,
            'status' => 'COMPLETED',
            'total_amount' => 349.99,
        ]);

        $service = new PushNotificationService();
        $res = $service->notifyOrderCompleted($order);

        $this->assertEquals(3, $res['sent'], 'Should send to Admin, Manager, and matchingSeller');

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tAdmin, $tMgr, $tMatch, $tOther, $tCashier) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array($tAdmin, $tokens) &&
                   in_array($tMgr, $tokens) &&
                   in_array($tMatch, $tokens) &&
                   !in_array($tOther, $tokens) &&
                   !in_array($tCashier, $tokens);
        });
    }

    /**
     * EMPIRICAL CHALLENGE 3B:
     * Seller order isolation: When matching seller is deactivated (is_active = false),
     * that seller must receive ZERO notifications. Only active Admin and Manager receive it.
     */
    public function test_order_completed_with_deactivated_matching_seller_excludes_seller(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            $count = count($request->data());
            return Http::response([
                'data' => array_fill(0, $count, ['status' => 'ok']),
            ], 200);
        });

        $admin = User::create(['name' => 'Admin User', 'email' => 'adm.deact@stress.com', 'password' => Hash::make('p'), 'role' => 'ADMIN', 'is_active' => true]);
        $mgr = User::create(['name' => 'Mgr User', 'email' => 'mgr.deact@stress.com', 'password' => Hash::make('p'), 'role' => 'MANAGER', 'is_active' => true]);
        $deactivatedSeller = User::create(['name' => 'Deactivated Seller', 'email' => 'seller.deact@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => false]);
        $activeOtherSeller = User::create(['name' => 'Other Seller', 'email' => 'other.act@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);

        $tAdmin = 'ExponentPushToken[admin-deact-tok]';
        $tMgr = 'ExponentPushToken[mgr-deact-tok]';
        $tDeactSeller = 'ExponentPushToken[deact-seller-tok]';
        $tOtherSeller = 'ExponentPushToken[other-seller-tok]';

        PushToken::create(['user_id' => $admin->id, 'token' => $tAdmin]);
        PushToken::create(['user_id' => $mgr->id, 'token' => $tMgr]);
        PushToken::create(['user_id' => $deactivatedSeller->id, 'token' => $tDeactSeller]);
        PushToken::create(['user_id' => $activeOtherSeller->id, 'token' => $tOtherSeller]);

        $order = Order::create([
            'order_number' => 'ORD-DEACT-202',
            'user_id' => $admin->id,
            'seller_id' => $deactivatedSeller->id, // points directly to deactivated seller
            'status' => 'COMPLETED',
            'total_amount' => 120.00,
        ]);

        $service = new PushNotificationService();
        $res = $service->notifyOrderCompleted($order);

        $this->assertEquals(2, $res['sent'], 'Only Admin and Manager receive notification; deactivated matching seller is strictly excluded');

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tAdmin, $tMgr, $tDeactSeller, $tOtherSeller) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array($tAdmin, $tokens) &&
                   in_array($tMgr, $tokens) &&
                   !in_array($tDeactSeller, $tokens, 'Deactivated seller must NOT receive push notification') &&
                   !in_array($tOtherSeller, $tokens, 'Unrelated seller must NOT receive push notification');
        });
    }

    /**
     * EMPIRICAL CHALLENGE 3C:
     * Seller order isolation: When order has null seller (unassigned/online order),
     * only Admin and Manager receive notification; all sellers receive ZERO.
     */
    public function test_order_completed_with_null_seller_sends_only_to_admins_and_managers(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            $count = count($request->data());
            return Http::response([
                'data' => array_fill(0, $count, ['status' => 'ok']),
            ], 200);
        });

        $admin = User::create(['name' => 'Admin Null', 'email' => 'adm.null@stress.com', 'password' => Hash::make('p'), 'role' => 'ADMIN', 'is_active' => true]);
        $mgr = User::create(['name' => 'Mgr Null', 'email' => 'mgr.null@stress.com', 'password' => Hash::make('p'), 'role' => 'MANAGER', 'is_active' => true]);
        $seller = User::create(['name' => 'Seller Null', 'email' => 'slr.null@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);

        $tAdmin = 'ExponentPushToken[admin-null-tok]';
        $tMgr = 'ExponentPushToken[mgr-null-tok]';
        $tSeller = 'ExponentPushToken[seller-null-tok]';

        PushToken::create(['user_id' => $admin->id, 'token' => $tAdmin]);
        PushToken::create(['user_id' => $mgr->id, 'token' => $tMgr]);
        PushToken::create(['user_id' => $seller->id, 'token' => $tSeller]);

        $order = Order::create([
            'order_number' => 'ORD-NULL-303',
            'user_id' => null,
            'seller_id' => null,
            'status' => 'COMPLETED',
            'total_amount' => 88.00,
        ]);

        $service = new PushNotificationService();
        $res = $service->notifyOrderCompleted($order);

        $this->assertEquals(2, $res['sent'], 'Only Admin and Manager receive notification');

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tAdmin, $tMgr, $tSeller) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array($tAdmin, $tokens) &&
                   in_array($tMgr, $tokens) &&
                   !in_array($tSeller, $tokens);
        });
    }


    /**
     * EMPIRICAL CHALLENGE 4:
     * Inactive user suppression across sendToUser and sendToRoles.
     * Both User object and User UUID string must abort without network calls.
     */
    public function test_inactive_user_suppression_rigorous(): void
    {
        Http::fake();

        $inactiveUser = User::create([
            'name' => 'Strictly Deactivated',
            'email' => 'deactivated@stress.com',
            'password' => Hash::make('p'),
            'role' => 'MANAGER',
            'is_active' => false,
        ]);

        PushToken::create([
            'user_id' => $inactiveUser->id,
            'token' => 'ExponentPushToken[deactivated-user-token-01]',
        ]);

        $service = new PushNotificationService();

        // 1. sendToUser with model instance
        $resModel = $service->sendToUser($inactiveUser, ['title' => 'Test', 'body' => 'Test']);
        $this->assertEquals(0, $resModel['sent']);
        $this->assertEquals(0, $resModel['failed']);
        Http::assertNothingSent();

        // 2. sendToUser with UUID string
        $resUuid = $service->sendToUser($inactiveUser->id, ['title' => 'Test', 'body' => 'Test']);
        $this->assertEquals(0, $resUuid['sent']);
        $this->assertEquals(0, $resUuid['failed']);
        Http::assertNothingSent();

        // 3. sendToRoles when all users in the requested role are inactive
        $resRole = $service->sendToRoles(['MANAGER'], ['title' => 'Role test', 'body' => 'Role test']);
        $this->assertEquals(0, $resRole['sent']);
        Http::assertNothingSent();
    }

    /**
     * EMPIRICAL CHALLENGE 5:
     * Cross-user token deletion isolation.
     * Attacker cannot delete victim's token via API endpoint.
     */
    public function test_cross_user_token_deletion_attack_fails_to_remove_victim_token(): void
    {
        $victim = User::create(['name' => 'Victim User', 'email' => 'victim@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);
        $attacker = User::create(['name' => 'Attacker User', 'email' => 'attacker@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        $victimToken = 'ExponentPushToken[victim-phone-hardware-id-999]';
        PushToken::create([
            'user_id' => $victim->id,
            'token' => $victimToken,
            'device_name' => 'Victim Phone',
        ]);

        // Attacker attempts to delete victim's token
        Sanctum::actingAs($attacker);
        $res = $this->deleteJson('/api/v1/push-tokens/' . urlencode($victimToken));
        $res->assertStatus(200);

        // Victim's token MUST still exist in database
        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $victim->id,
            'token' => $victimToken,
        ]);
        $this->assertEquals(1, $victim->pushTokens()->count());
    }

    /**
     * EMPIRICAL CHALLENGE 6:
     * Dead token pruning vs transient error resilience in multi-token response.
     */
    public function test_dead_token_pruning_on_device_not_registered_vs_transient_error(): void
    {
        $user = User::create(['name' => 'Prune Test User', 'email' => 'prune@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER']);

        $tOk = 'ExponentPushToken[token-healthy-01]';
        $tDead = 'ExponentPushToken[token-dead-unregistered-02]';
        $tTransient = 'ExponentPushToken[token-rate-limited-03]';

        PushToken::create(['user_id' => $user->id, 'token' => $tOk]);
        PushToken::create(['user_id' => $user->id, 'token' => $tDead]);
        PushToken::create(['user_id' => $user->id, 'token' => $tTransient]);

        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 'ticket-1'],
                    [
                        'status' => 'error',
                        'message' => '"ExponentPushToken[token-dead-unregistered-02]" is not a registered push notification recipient',
                        'details' => ['error' => 'DeviceNotRegistered'],
                    ],
                    [
                        'status' => 'error',
                        'message' => 'Rate limit exceeded for token',
                        'details' => ['error' => 'MessageRateExceeded'],
                    ],
                ],
            ], 200),
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush([$tOk, $tDead, $tTransient], [
            'title' => 'Batch Test',
            'body' => 'Testing Pruning',
        ]);

        $this->assertEquals(1, $result['sent']);
        $this->assertEquals(2, $result['failed']);
        $this->assertEquals([$tDead], $result['purged']);

        // Dead token must be deleted from database
        $this->assertDatabaseMissing('push_tokens', ['token' => $tDead]);

        // Healthy and transiently failed tokens must be retained
        $this->assertDatabaseHas('push_tokens', ['token' => $tOk]);
        $this->assertDatabaseHas('push_tokens', ['token' => $tTransient]);
        $this->assertEquals(2, $user->pushTokens()->count());
    }

    /**
     * EMPIRICAL CHALLENGE 7:
     * Order notification payload flexibility: Eloquent Model vs associative array.
     */
    public function test_order_completed_handles_model_and_array_payloads(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [['status' => 'ok']],
            ], 200),
        ]);

        $admin = User::create(['name' => 'Admin Array', 'email' => 'adm.arr@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN']);
        PushToken::create(['user_id' => $admin->id, 'token' => 'ExponentPushToken[admin-array-tok]']);

        $service = new PushNotificationService();

        // Plain array representation of order
        $orderArray = [
            'id' => '00000000-0000-0000-0000-000000000001',
            'order_number' => 'ORD-ARRAY-01',
            'total_amount' => 250.00,
            'seller_id' => null,
        ];

        $res = $service->notifyOrderCompleted($orderArray);
        $this->assertEquals(1, $res['sent']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            $data = $request->data()[0];
            return $data['title'] === 'Order #ORD-ARRAY-01 Completed' &&
                   $data['data']['order_id'] === '00000000-0000-0000-0000-000000000001';
        });
    }

    /**
     * EMPIRICAL CHALLENGE 8:
     * Input normalization & whitespace trimming on registration.
     */
    public function test_push_token_registration_trims_whitespace_and_normalizes_platform(): void
    {
        $user = User::create([
            'name' => 'Trim User',
            'email' => 'trim@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);
        Sanctum::actingAs($user);

        $rawTokenWithSpaces = "   ExponentPushToken[trimmed-token-12345]   \n";

        $res = $this->postJson('/api/v1/push-tokens', [
            'token' => $rawTokenWithSpaces,
            'platform' => '  ANDROID  ',
            'device_name' => 'Pixel 8',
        ]);
        $res->assertStatus(200);

        $this->assertDatabaseHas('push_tokens', [
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[trimmed-token-12345]',
            'platform' => 'android',
            'device_name' => 'Pixel 8',
        ]);
    }

    /**
     * EMPIRICAL CHALLENGE 9:
     * User cascade deletion cleans up all push tokens in the database.
     */
    public function test_user_cascade_deletion_cleans_up_all_push_tokens(): void
    {
        $user = User::create([
            'name' => 'Deletable User',
            'email' => 'deletable@test.com',
            'password' => Hash::make('secret123'),
            'role' => 'SELLER',
        ]);

        $tokens = [
            'ExponentPushToken[cascade-token-1]',
            'ExponentPushToken[cascade-token-2]',
            'ExponentPushToken[cascade-token-3]',
        ];

        foreach ($tokens as $t) {
            PushToken::create(['user_id' => $user->id, 'token' => $t]);
        }

        $this->assertEquals(3, PushToken::where('user_id', $user->id)->count());

        // Delete user directly
        $user->forceDelete();

        // All push tokens must have been cascaded
        $this->assertEquals(0, PushToken::where('user_id', $user->id)->count());
        foreach ($tokens as $t) {
            $this->assertDatabaseMissing('push_tokens', ['token' => $t]);
        }
    }

    /**
     * EMPIRICAL CHALLENGE 10:
     * Matching seller has multiple registered devices (tablet + phone).
     * Order completion must dispatch to ALL tokens belonging to the matching seller,
     * while other sellers still receive 0.
     */
    public function test_matching_seller_with_multiple_devices_receives_all_tokens(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            return Http::response([
                'data' => array_fill(0, count($request->data()), ['status' => 'ok']),
            ], 200);
        });

        $admin = User::create(['name' => 'Admin Multi', 'email' => 'adm.multi@stress.com', 'password' => Hash::make('p'), 'role' => 'ADMIN', 'is_active' => true]);
        $sellerA = User::create(['name' => 'Seller Dual Device', 'email' => 'sellerA.dual@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);
        $sellerB = User::create(['name' => 'Seller B Single Device', 'email' => 'sellerB.single@stress.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);

        $tAdmin = 'ExponentPushToken[adm-multi-tok]';
        $tSellerA_Phone = 'ExponentPushToken[sellerA-phone-tok]';
        $tSellerA_Tablet = 'ExponentPushToken[sellerA-tablet-tok]';
        $tSellerB = 'ExponentPushToken[sellerB-phone-tok]';

        PushToken::create(['user_id' => $admin->id, 'token' => $tAdmin]);
        PushToken::create(['user_id' => $sellerA->id, 'token' => $tSellerA_Phone]);
        PushToken::create(['user_id' => $sellerA->id, 'token' => $tSellerA_Tablet]);
        PushToken::create(['user_id' => $sellerB->id, 'token' => $tSellerB]);

        $order = Order::create([
            'order_number' => 'ORD-DUAL-404',
            'user_id' => $sellerA->id,
            'seller_id' => $sellerA->id,
            'status' => 'COMPLETED',
            'total_amount' => 500.00,
        ]);

        $service = new PushNotificationService();
        $res = $service->notifyOrderCompleted($order);

        // 1 admin token + 2 sellerA tokens = 3 total tokens sent
        $this->assertEquals(3, $res['sent']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tAdmin, $tSellerA_Phone, $tSellerA_Tablet, $tSellerB) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array($tAdmin, $tokens) &&
                   in_array($tSellerA_Phone, $tokens) &&
                   in_array($tSellerA_Tablet, $tokens) &&
                   !in_array($tSellerB, $tokens);
        });
    }

    /**
     * EMPIRICAL CHALLENGE 11:
     * Batch chunking over 200 tokens and token sanitization (empty/whitespace/duplicates).
     */
    public function test_send_push_deduplicates_sanitizes_and_chunks_over_100_tokens(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            return Http::response([
                'data' => array_fill(0, count($request->data()), ['status' => 'ok']),
            ], 200);
        });

        // Generate 250 distinct valid tokens
        $tokens = [];
        for ($i = 0; $i < 250; $i++) {
            $tokens[] = "ExponentPushToken[bulk-token-stress-{$i}]";
        }

        // Inject duplicates, empty strings, and whitespace-only strings
        $dirtyTokens = array_merge($tokens, [
            '',
            '   ',
            $tokens[0],
            $tokens[10],
            $tokens[100],
        ]);

        $service = new PushNotificationService();
        $result = $service->sendPush($dirtyTokens, [
            'title' => 'Bulk Stress Notification',
            'body' => 'Testing 250 tokens in batches',
        ]);

        $this->assertEquals(250, $result['sent']);
        $this->assertEquals(0, $result['failed']);

        // Assert exactly 3 HTTP requests were dispatched (100, 100, 50)
        Http::assertSentCount(3);

        $sentRequests = Http::recorded();
        $chunk0Count = count($sentRequests[0][0]->data());
        $chunk1Count = count($sentRequests[1][0]->data());
        $chunk2Count = count($sentRequests[2][0]->data());

        $this->assertEquals(100, $chunk0Count);
        $this->assertEquals(100, $chunk1Count);
        $this->assertEquals(50, $chunk2Count);
    }

    /**
     * EMPIRICAL CHALLENGE 12:
     * Restock Completed strictly excludes Sellers even if seller has active push tokens.
     */
    public function test_restock_strictly_excludes_sellers_adversarial(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            return Http::response([
                'data' => array_fill(0, count($request->data()), ['status' => 'ok']),
            ], 200);
        });

        $admin = User::create(['name' => 'Restock Admin', 'email' => 'rst.adm@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN', 'is_active' => true]);
        $mgr = User::create(['name' => 'Restock Mgr', 'email' => 'rst.mgr@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER', 'is_active' => true]);
        $seller = User::create(['name' => 'Restock Seller', 'email' => 'rst.slr@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);

        $tAdmin = 'ExponentPushToken[rst-adm-tok]';
        $tMgr = 'ExponentPushToken[rst-mgr-tok]';
        $tSeller = 'ExponentPushToken[rst-slr-tok]';

        PushToken::create(['user_id' => $admin->id, 'token' => $tAdmin]);
        PushToken::create(['user_id' => $mgr->id, 'token' => $tMgr]);
        PushToken::create(['user_id' => $seller->id, 'token' => $tSeller]);

        $service = new PushNotificationService();
        $res = $service->notifyRestockCompleted([
            'id' => '00000000-0000-0000-0000-000000000099',
            'session_code' => 'RS-BULK-99',
            'status' => 'verified',
            'total_cost' => 4500.00,
        ]);

        $this->assertEquals(2, $res['sent']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tAdmin, $tMgr, $tSeller) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array($tAdmin, $tokens) &&
                   in_array($tMgr, $tokens) &&
                   !in_array($tSeller, $tokens);
        });
    }

    /**
     * EMPIRICAL CHALLENGE 13:
     * Security audit event strictly limits to Admin and Super Admin; Manager and Seller receive ZERO.
     */
    public function test_security_audit_strictly_excludes_manager_and_seller(): void
    {
        Http::fake(function (\Illuminate\Http\Client\Request $request) {
            return Http::response([
                'data' => array_fill(0, count($request->data()), ['status' => 'ok']),
            ], 200);
        });

        $superAdmin = User::create(['name' => 'Super Admin', 'email' => 'super@test.com', 'password' => Hash::make('p'), 'role' => 'SUPER_ADMIN', 'is_active' => true]);
        $admin = User::create(['name' => 'Sec Admin', 'email' => 'sec.adm@test.com', 'password' => Hash::make('p'), 'role' => 'ADMIN', 'is_active' => true]);
        $mgr = User::create(['name' => 'Sec Mgr', 'email' => 'sec.mgr@test.com', 'password' => Hash::make('p'), 'role' => 'MANAGER', 'is_active' => true]);
        $seller = User::create(['name' => 'Sec Seller', 'email' => 'sec.slr@test.com', 'password' => Hash::make('p'), 'role' => 'SELLER', 'is_active' => true]);

        $tSuper = 'ExponentPushToken[sec-super-tok]';
        $tAdmin = 'ExponentPushToken[sec-admin-tok]';
        $tMgr = 'ExponentPushToken[sec-mgr-tok]';
        $tSeller = 'ExponentPushToken[sec-slr-tok]';

        PushToken::create(['user_id' => $superAdmin->id, 'token' => $tSuper]);
        PushToken::create(['user_id' => $admin->id, 'token' => $tAdmin]);
        PushToken::create(['user_id' => $mgr->id, 'token' => $tMgr]);
        PushToken::create(['user_id' => $seller->id, 'token' => $tSeller]);

        $service = new PushNotificationService();
        $res = $service->notifySecurityEvent([
            'id' => '00000000-0000-0000-0000-000000000088',
            'action' => 'user.permission_escalated',
            'actor_name' => 'Audit Subsystem',
            'target' => 'Role Super Admin',
        ]);

        $this->assertEquals(2, $res['sent']);

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) use ($tSuper, $tAdmin, $tMgr, $tSeller) {
            $tokens = collect($request->data())->pluck('to')->all();
            return in_array($tSuper, $tokens) &&
                   in_array($tAdmin, $tokens) &&
                   !in_array($tMgr, $tokens) &&
                   !in_array($tSeller, $tokens);
        });
    }
}

