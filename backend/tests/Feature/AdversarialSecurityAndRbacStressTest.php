<?php

namespace Tests\Feature;

use App\Http\Middleware\CheckRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * AdversarialSecurityAndRbacStressTest
 *
 * Empirical adversarial stress harness for M1 Authentication & RBAC security:
 * 1. Privilege Escalation Attacks (Admin deleting SuperAdmin, Cashier editing role, etc.)
 * 2. Role Casing, Normalization, Synonyms (CASHIER <-> SELLER, whitespace, unrecognized roles)
 * 3. Token Header Variations, Malformations & Tampering
 * 4. Token & Session Lifecycle (Mid-session deactivation, soft-deleted user token reuse, multi-device invalidation)
 * 5. Full Route & Role Permission Matrix Stress Testing
 */
class AdversarialSecurityAndRbacStressTest extends TestCase
{
    use DatabaseMigrations;

    private User $superAdmin;
    private User $admin;
    private User $manager;
    private User $cashier;
    private User $deactivatedUser;
    private ProductVariant $testVariant;
    private ProductCategory $testCategory;
    private Product $testProduct;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->superAdmin = User::create([
            'name'             => 'Root Super Admin',
            'email'            => 'root.superadmin@pos.test',
            'password'         => Hash::make('SuperSecret123!'),
            'role'             => 'SUPER_ADMIN',
            'phone'            => '+85511000001',
            'is_active'        => true,
            'permission_group' => 'Executive',
        ]);

        $this->admin = User::create([
            'name'             => 'Branch Administrator',
            'email'            => 'branch.admin@pos.test',
            'password'         => Hash::make('AdminSecret123!'),
            'role'             => 'ADMIN',
            'phone'            => '+85511000002',
            'is_active'        => true,
            'permission_group' => 'Management',
        ]);

        $this->manager = User::create([
            'name'             => 'Store Supervisor',
            'email'            => 'store.manager@pos.test',
            'password'         => Hash::make('ManagerSecret123!'),
            'role'             => 'MANAGER',
            'phone'            => '+85511000003',
            'is_active'        => true,
            'permission_group' => 'Supervisor',
        ]);

        $this->cashier = User::create([
            'name'             => 'Point of Sale Cashier',
            'email'            => 'pos.cashier@pos.test',
            'password'         => Hash::make('CashierSecret123!'),
            'role'             => 'SELLER',
            'phone'            => '+85511000004',
            'is_active'        => true,
            'permission_group' => 'POS',
        ]);

        $this->deactivatedUser = User::create([
            'name'             => 'Terminated Employee',
            'email'            => 'terminated@pos.test',
            'password'         => Hash::make('TerminatedPass123!'),
            'role'             => 'SELLER',
            'phone'            => '+85511000005',
            'is_active'        => false,
            'permission_group' => 'Former',
        ]);

        $this->testCategory = ProductCategory::create([
            'name' => 'Stress Test Category',
            'code' => 'STRESS-CAT',
        ]);

        $this->testProduct = Product::create([
            'category_id'           => $this->testCategory->id,
            'name'                  => 'Stress Test Product',
            'sku'                   => 'STRESS-SKU-001',
            'barcode'               => '8859999000001',
            'purchase_price'        => 10.00,
            'selling_price'         => 20.00,
            'default_reorder_level' => 5,
            'is_active'             => true,
        ]);

        $this->testVariant = ProductVariant::create([
            'product_id'       => $this->testProduct->id,
            'sku'              => 'STRESS-VAR-001',
            'barcode'          => '8859999000002',
            'cost_price'       => 10.00,
            'selling_price'    => 20.00,
            'quantity_on_hand' => 50,
            'reorder_level'    => 5,
            'is_active'        => true,
        ]);
    }

    // =========================================================================
    // SECTION 1: PRIVILEGE ESCALATION & UNPRIVILEGED ACCESS ATTEMPTS
    // =========================================================================

    public function test_admin_cannot_delete_super_admin_account(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/users/{$this->superAdmin->id}");

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Super Admin accounts cannot be deleted.',
            ]);

        $this->assertDatabaseHas('users', [
            'id'         => $this->superAdmin->id,
            'deleted_at' => null,
        ]);
    }

    public function test_admin_cannot_deactivate_super_admin_account(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/users/{$this->superAdmin->id}/status", [
                'is_active' => false,
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Super Admin accounts cannot be deactivated.',
            ]);

        $this->assertTrue($this->superAdmin->fresh()->is_active);
    }

    public function test_manager_cannot_escalate_to_admin_or_create_users(): void
    {
        $createRes = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/users', [
                'name'     => 'Escalated Admin',
                'email'    => 'escalated@pos.test',
                'password' => 'HackedPass123!',
                'role'     => 'ADMIN',
            ]);

        $createRes->assertStatus(403);
        $this->assertDatabaseMissing('users', ['email' => 'escalated@pos.test']);
    }

    public function test_cashier_cannot_escalate_privileges_via_self_update(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->patchJson("/api/v1/users/{$this->cashier->id}", [
                'role' => 'SUPER_ADMIN',
            ]);

        $response->assertStatus(403);
        $this->assertEquals('SELLER', $this->cashier->fresh()->role);
    }

    public function test_password_change_cannot_tamper_with_user_role(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'pos.cashier@pos.test',
            'password' => 'CashierSecret123!',
        ]);
        $token = $loginRes->json('data.token');

        $response = $this->withToken($token)->patchJson('/api/v1/auth/password', [
            'current_password' => 'CashierSecret123!',
            'new_password'     => 'NewSecret987!',
            'role'             => 'SUPER_ADMIN',
            'is_active'        => true,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('SELLER', $this->cashier->fresh()->role);
    }

    // =========================================================================
    // SECTION 2: ROLE CASING, SYNONYMS, NORMALIZATION & DIRECT MIDDLEWARE UNIT
    // =========================================================================

    public function test_check_role_middleware_handles_lowercase_and_casing_variations(): void
    {
        $middleware = new CheckRole();

        // 1. User with lowercase role 'seller' accessing route requiring 'SELLER'
        $user = new User(['role' => 'seller', 'is_active' => true]);
        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $passed = false;
        $response = $middleware->handle($request, function ($req) use (&$passed) {
            $passed = true;
            return response()->json(['ok' => true]);
        }, 'SELLER');

        $this->assertTrue($passed, 'CheckRole must normalize lowercase user role.');

        // 2. User with mixed case role 'AdMiN' accessing route requiring 'admin'
        $adminUser = new User(['role' => 'AdMiN', 'is_active' => true]);
        $requestAdmin = Request::create('/test', 'GET');
        $requestAdmin->setUserResolver(fn () => $adminUser);

        $passedAdmin = false;
        $middleware->handle($requestAdmin, function ($req) use (&$passedAdmin) {
            $passedAdmin = true;
            return response()->json(['ok' => true]);
        }, 'admin');

        $this->assertTrue($passedAdmin, 'CheckRole must normalize mixed-case roles.');
    }

    public function test_check_role_middleware_maps_cashier_synonym_to_seller(): void
    {
        $middleware = new CheckRole();

        // User role 'CASHIER' accessing route requiring 'SELLER'
        $user = new User(['role' => 'CASHIER', 'is_active' => true]);
        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $passed = false;
        $middleware->handle($request, function ($req) use (&$passed) {
            $passed = true;
            return response()->json(['ok' => true]);
        }, 'SELLER');

        $this->assertTrue($passed, 'CheckRole must treat CASHIER as synonym of SELLER.');

        // User role 'SELLER' accessing route configured with 'CASHIER'
        $sellerUser = new User(['role' => 'SELLER', 'is_active' => true]);
        $requestSeller = Request::create('/test', 'GET');
        $requestSeller->setUserResolver(fn () => $sellerUser);

        $passedSeller = false;
        $middleware->handle($requestSeller, function ($req) use (&$passedSeller) {
            $passedSeller = true;
            return response()->json(['ok' => true]);
        }, 'CASHIER');

        $this->assertTrue($passedSeller, 'CheckRole must accept CASHIER in middleware arguments.');
    }

    public function test_check_role_middleware_handles_whitespace_in_role_definitions(): void
    {
        $middleware = new CheckRole();

        $user = new User(['role' => ' MANAGER ', 'is_active' => true]);
        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $passed = false;
        $middleware->handle($request, function ($req) use (&$passed) {
            $passed = true;
            return response()->json(['ok' => true]);
        }, ' ADMIN , MANAGER ');

        $this->assertTrue($passed, 'CheckRole must trim whitespace in both user role and route arguments.');
    }

    public function test_check_role_middleware_rejects_unrecognized_or_forged_roles(): void
    {
        $middleware = new CheckRole();

        $forgedRoles = ['HACKER', 'ROOT', 'DEVELOPER', 'GUEST', 'NONE', ''];

        foreach ($forgedRoles as $badRole) {
            $user = new User(['role' => $badRole, 'is_active' => true]);
            $request = Request::create('/test', 'GET');
            $request->setUserResolver(fn () => $user);

            $response = $middleware->handle($request, function ($req) {
                return response()->json(['ok' => true]);
            }, 'SUPER_ADMIN', 'ADMIN');

            $this->assertEquals(403, $response->getStatusCode(), "Role '{$badRole}' must be rejected with 403.");
        }
    }

    public function test_super_admin_bypasses_all_middleware_role_restrictions(): void
    {
        $middleware = new CheckRole();

        $superUser = new User(['role' => 'SUPER_ADMIN', 'is_active' => true]);
        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $superUser);

        $passed = false;
        $middleware->handle($request, function ($req) use (&$passed) {
            $passed = true;
            return response()->json(['ok' => true]);
        }, 'RESTRICTED_CUSTOM_ROLE_XYZ');

        $this->assertTrue($passed, 'SUPER_ADMIN must bypass all role restrictions.');
    }

    // =========================================================================
    // SECTION 3: TOKEN HEADER VARIATIONS, MALFORMATIONS & TAMPERING
    // =========================================================================

    public function test_token_header_casing_variations(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'branch.admin@pos.test',
            'password' => 'AdminSecret123!',
        ]);
        $token = $loginRes->json('data.token');

        // 1. Standard "Bearer <token>"
        $res1 = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson('/api/v1/auth/me');
        $res1->assertStatus(200);

        // 2. Lowercase "bearer <token>"
        $res2 = $this->withHeaders(['Authorization' => "bearer {$token}"])
            ->getJson('/api/v1/auth/me');
        $res2->assertStatus(200);

        // 3. Uppercase "BEARER <token>"
        $res3 = $this->withHeaders(['Authorization' => "BEARER {$token}"])
            ->getJson('/api/v1/auth/me');
        $res3->assertStatus(200);
    }

    public function test_malformed_and_tampered_token_headers_rejected_with_401(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'branch.admin@pos.test',
            'password' => 'AdminSecret123!',
        ]);
        $token = $loginRes->json('data.token');

        // 1. Empty Bearer header
        $this->withHeaders(['Authorization' => 'Bearer '])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // 2. Raw token without scheme prefix
        $this->withHeaders(['Authorization' => $token])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // 3. Basic auth scheme instead of Bearer
        $this->withHeaders(['Authorization' => 'Basic dXNlcjpwYXNz'])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // 4. Unknown scheme "Token <token>"
        $this->withHeaders(['Authorization' => "Token {$token}"])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // 5. Tampered token payload (modified hash)
        $tamperedToken = substr($token, 0, -4) . 'XXXX';
        $this->withHeaders(['Authorization' => "Bearer {$tamperedToken}"])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // 6. Non-existent token ID format (e.g. 99999|hash)
        $this->withHeaders(['Authorization' => 'Bearer 99999|abcdef1234567890'])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    // =========================================================================
    // SECTION 4: TOKEN & SESSION LIFECYCLE EDGE CASES
    // =========================================================================

    public function test_user_deactivated_mid_session_is_immediately_blocked(): void
    {
        // 1. Cashier logs in and gets active token
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'pos.cashier@pos.test',
            'password' => 'CashierSecret123!',
        ]);
        $token = $loginRes->json('data.token');
        $this->assertNotEmpty($token);

        // Verify active token works on /auth/me
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 2. Admin deactivates this cashier in DB
        $this->cashier->update(['is_active' => false]);
        auth()->forgetGuards();

        // 3. Subsequent request to /auth/me should reject with 403 and clean up tokens
        $meRes = $this->withToken($token)->getJson('/api/v1/auth/me');
        $meRes->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Your account has been deactivated. Contact an administrator.',
            ]);

        // 4. Subsequent request to role-protected route should also reject with 403 or 401
        auth()->forgetGuards();
        $orderRes = $this->withToken($token)->getJson('/api/v1/orders');
        $this->assertContains($orderRes->status(), [401, 403]);
    }

    public function test_soft_deleted_user_cannot_authenticate_or_reuse_tokens(): void
    {
        // 1. Manager logs in and receives token
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'store.manager@pos.test',
            'password' => 'ManagerSecret123!',
        ]);
        $token = $loginRes->json('data.token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 2. Manager account is soft-deleted
        $this->manager->delete();
        $this->assertSoftDeleted('users', ['id' => $this->manager->id]);
        auth()->forgetGuards();

        // 3. Attempting login now returns 422 (user not found in active query)
        $loginAfterDelete = $this->postJson('/api/v1/auth/login', [
            'email'    => 'store.manager@pos.test',
            'password' => 'ManagerSecret123!',
        ]);
        $loginAfterDelete->assertStatus(422);

        // 4. Attempting to use existing token fails with 401 Unauthorized
        $tokenUseRes = $this->withToken($token)->getJson('/api/v1/auth/me');
        $tokenUseRes->assertStatus(401);
    }

    public function test_multi_device_logout_and_password_change_token_isolation(): void
    {
        // 1. Admin logs in from Device 1 and Device 2
        $dev1Res = $this->postJson('/api/v1/auth/login', [
            'email'       => 'branch.admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'device_1',
        ]);
        $token1 = $dev1Res->json('data.token');

        $dev2Res = $this->postJson('/api/v1/auth/login', [
            'email'       => 'branch.admin@pos.test',
            'password'    => 'AdminSecret123!',
            'device_name' => 'device_2',
        ]);
        $token2 = $dev2Res->json('data.token');

        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(200);
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 2. Device 1 logs out (single device)
        $this->withToken($token1)->postJson('/api/v1/auth/logout')->assertStatus(200);

        // Device 1 token is revoked -> 401
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(401);
        // Device 2 token MUST remain active -> 200
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 3. Device 2 changes password
        $pwRes = $this->withToken($token2)->patchJson('/api/v1/auth/password', [
            'current_password' => 'AdminSecret123!',
            'new_password'     => 'NewAdminSecret999!',
        ]);
        $pwRes->assertStatus(200);

        // Device 2 token is still valid
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 4. Device 2 invokes logout with all_devices=true
        $this->withToken($token2)->postJson('/api/v1/auth/logout', ['all_devices' => true])->assertStatus(200);

        // Device 2 token is now revoked
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_repeated_logout_attempts_are_handled_securely(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'pos.cashier@pos.test',
            'password' => 'CashierSecret123!',
        ]);
        $token = $loginRes->json('data.token');

        // First logout succeeds
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertStatus(200);

        // Immediate second logout with same token returns 401 Unauthorized
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertStatus(401);
    }

    // =========================================================================
    // SECTION 5: COMPREHENSIVE MATRIX TEST ACROSS ALL PROTECTED ENDPOINTS
    // =========================================================================

    public function test_comprehensive_rbac_matrix_across_all_endpoints(): void
    {
        $endpoints = [
            // Admin only routes
            ['GET', '/api/v1/users', 'ADMIN_ONLY', null],
            ['POST', '/api/v1/users', 'ADMIN_ONLY', [
                'name'     => 'Matrix Staff',
                'email'    => 'matrix.staff@pos.test',
                'password' => 'MatrixPass123!',
                'role'     => 'SELLER',
            ]],
            ['GET', '/api/v1/audit-logs', 'ADMIN_ONLY', null],

            // Operations routes (Manager & Admin)
            ['POST', '/api/v1/products', 'MANAGER_PLUS', [
                'category_id'    => $this->testCategory->id,
                'name'           => 'Matrix Product',
                'sku'            => 'MATRIX-PROD-01',
                'purchase_price' => 5.0,
                'selling_price'  => 10.0,
            ]],
            ['POST', '/api/v1/inventory/restock', 'MANAGER_PLUS', [
                'items' => [
                    [
                        'product_variant_id' => $this->testVariant->id,
                        'quantity'           => 5,
                        'cost_price'         => 10.0,
                    ],
                ],
            ]],
            ['POST', '/api/v1/inventory/adjust', 'MANAGER_PLUS', [
                'variant_id'   => $this->testVariant->id,
                'new_quantity' => 45,
                'reason'       => 'DAMAGED_GOODS_WRITE_OFF',
            ]],
            ['GET', '/api/v1/expenses', 'MANAGER_PLUS', null],
            ['GET', '/api/v1/attributes', 'MANAGER_PLUS', null],

            // POS Core routes (All roles: Cashier, Manager, Admin, SuperAdmin)
            ['GET', '/api/v1/products', 'ALL_ROLES', null],
            ['GET', '/api/v1/orders', 'ALL_ROLES', null],
            ['GET', '/api/v1/customers', 'ALL_ROLES', null],
        ];

        foreach ($endpoints as [$method, $uri, $accessLevel, $payload]) {
            // 1. Unauthenticated -> 401
            auth()->forgetGuards();
            $this->app['auth']->forgetGuards();
            $unauthRes = $this->withHeaders([])->json($method, $uri, $payload ?? []);
            $this->assertEquals(401, $unauthRes->status(), "Unauthenticated access to {$method} {$uri} must return 401");

            // 2. Cashier/Seller
            auth()->forgetGuards();
            $cashierRes = $this->actingAs($this->cashier, 'sanctum')->json($method, $uri, $payload ?? []);
            if ($accessLevel === 'ALL_ROLES') {
                $this->assertNotEquals(403, $cashierRes->status(), "Cashier should have access to {$method} {$uri}");
            } else {
                $this->assertEquals(403, $cashierRes->status(), "Cashier access to {$method} {$uri} must return 403 Forbidden");
            }

            // 3. Manager
            auth()->forgetGuards();
            $managerRes = $this->actingAs($this->manager, 'sanctum')->json($method, $uri, $payload ?? []);
            if ($accessLevel === 'ADMIN_ONLY') {
                $this->assertEquals(403, $managerRes->status(), "Manager access to Admin route {$method} {$uri} must return 403 Forbidden");
            } else {
                $this->assertNotEquals(403, $managerRes->status(), "Manager should have access to {$method} {$uri}");
            }

            // 4. Admin
            auth()->forgetGuards();
            $adminRes = $this->actingAs($this->admin, 'sanctum')->json($method, $uri, $payload ?? []);
            $this->assertNotEquals(403, $adminRes->status(), "Admin should have access to {$method} {$uri}");

            // 5. Super Admin
            auth()->forgetGuards();
            $superAdminRes = $this->actingAs($this->superAdmin, 'sanctum')->json($method, $uri, $payload ?? []);
            $this->assertNotEquals(403, $superAdminRes->status(), "Super Admin should have full access to {$method} {$uri}");
        }
    }

    // =========================================================================
    // SECTION 6: INFORMATION DISCLOSURE & ID ENUMERATION PREVENTION
    // =========================================================================

    public function test_unauthorized_roles_receive_403_before_resource_resolution(): void
    {
        $fakeUuid = '00000000-0000-0000-0000-000000000000';

        // 1. Manager probing non-existent user ID -> Must get 403 Forbidden, NOT 404
        $managerProbe = $this->actingAs($this->manager, 'sanctum')->getJson("/api/v1/users/{$fakeUuid}");
        $managerProbe->assertStatus(403);

        // 2. Cashier probing non-existent user ID -> Must get 403 Forbidden, NOT 404
        $cashierProbe = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/users/{$fakeUuid}");
        $cashierProbe->assertStatus(403);

        // 3. Admin probing non-existent user ID -> Gets 404 Resource not found
        $adminProbe = $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/users/{$fakeUuid}");
        $adminProbe->assertStatus(404);
    }

    // =========================================================================
    // SECTION 7: INJECTION & HEADER SPOOFING RESISTANCE
    // =========================================================================

    public function test_sql_injection_payloads_in_login_are_rejected(): void
    {
        $sqlPayloads = [
            "' OR '1'='1",
            "admin@pos.test'--",
            "superadmin@pos.test'; DROP TABLE users;--",
            "' UNION SELECT * FROM users --",
        ];

        foreach ($sqlPayloads as $badEmail) {
            $response = $this->postJson('/api/v1/auth/login', [
                'email'    => $badEmail,
                'password' => 'AnyPassword123!',
            ]);

            $response->assertStatus(422);
        }
    }

    public function test_custom_role_spoofing_headers_are_ignored(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'pos.cashier@pos.test',
            'password' => 'CashierSecret123!',
        ]);
        $token = $loginRes->json('data.token');

        // Cashier passes spoofed role headers
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Role'        => 'SUPER_ADMIN',
            'X-User-Role'   => 'SUPER_ADMIN',
            'X-Is-Admin'    => 'true',
        ])->getJson('/api/v1/users');

        $response->assertStatus(403);
    }

    // =========================================================================
    // SECTION 8: DEVICE TOKEN SCOPING & ROTATION
    // =========================================================================

    public function test_device_token_replacement_prunes_old_tokens_for_same_device(): void
    {
        // 1. Initial login on mobile
        $res1 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'pos.cashier@pos.test',
            'password'    => 'CashierSecret123!',
            'device_name' => 'pos_terminal_main',
        ]);
        $token1 = $res1->json('data.token');

        // Verify token1 works
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(200);

        // 2. Second login on same device name 'pos_terminal_main'
        $res2 = $this->postJson('/api/v1/auth/login', [
            'email'       => 'pos.cashier@pos.test',
            'password'    => 'CashierSecret123!',
            'device_name' => 'pos_terminal_main',
        ]);
        $token2 = $res2->json('data.token');

        // Old token1 should be deleted and return 401
        auth()->forgetGuards();
        $this->withToken($token1)->getJson('/api/v1/auth/me')->assertStatus(401);

        // New token2 should work
        auth()->forgetGuards();
        $this->withToken($token2)->getJson('/api/v1/auth/me')->assertStatus(200);
    }
}

