<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * AuthBoundaryAndConcurrencyTest
 *
 * Comprehensive adversarial verification suite by Challenger 2:
 * 1. Multi-device token issuance, isolation, and all_devices revocation
 * 2. Device token pruning & duplicate device login handling
 * 3. Rapid/repeated logout race condition handling
 * 4. Mid-session user deactivation & immediate permission cutoff
 * 5. Multi-device token invalidation upon password change
 * 6. Soft-deleted user login & token handling
 * 7. User CRUD input validation & boundary constraints (duplicate emails, invalid roles, short passwords)
 * 8. Edge/boundary conditions: whitespace trimming, email case-insensitivity, malformed Bearer headers, super-admin protection
 */
class AuthBoundaryAndConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    private User $superAdmin;
    private User $admin;
    private User $manager;
    private User $cashier;
    private ProductVariant $variant;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->superAdmin = User::create([
            'name'             => 'Super Root Admin',
            'email'            => 'super@pos.test',
            'password'         => Hash::make('SuperSecret123!'),
            'role'             => 'SUPER_ADMIN',
            'phone'            => '+85512111222',
            'is_active'        => true,
            'permission_group' => 'Executive',
        ]);

        $this->admin = User::create([
            'name'             => 'System Admin',
            'email'            => 'admin@pos.test',
            'password'         => Hash::make('AdminSecret123!'),
            'role'             => 'ADMIN',
            'phone'            => '+85512222333',
            'is_active'        => true,
            'permission_group' => 'BranchManagement',
        ]);

        $this->manager = User::create([
            'name'             => 'Operations Manager',
            'email'            => 'manager@pos.test',
            'password'         => Hash::make('ManagerSecret123!'),
            'role'             => 'MANAGER',
            'phone'            => '+85512333444',
            'is_active'        => true,
            'permission_group' => 'Operations',
        ]);

        $this->cashier = User::create([
            'name'             => 'Counter Cashier',
            'email'            => 'cashier@pos.test',
            'password'         => Hash::make('CashierSecret123!'),
            'role'             => 'SELLER',
            'phone'            => '+85512444555',
            'is_active'        => true,
            'permission_group' => 'Cashiers',
        ]);

        $cat = ProductCategory::create([
            'name' => 'General Category',
            'code' => 'GEN',
        ]);

        $prod = Product::create([
            'category_id'           => $cat->id,
            'name'                  => 'Test Stock Product',
            'sku'                   => 'TST-PROD-01',
            'barcode'               => '8851000000001',
            'purchase_price'        => 10.00,
            'selling_price'         => 20.00,
            'default_reorder_level' => 5,
            'is_active'             => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_id'       => $prod->id,
            'sku'              => 'TST-VAR-01',
            'barcode'          => '8851000000002',
            'cost_price'       => 10.00,
            'selling_price'    => 20.00,
            'quantity_on_hand' => 50,
            'reorder_level'    => 5,
            'is_active'        => true,
        ]);
    }

    private function resetAuthGuards(): void
    {
        if (app()->bound('auth')) {
            auth()->forgetGuards();
        }
    }

    // =========================================================================
    // 1. MULTI-DEVICE TOKEN ISOLATION & REVOCATION
    // =========================================================================

    public function test_multi_device_login_issues_independent_tokens(): void
    {
        // Device 1: iPad POS
        $res1 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'cashier@pos.test',
            'password'    => 'CashierSecret123!',
            'device_name' => 'ipad-pos-01',
        ]);
        $res1->assertStatus(200);
        $token1 = $res1->json('data.token');

        // Device 2: Android Tablet POS
        $res2 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'cashier@pos.test',
            'password'    => 'CashierSecret123!',
            'device_name' => 'android-pos-02',
        ]);
        $res2->assertStatus(200);
        $token2 = $res2->json('data.token');

        // Verify tokens are distinct
        $this->assertNotEquals($token1, $token2);
        $this->assertEquals(2, $this->cashier->tokens()->count());

        // Both tokens can access protected endpoints
        $this->resetAuthGuards();
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(200);

        $this->resetAuthGuards();
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);
    }

    public function test_single_device_logout_only_invalidates_calling_device_token(): void
    {
        // Login Device A and Device B
        $tokenA = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'device-a',
        ])->json('data.token');

        $tokenB = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'device-b',
        ])->json('data.token');

        $this->assertEquals(2, $this->admin->tokens()->count());

        // Logout from Device A only
        $this->resetAuthGuards();
        $logoutRes = $this->withToken($tokenA)->postJson('/api/v1/auth/logout');
        $logoutRes->assertStatus(200)->assertJson(['success' => true]);

        // Device A token is now invalid (401)
        $this->resetAuthGuards();
        $this->withToken($tokenA)->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->resetAuthGuards();
        $this->withToken($tokenA)->getJson('/api/v1/users')->assertStatus(401);

        // Device B token remains valid (200)
        $this->resetAuthGuards();
        $this->withToken($tokenB)->getJson('/api/v1/auth/me')->assertStatus(200);
        $this->resetAuthGuards();
        $this->withToken($tokenB)->getJson('/api/v1/users')->assertStatus(200);

        // Check DB has exactly 1 token remaining
        $this->assertEquals(1, $this->admin->tokens()->count());
    }

    public function test_logout_with_all_devices_flag_invalidates_all_tokens(): void
    {
        // Create 3 sessions on 3 devices
        $token1 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'manager@pos.test',
            'password'    => 'ManagerSecret123!',
            'device_name' => 'terminal-1',
        ])->json('data.token');

        $token2 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'manager@pos.test',
            'password'    => 'ManagerSecret123!',
            'device_name' => 'terminal-2',
        ])->json('data.token');

        $token3 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'manager@pos.test',
            'password'    => 'ManagerSecret123!',
            'device_name' => 'terminal-3',
        ])->json('data.token');

        $this->assertEquals(3, $this->manager->tokens()->count());

        // Logout from Terminal 1 with all_devices=true
        $this->resetAuthGuards();
        $logoutRes = $this->withToken($token1)->postJson('/api/v1/auth/logout', [
            'all_devices' => true,
        ]);
        $logoutRes->assertStatus(200);

        // All 3 tokens must now be rejected with 401
        $this->resetAuthGuards();
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->resetAuthGuards();
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->resetAuthGuards();
        $this->withToken($token3)->getJson('/api/v1/auth/me')->assertStatus(401);

        // DB tokens for manager should be 0
        $this->assertEquals(0, $this->manager->tokens()->count());
    }

    public function test_same_device_relogin_prunes_stale_token_preventing_token_bloat(): void
    {
        // First login on terminal-pos-main
        $res1 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'cashier@pos.test',
            'password'    => 'CashierSecret123!',
            'device_name' => 'terminal-pos-main',
        ]);
        $token1 = $res1->json('data.token');
        $this->assertEquals(1, $this->cashier->tokens()->where('name', 'terminal-pos-main')->count());

        // Second login on SAME device name without explicit logout
        $res2 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'cashier@pos.test',
            'password'    => 'CashierSecret123!',
            'device_name' => 'terminal-pos-main',
        ]);
        $token2 = $res2->json('data.token');
        $this->assertNotEquals($token1, $token2);

        // Token count for this device must remain 1
        $this->assertEquals(1, $this->cashier->tokens()->where('name', 'terminal-pos-main')->count());

        // Old token1 must now be invalid (401)
        $this->resetAuthGuards();
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(401);

        // New token2 must be active (200)
        $this->resetAuthGuards();
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);
    }

    // =========================================================================
    // 2. RAPID & REPEATED LOGOUT RACE CONDITIONS
    // =========================================================================

    public function test_repeated_logout_with_same_token_returns_401_on_second_attempt(): void
    {
        $token = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierSecret123!',
        ])->json('data.token');

        // First logout succeeds
        $this->resetAuthGuards();
        $res1 = $this->withToken($token)->postJson('/api/v1/auth/logout');
        $res1->assertStatus(200);

        // Immediate second logout with the same token fails with 401
        $this->resetAuthGuards();
        $res2 = $this->withToken($token)->postJson('/api/v1/auth/logout');
        $res2->assertStatus(401)->assertJson(['success' => false, 'message' => 'Unauthenticated.']);
    }

    // =========================================================================
    // 3. MID-SESSION USER DEACTIVATION HANDLING
    // =========================================================================

    public function test_deactivated_user_with_active_token_is_immediately_blocked_on_me_and_tokens_purged(): void
    {
        // 1. User logs in when active
        $token = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierSecret123!',
        ])->json('data.token');

        $this->resetAuthGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 2. Admin deactivates the user
        $this->cashier->update(['is_active' => false]);

        // 3. User attempts to call /api/v1/auth/me with existing token
        $this->resetAuthGuards();
        $res = $this->withToken($token)->getJson('/api/v1/auth/me');
        $res->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Your account has been deactivated. Contact an administrator.',
            ]);

        // 4. Tokens must have been purged from database
        $this->assertEquals(0, $this->cashier->tokens()->count());

        // 5. Subsequent request is now 401 Unauthenticated because token was destroyed
        $this->resetAuthGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_deactivated_user_with_active_token_is_blocked_by_checkrole_middleware_on_domain_routes(): void
    {
        // 1. Manager logs in
        $token = $this->postJson('/api/v1/auth/login', [
            'email'    => 'manager@pos.test',
            'password' => 'ManagerSecret123!',
        ])->json('data.token');

        // Verify manager can access inventory adjustment
        $this->resetAuthGuards();
        $this->withToken($token)->postJson('/api/v1/inventory/adjust', [
            'variant_id'       => $this->variant->id,
            'current_quantity' => 50,
            'new_quantity'     => 60,
            'difference'       => 10,
            'reason'           => 'Audit',
        ])->assertStatus(200);

        // 2. Admin deactivates manager mid-shift
        $this->manager->update(['is_active' => false]);

        // 3. Manager attempts another stock adjustment with existing token
        $this->resetAuthGuards();
        $res = $this->withToken($token)->postJson('/api/v1/inventory/adjust', [
            'variant_id'       => $this->variant->id,
            'current_quantity' => 60,
            'new_quantity'     => 70,
            'difference'       => 10,
            'reason'           => 'Audit',
        ]);

        $res->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Your account has been deactivated. Contact an administrator.',
            ]);
    }

    public function test_reactivating_user_allows_fresh_login_and_token_issuance(): void
    {
        // Deactivate user
        $this->cashier->update(['is_active' => false]);

        // Login fails
        $this->resetAuthGuards();
        $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierSecret123!',
        ])->assertStatus(403);

        // Reactivate user
        $this->cashier->update(['is_active' => true]);

        // Login now succeeds
        $this->resetAuthGuards();
        $res = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierSecret123!',
        ]);
        $res->assertStatus(200)->assertJson(['success' => true]);
        $this->assertNotEmpty($res->json('data.token'));
    }

    // =========================================================================
    // 4. PASSWORD CHANGE MULTI-DEVICE INVALIDATION
    // =========================================================================

    public function test_password_change_invalidates_all_other_device_tokens_but_preserves_current_session(): void
    {
        // 1. Log in on Device 1 (current session)
        $token1 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'current-laptop',
        ])->json('data.token');

        // 2. Log in on Device 2 & Device 3
        $token2 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'other-phone',
        ])->json('data.token');

        $token3 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'other-tablet',
        ])->json('data.token');

        $this->assertEquals(3, $this->admin->tokens()->count());

        // 3. User changes password from Device 1
        $this->resetAuthGuards();
        $changeRes = $this->withToken($token1)->patchJson('/api/v1/auth/password', [
            'current_password' => 'AdminSecret123!',
            'new_password'     => 'BrandNewAdminPass456!',
        ]);

        $changeRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Password updated successfully.',
            ]);

        // 4. Current Device 1 session remains valid and authenticated
        $this->resetAuthGuards();
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 5. Other Device sessions (Device 2 and 3) must be revoked and return 401
        $this->resetAuthGuards();
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(401);

        $this->resetAuthGuards();
        $this->withToken($token3)->getJson('/api/v1/auth/me')->assertStatus(401);

        // 6. DB should now have only 1 token (Device 1)
        $this->assertEquals(1, $this->admin->tokens()->count());

        // 7. Old password no longer works for login
        $this->resetAuthGuards();
        $oldLogin = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'AdminSecret123!',
        ]);
        $oldLogin->assertStatus(422);

        // 8. New password works for fresh login
        $this->resetAuthGuards();
        $newLogin = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'BrandNewAdminPass456!',
        ]);
        $newLogin->assertStatus(200)->assertJson(['success' => true]);
    }

    public function test_password_change_with_incorrect_current_password_fails_and_preserves_tokens(): void
    {
        $token1 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'device-1',
        ])->json('data.token');

        $token2 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'device-2',
        ])->json('data.token');

        // Attempt password change with wrong current password
        $this->resetAuthGuards();
        $res = $this->withToken($token1)->patchJson('/api/v1/auth/password', [
            'current_password' => 'WrongCurrentPassword999!',
            'new_password'     => 'ValidNewPassword123!',
        ]);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['current_password'],
            ]);

        // Tokens for both devices should still be active
        $this->assertEquals(2, $this->admin->tokens()->count());
        $this->resetAuthGuards();
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(200);
        $this->resetAuthGuards();
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);
    }

    public function test_password_change_requires_min_8_chars(): void
    {
        $token = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'AdminSecret123!',
        ])->json('data.token');

        $this->resetAuthGuards();
        $res = $this->withToken($token)->patchJson('/api/v1/auth/password', [
            'current_password' => 'AdminSecret123!',
            'new_password'     => 'short7!',
        ]);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'errors' => ['new_password'],
            ]);
    }

    // =========================================================================
    // 5. SOFT-DELETED USER HANDLING
    // =========================================================================

    public function test_soft_deleted_user_cannot_login(): void
    {
        // Soft-delete the cashier
        $this->cashier->delete();
        $this->assertSoftDeleted('users', ['id' => $this->cashier->id]);

        // Attempt login -> fails with 422 (credentials incorrect because user query ignores soft-deleted)
        $this->resetAuthGuards();
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierSecret123!',
        ]);

        $response->assertStatus(422);
    }

    public function test_soft_deleted_user_with_active_token_returns_401(): void
    {
        // 1. User logs in
        $token = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierSecret123!',
        ])->json('data.token');

        // 2. User is deleted
        $this->cashier->delete();

        // 3. User attempts to make authenticated request
        $this->resetAuthGuards();
        $response = $this->withToken($token)->getJson('/api/v1/auth/me');

        $response->assertStatus(401);
    }

    // =========================================================================
    // 6. USER CRUD VALIDATION & BOUNDARY DEFENSES
    // =========================================================================

    public function test_user_creation_rejects_duplicate_email(): void
    {
        $payload = [
            'name'     => 'Duplicate Email Staff',
            'email'    => 'admin@pos.test', // already taken
            'password' => 'SecurePassword123!',
            'role'     => 'SELLER',
        ];

        $this->resetAuthGuards();
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/users', $payload);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'errors' => ['email'],
            ]);
    }

    public function test_user_creation_rejects_invalid_role(): void
    {
        $payload = [
            'name'     => 'Invalid Role Staff',
            'email'    => 'invalidrole@pos.test',
            'password' => 'SecurePassword123!',
            'role'     => 'SUPER_HACKER',
        ];

        $this->resetAuthGuards();
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/users', $payload);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'errors' => ['role'],
            ]);
    }

    public function test_user_creation_rejects_short_password(): void
    {
        $payload = [
            'name'     => 'Short Pass Staff',
            'email'    => 'shortpass@pos.test',
            'password' => 'short7!',
            'role'     => 'SELLER',
        ];

        $this->resetAuthGuards();
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/users', $payload);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'errors' => ['password'],
            ]);
    }

    public function test_user_update_allows_keeping_same_email(): void
    {
        $this->resetAuthGuards();
        $res = $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/users/{$this->cashier->id}", [
            'email' => 'cashier@pos.test',
            'name'  => 'Updated Counter Staff',
        ]);

        $res->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'name'  => 'Updated Counter Staff',
                    'email' => 'cashier@pos.test',
                ],
            ]);
    }

    public function test_user_update_rejects_email_taken_by_another_user(): void
    {
        $this->resetAuthGuards();
        $res = $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/users/{$this->cashier->id}", [
            'email' => 'admin@pos.test',
        ]);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'errors' => ['email'],
            ]);
    }

    // =========================================================================
    // 7. BOUNDARY CASES, INPUT NORMALIZATION & DEFENSIVE ENFORCEMENT
    // =========================================================================

    public function test_login_email_is_case_insensitive_and_whitespace_trimmed(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => '   ADMIN@POS.TEST   ',
            'password' => 'AdminSecret123!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'user' => [
                        'email' => 'admin@pos.test',
                        'role'  => 'ADMIN',
                    ],
                ],
            ]);
    }

    public function test_malformed_or_tampered_bearer_headers_handled_safely(): void
    {
        $tamperedTokens = [
            '',
            ' ',
            'null',
            'undefined',
            'Bearer',
            '999999|maliciouspayload',
            'Bearer token-without-valid-structure',
            str_repeat('A', 1000),
        ];

        foreach ($tamperedTokens as $badToken) {
            $this->resetAuthGuards();
            $response = $this->withHeaders(['Authorization' => "Bearer {$badToken}"])
                ->getJson('/api/v1/auth/me');

            $response->assertStatus(401)
                ->assertJson([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ]);
        }
    }

    public function test_super_admin_cannot_be_deactivated_or_deleted(): void
    {
        // 1. Attempt deactivation of Super Admin -> 403 Forbidden
        $this->resetAuthGuards();
        $deactivateRes = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/users/{$this->superAdmin->id}/status", [
                'is_active' => false,
            ]);

        $deactivateRes->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Super Admin accounts cannot be deactivated.',
            ]);

        $this->superAdmin->refresh();
        $this->assertTrue((bool) $this->superAdmin->is_active);

        // 2. Attempt deletion of Super Admin -> 403 Forbidden
        $this->resetAuthGuards();
        $deleteRes = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/users/{$this->superAdmin->id}");

        $deleteRes->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Super Admin accounts cannot be deleted.',
            ]);

        $this->assertDatabaseHas('users', [
            'id'         => $this->superAdmin->id,
            'deleted_at' => null,
        ]);
    }

    public function test_user_endpoints_with_non_existent_uuid_returns_404(): void
    {
        $fakeUuid = '00000000-0000-0000-0000-000000000000';

        // Show non-existent
        $this->resetAuthGuards();
        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/users/{$fakeUuid}")
            ->assertStatus(404)
            ->assertJson(['success' => false]);

        // Update non-existent
        $this->resetAuthGuards();
        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/users/{$fakeUuid}", ['name' => 'Ghost'])
            ->assertStatus(404)
            ->assertJson(['success' => false]);

        // Status non-existent
        $this->resetAuthGuards();
        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/users/{$fakeUuid}/status", ['is_active' => false])
            ->assertStatus(404)
            ->assertJson(['success' => false]);

        // Delete non-existent
        $this->resetAuthGuards();
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/users/{$fakeUuid}")
            ->assertStatus(404)
            ->assertJson(['success' => false]);
    }

    public function test_super_admin_has_bypass_access_to_all_role_restricted_routes(): void
    {
        // Users endpoint (SUPER_ADMIN, ADMIN)
        $this->resetAuthGuards();
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/users')->assertStatus(200);

        // Audit logs endpoint (SUPER_ADMIN, ADMIN)
        $this->resetAuthGuards();
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/audit-logs')->assertStatus(200);

        // Inventory adjustment endpoint (SUPER_ADMIN, ADMIN, MANAGER)
        $this->resetAuthGuards();
        $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/v1/inventory/adjust', [
            'variant_id'       => $this->variant->id,
            'current_quantity' => 50,
            'new_quantity'     => 100,
            'difference'       => 50,
            'reason'           => 'Audit',
        ])->assertStatus(200);

        // Expenses endpoint (SUPER_ADMIN, ADMIN, MANAGER)
        $this->resetAuthGuards();
        $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/expenses')->assertStatus(200);
    }
}
