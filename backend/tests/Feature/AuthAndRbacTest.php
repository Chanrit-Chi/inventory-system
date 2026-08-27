<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * AuthAndRbacTest
 *
 * Dedicated feature test suite covering all M1 Authentication & RBAC acceptance criteria:
 * 1. Admin/Manager/Cashier login receiving valid Sanctum token & user profile
 * 2. Manager/Cashier access to /api/v1/users rejected with 403 Forbidden
 * 3. Post-logout requests with old Bearer token rejected with 401 Unauthorized
 * 4. Inactive/deactivated user login rejection with 403 Forbidden
 * 5. Invalid credentials rejection with 422 Unprocessable Entity
 * 6. Audit logs & Inventory operations role permission enforcement
 */
class AuthAndRbacTest extends TestCase
{
    use DatabaseMigrations;

    private User $superAdmin;
    private User $admin;
    private User $manager;
    private User $cashier;
    private User $inactiveUser;
    private ProductVariant $testVariant;
    private SalesChannel $testChannel;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        // 1. Seed Core Test Users for Each Role
        $this->superAdmin = User::create([
            'name'             => 'Super Administrator',
            'email'            => 'superadmin@pos.test',
            'password'         => Hash::make('SuperPass123!'),
            'role'             => 'SUPER_ADMIN',
            'phone'            => '+85512000001',
            'is_active'        => true,
            'permission_group' => 'Executive',
        ]);

        $this->admin = User::create([
            'name'             => 'Branch Admin',
            'email'            => 'admin@pos.test',
            'password'         => Hash::make('AdminPass123!'),
            'role'             => 'ADMIN',
            'phone'            => '+85512000002',
            'is_active'        => true,
            'permission_group' => 'BranchManagement',
        ]);

        $this->manager = User::create([
            'name'             => 'Store Manager',
            'email'            => 'manager@pos.test',
            'password'         => Hash::make('ManagerPass123!'),
            'role'             => 'MANAGER',
            'phone'            => '+85512000003',
            'is_active'        => true,
            'permission_group' => 'InventorySupervisors',
        ]);

        $this->cashier = User::create([
            'name'             => 'POS Cashier',
            'email'            => 'cashier@pos.test',
            'password'         => Hash::make('CashierPass123!'),
            'role'             => 'SELLER',
            'phone'            => '+85512000004',
            'is_active'        => true,
            'permission_group' => 'Cashiers',
        ]);

        $this->inactiveUser = User::create([
            'name'             => 'Deactivated Staff',
            'email'            => 'inactive@pos.test',
            'password'         => Hash::make('InactivePass123!'),
            'role'             => 'SELLER',
            'phone'            => '+85512000005',
            'is_active'        => false,
            'permission_group' => 'FormerStaff',
        ]);

        // 2. Seed Baseline Catalog Data for Inventory RBAC Testing
        $category = ProductCategory::create([
            'name' => 'General Goods',
            'code' => 'GEN',
        ]);

        $product = Product::create([
            'category_id'           => $category->id,
            'name'                  => 'Test RBAC Product',
            'sku'                   => 'RBAC-PROD-01',
            'barcode'               => '8850000000001',
            'purchase_price'        => 5.00,
            'selling_price'         => 10.00,
            'default_reorder_level' => 5,
            'is_active'             => true,
        ]);

        $this->testVariant = ProductVariant::create([
            'product_id'       => $product->id,
            'sku'              => 'RBAC-VAR-01',
            'barcode'          => '8850000000002',
            'cost_price'       => 5.00,
            'selling_price'    => 10.00,
            'quantity_on_hand' => 100,
            'reorder_level'    => 5,
            'is_active'        => true,
        ]);

        $this->testChannel = SalesChannel::create([
            'name'      => 'POS Terminal A',
            'code'      => 'POS-A',
            'type'      => 'POS',
            'is_active' => true,
        ]);
    }

    // =========================================================================
    // 1. ROLE LOGIN & TOKEN ISSUANCE TESTS
    // =========================================================================

    public function test_super_admin_login_returns_token_and_user_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'superadmin@pos.test',
            'password' => 'SuperPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login successful.',
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'token',
                    'user' => [
                        'id', 'name', 'email', 'phone', 'role', 'isActive', 'permissionGroup', 'lastActive'
                    ],
                ],
                'message',
            ]);

        $this->assertNotEmpty($response->json('data.token'));
        $this->assertEquals('SUPER_ADMIN', $response->json('data.user.role'));
        $this->assertTrue($response->json('data.user.isActive'));
    }

    public function test_admin_login_returns_token_and_user_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'AdminPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login successful.',
            ]);

        $this->assertNotEmpty($response->json('data.token'));
        $this->assertEquals('ADMIN', $response->json('data.user.role'));
        $this->assertTrue($response->json('data.user.isActive'));
    }

    public function test_manager_login_returns_token_and_user_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'manager@pos.test',
            'password' => 'ManagerPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login successful.',
            ]);

        $this->assertNotEmpty($response->json('data.token'));
        $this->assertEquals('MANAGER', $response->json('data.user.role'));
        $this->assertTrue($response->json('data.user.isActive'));
    }

    public function test_cashier_seller_login_returns_token_and_user_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login successful.',
            ]);

        $this->assertNotEmpty($response->json('data.token'));
        $this->assertEquals('SELLER', $response->json('data.user.role'));
        $this->assertTrue($response->json('data.user.isActive'));
    }

    public function test_login_response_envelope_structure(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'token',
                    'user' => [
                        'id', 'name', 'email', 'phone', 'role', 'isActive', 'permissionGroup', 'lastActive'
                    ],
                ],
                'message',
            ]);
    }

    // =========================================================================
    // 2. LOGIN FAILURE & VALIDATION REJECTION TESTS
    // =========================================================================

    public function test_login_with_invalid_password_returns_422(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'WrongPassword999!',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ])
            ->assertJsonStructure([
                'message',
                'errors' => ['email'],
            ]);
    }

    public function test_login_with_nonexistent_email_returns_422(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'ghost.user@pos.test',
            'password' => 'AnyPassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ])
            ->assertJsonStructure([
                'message',
                'errors' => ['email'],
            ]);
    }

    public function test_login_with_missing_credentials_returns_422(): void
    {
        $response = $this->postJson('/api/v1/auth/login', []);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['email', 'password'],
            ]);
    }

    public function test_login_with_deactivated_inactive_user_returns_403(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'inactive@pos.test',
            'password' => 'InactivePass123!',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Your account has been deactivated. Contact an administrator.',
            ]);
    }

    // =========================================================================
    // 3. PROFILE & BEARER TOKEN VERIFICATION TESTS
    // =========================================================================

    public function test_auth_me_returns_profile_for_valid_bearer_token(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'manager@pos.test',
            'password' => 'ManagerPass123!',
        ]);
        $token = $loginRes->json('data.token');

        $response = $this->withToken($token)->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'id'              => $this->manager->id,
                    'name'            => 'Store Manager',
                    'email'           => 'manager@pos.test',
                    'role'            => 'MANAGER',
                    'isActive'        => true,
                    'permissionGroup' => 'InventorySupervisors',
                ],
            ]);
    }

    public function test_unauthenticated_request_to_auth_me_returns_401(): void
    {
        $response = $this->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Unauthenticated.',
            ]);
    }

    public function test_invalid_or_corrupted_bearer_token_returns_401(): void
    {
        $response = $this->withToken('invalid-sanctum-token-random-gibberish')
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Unauthenticated.',
            ]);
    }

    // =========================================================================
    // 4. LOGOUT & POST-LOGOUT TOKEN INVALIDATION TESTS
    // =========================================================================

    public function test_auth_logout_successfully_revokes_token(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'AdminPass123!',
        ]);
        $token = $loginRes->json('data.token');

        $response = $this->withToken($token)->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logged out successfully.',
            ]);
    }

    public function test_post_logout_request_with_revoked_bearer_token_returns_401(): void
    {
        // 1. Authenticate and obtain real Sanctum plainTextToken
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier@pos.test',
            'password' => 'CashierPass123!',
        ]);
        $loginRes->assertStatus(200);
        $token = $loginRes->json('data.token');
        $this->assertNotEmpty($token);

        // 2. Verify token is active and functional
        $activeCheck = $this->withToken($token)->getJson('/api/v1/auth/me');
        $activeCheck->assertStatus(200);

        // 3. Perform logout
        $logoutRes = $this->withToken($token)->postJson('/api/v1/auth/logout');
        $logoutRes->assertStatus(200);

        // 4. Subsequent request with the same revoked token must return 401 Unauthorized
        $subsequentRes = $this->withToken($token)->getJson('/api/v1/auth/me');
        $subsequentRes->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Unauthenticated.',
            ]);
    }

    public function test_post_logout_request_to_users_endpoint_with_revoked_token_returns_401(): void
    {
        // 1. Admin login
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@pos.test',
            'password' => 'AdminPass123!',
        ]);
        $token = $loginRes->json('data.token');

        // 2. Verify admin can list users before logout
        $beforeLogout = $this->withToken($token)->getJson('/api/v1/users');
        $beforeLogout->assertStatus(200);

        // 3. Logout
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertStatus(200);

        // 4. Attempt to list users with the revoked token -> 401 Unauthorized
        $afterLogout = $this->withToken($token)->getJson('/api/v1/users');
        $afterLogout->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Unauthenticated.',
            ]);
    }

    // =========================================================================
    // 5. STRICT RBAC ON USER MANAGEMENT (/api/v1/users*) TESTS
    // =========================================================================

    public function test_super_admin_can_access_users_index(): void
    {
        $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/users');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertIsArray($response->json('data'));
    }

    public function test_admin_can_access_users_index(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/users');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertIsArray($response->json('data'));
    }

    public function test_manager_access_to_users_index_is_forbidden_403(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/users');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_cashier_access_to_users_index_is_forbidden_403(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/users');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_admin_can_create_new_staff_user(): void
    {
        $payload = [
            'name'             => 'New Store Staff',
            'email'            => 'newstaff@pos.test',
            'password'         => 'NewStaffPass123!',
            'role'             => 'SELLER',
            'phone'            => '+85512999888',
            'permission_group' => 'Cashiers',
        ];

        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/users', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'User created successfully.',
                'data'    => [
                    'name'     => 'New Store Staff',
                    'email'    => 'newstaff@pos.test',
                    'role'     => 'SELLER',
                    'isActive' => true,
                ],
            ]);

        $this->assertDatabaseHas('users', ['email' => 'newstaff@pos.test']);
    }

    public function test_manager_cannot_create_update_or_delete_users_and_receives_403(): void
    {
        // 1. Create attempt -> 403
        $createRes = $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/users', [
            'name'     => 'Forbidden Staff',
            'email'    => 'forbidden@pos.test',
            'password' => 'Pass123456!',
            'role'     => 'SELLER',
        ]);
        $createRes->assertStatus(403);

        // 2. Update attempt -> 403
        $updateRes = $this->actingAs($this->manager, 'sanctum')->patchJson("/api/v1/users/{$this->cashier->id}", [
            'name' => 'Renamed Cashier',
        ]);
        $updateRes->assertStatus(403);

        // 3. Status toggle attempt -> 403
        $statusRes = $this->actingAs($this->manager, 'sanctum')->patchJson("/api/v1/users/{$this->cashier->id}/status", [
            'is_active' => false,
        ]);
        $statusRes->assertStatus(403);

        // 4. Delete attempt -> 403
        $deleteRes = $this->actingAs($this->manager, 'sanctum')->deleteJson("/api/v1/users/{$this->cashier->id}");
        $deleteRes->assertStatus(403);
    }

    public function test_cashier_cannot_create_update_or_delete_users_and_receives_403(): void
    {
        // 1. Create attempt -> 403
        $createRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/users', [
            'name'     => 'Forbidden Staff 2',
            'email'    => 'forbidden2@pos.test',
            'password' => 'Pass123456!',
            'role'     => 'SELLER',
        ]);
        $createRes->assertStatus(403);

        // 2. Update attempt -> 403
        $updateRes = $this->actingAs($this->cashier, 'sanctum')->patchJson("/api/v1/users/{$this->admin->id}", [
            'name' => 'Hacked Admin',
        ]);
        $updateRes->assertStatus(403);

        // 3. Delete attempt -> 403
        $deleteRes = $this->actingAs($this->cashier, 'sanctum')->deleteJson("/api/v1/users/{$this->admin->id}");
        $deleteRes->assertStatus(403);
    }

    // =========================================================================
    // 6. STRICT RBAC ON AUDIT LOGS & INVENTORY OPERATIONS TESTS
    // =========================================================================

    public function test_admin_and_super_admin_can_access_audit_logs(): void
    {
        $superAdminRes = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/audit-logs');
        $superAdminRes->assertStatus(200)
            ->assertJson(['success' => true]);

        $adminRes = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/audit-logs');
        $adminRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_manager_and_cashier_access_to_audit_logs_is_forbidden_403(): void
    {
        $managerRes = $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/audit-logs');
        $managerRes->assertStatus(403)
            ->assertJson(['success' => false]);

        $cashierRes = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/audit-logs');
        $cashierRes->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    public function test_manager_can_access_inventory_restock_and_adjust(): void
    {
        // Restock attempt as Manager -> Allowed (not 403)
        $restockRes = $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/inventory/restock', [
            'notes' => 'Manager restock intake',
            'items' => [
                [
                    'product_variant_id' => $this->testVariant->id,
                    'quantity'           => 10,
                    'cost_price'         => 5.00,
                ],
            ],
        ]);
        $this->assertNotEquals(403, $restockRes->status(), 'Manager should have restock access');

        // Adjust attempt as Manager -> Allowed (not 403)
        $adjustRes = $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/inventory/adjust', [
            'variant_id'   => $this->testVariant->id,
            'new_quantity' => 120,
            'reason'       => 'INVENTORY_COUNT_RECONCILIATION',
        ]);
        $this->assertNotEquals(403, $adjustRes->status(), 'Manager should have stock adjustment access');
    }

    public function test_cashier_cannot_access_inventory_restock_and_adjust_and_receives_403(): void
    {
        // Restock attempt as Cashier -> 403 Forbidden
        $restockRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/inventory/restock', [
            'notes' => 'Unauthorized cashier restock attempt',
            'items' => [
                [
                    'product_variant_id' => $this->testVariant->id,
                    'quantity'           => 10,
                    'cost_price'         => 5.00,
                ],
            ],
        ]);
        $restockRes->assertStatus(403)
            ->assertJson(['success' => false]);

        // Adjust attempt as Cashier -> 403 Forbidden
        $adjustRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/inventory/adjust', [
            'variant_id'   => $this->testVariant->id,
            'new_quantity' => 50,
            'reason'       => 'DAMAGED_GOODS_WRITE_OFF',
        ]);
        $adjustRes->assertStatus(403)
            ->assertJson(['success' => false]);
    }
}
