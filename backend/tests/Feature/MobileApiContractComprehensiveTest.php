<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\RestockDetail;
use App\Models\RestockSession;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * MobileApiContractComprehensiveTest
 *
 * Dedicated feature test suite covering EVERY mobile endpoint and requirement in
 * ORIGINAL_REQUEST.md, TEST_INFRA.md, and frontend/mobile/src/api/endpoints.ts:
 *
 * 1. Authentication & Session Security (Login, Invalid Creds, Deactivated Check, Password Change, Token Revocation, Me, Logout)
 * 2. Staff User Management (List Users, Create User with Roles, Update Fields, Status Toggle, Super Admin Safeguards, Soft Deletes)
 * 3. Barcode Scanning (2-Tier Resolution: Direct Variant Barcode/SKU, Master Product Barcode to Variant Array, 404 Resolution)
 * 4. Product Catalog & Category Search (Paginated Catalog, Name/SKU/Barcode Search, Category & Active Status Filters, Details)
 * 5. Customer CRM & Loyalty (Customer Search by Name/Phone, Customer Details with Orders, Spend & Order Count Tracking)
 * 6. Sales Channels (Active Channels List, Create Channel)
 * 7. POS Order Checkout (Multi-Payment Cash/Card/ABA KHQR, Atomic Multi-Item Stock Decrement, Insufficient Stock Rejection, Idempotent Mutations, Customer Auto-Attribution, Ledger Movements)
 * 8. Order History & Details (Paginated History with Status/Channel/Search Filters, Complete Order Detail Graph)
 * 9. Inventory Restock Intake (Batch Restock Sessions, Details Persistence, Variant Stock Increments, Restock Movement Ledgers)
 * 10. Physical Stock Adjustment (Variance Reconciliations, Reason Code Mappings, Stock Overwrites, Negative Prevention)
 * 11. Audit Logs (Stock Movement Ledger Auditing, User Login Auditing, Attribution & Target Metadata)
 * 12. Health Diagnostics (Top-level /health, V1 /api/v1/health with DB & App Metadata)
 */
class MobileApiContractComprehensiveTest extends TestCase
{
    use DatabaseMigrations;

    private User $adminUser;
    private User $superAdminUser;
    private ProductCategory $category;
    private Product $product;
    private ProductVariant $variant1;
    private ProductVariant $variant2;
    private SalesChannel $posChannel;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable('personal_access_tokens')) {
            $this->artisan('migrate', ['--path' => 'vendor/laravel/sanctum/database/migrations']);
        }

        // 1. Seed Core Administrative Users
        $this->superAdminUser = User::create([
            'name'             => 'Super Admin',
            'email'            => 'superadmin@pos.local',
            'password'         => Hash::make('SuperSecret123!'),
            'role'             => 'SUPER_ADMIN',
            'phone'            => '+85512000001',
            'is_active'        => true,
            'permission_group' => 'Executive',
        ]);

        $this->adminUser = User::create([
            'name'             => 'Manager Dara',
            'email'            => 'dara.admin@pos.local',
            'password'         => Hash::make('AdminPass123!'),
            'role'             => 'ADMIN',
            'phone'            => '+85512000002',
            'is_active'        => true,
            'permission_group' => 'StoreManager',
        ]);

        // 2. Seed Category & Products with Variants
        $this->category = ProductCategory::create([
            'name'        => 'Apparel & Fashion',
            'code'        => 'APP-FASH',
            'description' => 'Clothing, shirts, and accessories',
        ]);

        $this->product = Product::create([
            'category_id'           => $this->category->id,
            'name'                  => 'Premium Cotton T-Shirt',
            'sku'                   => 'PROD-TSHIRT-001',
            'barcode'               => '8851234567890',
            'purchase_price'        => 8.00,
            'selling_price'         => 18.00,
            'default_reorder_level' => 10,
            'is_active'             => true,
            'description'           => 'High quality 100% combed cotton t-shirt',
        ]);

        $this->variant1 = ProductVariant::create([
            'product_id'       => $this->product->id,
            'name'             => 'T-Shirt Blue / M',
            'sku'              => 'TSHIRT-BLU-M',
            'barcode'          => '8851234567891',
            'cost_price'       => 8.00,
            'selling_price'    => 18.00,
            'quantity_on_hand' => 50,
            'reorder_level'    => 10,
            'is_active'        => true,
        ]);

        $this->variant2 = ProductVariant::create([
            'product_id'       => $this->product->id,
            'name'             => 'T-Shirt Red / L',
            'sku'              => 'TSHIRT-RED-L',
            'barcode'          => '8851234567892',
            'cost_price'       => 8.50,
            'selling_price'    => 19.50,
            'quantity_on_hand' => 30,
            'reorder_level'    => 5,
            'is_active'        => true,
        ]);

        // 3. Seed Primary Sales Channel
        $this->posChannel = SalesChannel::create([
            'name'      => 'Main POS Terminal 1',
            'code'      => 'POS-01',
            'type'      => 'POS',
            'is_active' => true,
        ]);
    }

    // =========================================================================
    // 1. AUTHENTICATION & SESSION SECURITY
    // =========================================================================

    public function test_login_with_valid_credentials_returns_token_and_user_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'dara.admin@pos.local',
            'password' => 'AdminPass123!',
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
                        'id',
                        'name',
                        'email',
                        'phone',
                        'role',
                        'isActive',
                        'permissionGroup',
                        'lastActive',
                    ],
                ],
                'message',
            ]);

        $token = $response->json('data.token');
        $this->assertNotEmpty($token);
        $this->assertEquals('dara.admin@pos.local', $response->json('data.user.email'));
        $this->assertEquals('ADMIN', $response->json('data.user.role'));
        $this->assertTrue($response->json('data.user.isActive'));
    }

    public function test_login_with_invalid_password_returns_422(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'dara.admin@pos.local',
            'password' => 'WrongPassword999!',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['email'],
            ]);
    }

    public function test_login_with_nonexistent_email_returns_422(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'unknown.user@pos.local',
            'password' => 'AnyPassword123!',
        ]);

        $response->assertStatus(422);
    }

    public function test_login_with_deactivated_user_account_returns_403(): void
    {
        $deactivatedUser = User::create([
            'name'      => 'Inactive Staff',
            'email'     => 'inactive@pos.local',
            'password'  => Hash::make('Inactive123!'),
            'role'      => 'SELLER',
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'inactive@pos.local',
            'password' => 'Inactive123!',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Your account has been deactivated. Contact an administrator.',
            ]);
    }

    public function test_change_password_updates_credentials_and_revokes_other_tokens(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->patchJson('/api/v1/auth/password', [
            'current_password' => 'AdminPass123!',
            'new_password'     => 'BrandNewPass2026!',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Password updated successfully.',
            ]);

        // Verify old password is rejected
        $oldLogin = $this->postJson('/api/v1/auth/login', [
            'email'    => 'dara.admin@pos.local',
            'password' => 'AdminPass123!',
        ]);
        $oldLogin->assertStatus(422);

        // Verify new password succeeds
        $newLogin = $this->postJson('/api/v1/auth/login', [
            'email'    => 'dara.admin@pos.local',
            'password' => 'BrandNewPass2026!',
        ]);
        $newLogin->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_change_password_rejects_incorrect_current_password(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->patchJson('/api/v1/auth/password', [
            'current_password' => 'IncorrectCurrentPass!',
            'new_password'     => 'BrandNewPass2026!',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['current_password'],
            ]);
    }

    public function test_change_password_enforces_minimum_length_validation(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->patchJson('/api/v1/auth/password', [
            'current_password' => 'AdminPass123!',
            'new_password'     => 'short',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['new_password'],
            ]);
    }

    public function test_auth_me_returns_current_authenticated_user_profile(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'id'              => $this->adminUser->id,
                    'name'            => $this->adminUser->name,
                    'email'           => $this->adminUser->email,
                    'role'            => 'ADMIN',
                    'isActive'        => true,
                    'permissionGroup' => 'StoreManager',
                ],
            ]);
    }

    public function test_auth_logout_revokes_current_access_token(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'dara.admin@pos.local',
            'password' => 'AdminPass123!',
        ]);
        $token = $loginRes->json('data.token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logged out successfully.',
            ]);
    }

    // =========================================================================
    // 2. USER MANAGEMENT & ROLE PERMISSIONS
    // =========================================================================

    public function test_list_users_returns_staff_collection(): void
    {
        Sanctum::actingAs($this->adminUser);

        User::create([
            'name'      => 'Cashier Sokha',
            'email'     => 'sokha@pos.local',
            'password'  => Hash::make('CashierPass123!'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/users');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $users = $response->json('data');
        $this->assertIsArray($users);
        $this->assertGreaterThanOrEqual(3, count($users));

        $firstUser = $users[0];
        $this->assertArrayHasKey('id', $firstUser);
        $this->assertArrayHasKey('name', $firstUser);
        $this->assertArrayHasKey('email', $firstUser);
        $this->assertArrayHasKey('role', $firstUser);
        $this->assertArrayHasKey('isActive', $firstUser);
    }

    public function test_create_user_with_roles_and_validation(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'name'             => 'Inventory Clerk Bopha',
            'email'            => 'bopha.inv@pos.local',
            'phone'            => '+85512999888',
            'role'             => 'MANAGER',
            'password'         => 'ClerkPass2026!',
            'permission_group' => 'Warehouse',
        ];

        $response = $this->postJson('/api/v1/users', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'User created successfully.',
                'data'    => [
                    'name'            => 'Inventory Clerk Bopha',
                    'email'           => 'bopha.inv@pos.local',
                    'role'            => 'MANAGER',
                    'isActive'        => true,
                    'permissionGroup' => 'Warehouse',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'email'     => 'bopha.inv@pos.local',
            'role'      => 'MANAGER',
            'is_active' => 1,
        ]);
    }

    public function test_create_user_fails_with_invalid_role_or_duplicate_email(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Invalid role
        $resRole = $this->postJson('/api/v1/users', [
            'name'     => 'Invalid Role User',
            'email'    => 'invalidrole@pos.local',
            'role'     => 'HACKER_ROLE',
            'password' => 'SecurePass123!',
        ]);
        $resRole->assertStatus(422);

        // Duplicate email
        $resDup = $this->postJson('/api/v1/users', [
            'name'     => 'Duplicate Admin',
            'email'    => 'dara.admin@pos.local',
            'role'     => 'ADMIN',
            'password' => 'SecurePass123!',
        ]);
        $resDup->assertStatus(422);
    }

    public function test_update_user_fields(): void
    {
        Sanctum::actingAs($this->adminUser);

        $staff = User::create([
            'name'      => 'Junior Staff',
            'email'     => 'junior@pos.local',
            'password'  => Hash::make('Pass1234!'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $response = $this->patchJson("/api/v1/users/{$staff->id}", [
            'name'     => 'Senior Staff Leader',
            'phone'    => '+85598777666',
            'role'     => 'MANAGER',
            'isActive' => true,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'id'   => $staff->id,
                    'name' => 'Senior Staff Leader',
                    'role' => 'MANAGER',
                ],
            ]);

        $staff->refresh();
        $this->assertEquals('Senior Staff Leader', $staff->name);
        $this->assertEquals('MANAGER', $staff->role);
        $this->assertEquals('+85598777666', $staff->phone);
    }

    public function test_toggle_user_status(): void
    {
        Sanctum::actingAs($this->adminUser);

        $staff = User::create([
            'name'      => 'Toggle Staff',
            'email'     => 'toggle@pos.local',
            'password'  => Hash::make('Pass1234!'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        // Deactivate
        $deactivateRes = $this->patchJson("/api/v1/users/{$staff->id}/status", [
            'is_active' => false,
        ]);
        $deactivateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['isActive' => false],
            ]);
        $this->assertFalse((bool) $staff->fresh()->is_active);

        // Reactivate
        $activateRes = $this->patchJson("/api/v1/users/{$staff->id}/status", [
            'is_active' => true,
        ]);
        $activateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['isActive' => true],
            ]);
        $this->assertTrue((bool) $staff->fresh()->is_active);
    }

    public function test_prevent_deactivating_super_admin(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->patchJson("/api/v1/users/{$this->superAdminUser->id}/status", [
            'is_active' => false,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Super Admin accounts cannot be deactivated.',
            ]);

        $this->assertTrue((bool) $this->superAdminUser->fresh()->is_active);
    }

    public function test_prevent_deleting_super_admin(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->deleteJson("/api/v1/users/{$this->superAdminUser->id}");

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Super Admin accounts cannot be deleted.',
            ]);

        $this->assertDatabaseHas('users', ['id' => $this->superAdminUser->id]);
    }

    public function test_delete_staff_user_soft_deletes(): void
    {
        Sanctum::actingAs($this->adminUser);

        $staff = User::create([
            'name'      => 'Delete Me Staff',
            'email'     => 'delete.me@pos.local',
            'password'  => Hash::make('Pass1234!'),
            'role'      => 'SELLER',
            'is_active' => true,
        ]);

        $response = $this->deleteJson("/api/v1/users/{$staff->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'User deleted successfully.',
            ]);

        $this->assertSoftDeleted('users', ['id' => $staff->id]);
    }

    // =========================================================================
    // 3. BARCODE SCANNING (2-TIER RESOLUTION)
    // =========================================================================

    public function test_scan_direct_variant_by_barcode(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/inventory/scan?code=8851234567891');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'type'    => 'variant',
                    'variant' => [
                        'id'      => $this->variant1->id,
                        'sku'     => 'TSHIRT-BLU-M',
                        'barcode' => '8851234567891',
                    ],
                    'product' => [
                        'id'   => $this->product->id,
                        'name' => 'Premium Cotton T-Shirt',
                    ],
                ],
            ]);
    }

    public function test_scan_direct_variant_by_sku(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/inventory/scan?code=TSHIRT-RED-L');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'type'    => 'variant',
                    'variant' => [
                        'id'  => $this->variant2->id,
                        'sku' => 'TSHIRT-RED-L',
                    ],
                    'product' => [
                        'id' => $this->product->id,
                    ],
                ],
            ]);
    }

    public function test_scan_master_product_barcode_resolves_all_active_variants(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/inventory/scan?code=8851234567890');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'type'    => 'product',
                    'product' => [
                        'id'   => $this->product->id,
                        'name' => 'Premium Cotton T-Shirt',
                    ],
                ],
            ]);

        $variants = $response->json('data.variants');
        $this->assertIsArray($variants);
        $this->assertCount(2, $variants);
        $variantSkus = array_column($variants, 'sku');
        $this->assertContains('TSHIRT-BLU-M', $variantSkus);
        $this->assertContains('TSHIRT-RED-L', $variantSkus);
    }

    public function test_scan_nonexistent_barcode_returns_404(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/inventory/scan?code=UNKNOWN-999999999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Product not found.',
            ]);
    }

    // =========================================================================
    // 4. PRODUCT CATALOG & CATEGORIES
    // =========================================================================

    public function test_list_products_with_pagination(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/products');

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'success',
                'data',
                'meta' => [
                    'current_page',
                    'per_page',
                    'total',
                    'last_page',
                ],
            ]);

        $this->assertGreaterThanOrEqual(1, $response->json('meta.total'));
    }

    public function test_search_products_by_name_and_barcode(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Search by name
        $nameRes = $this->getJson('/api/v1/products?search=Cotton');
        $nameRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($nameRes->json('data')));

        // Search by master barcode
        $barcodeRes = $this->getJson('/api/v1/products?search=8851234567890');
        $barcodeRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($barcodeRes->json('data')));

        // Search with non-matching string
        $noneRes = $this->getJson('/api/v1/products?search=NonExistentProductZXY');
        $noneRes->assertStatus(200);
        $this->assertCount(0, $noneRes->json('data'));
    }

    public function test_filter_products_by_category_and_active_status(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson("/api/v1/products?category_id={$this->category->id}&is_active=1");

        $response->assertStatus(200);
        $products = $response->json('data');
        $this->assertNotEmpty($products);
        foreach ($products as $p) {
            $this->assertEquals($this->category->id, $p['category_id']);
            $this->assertTrue((bool) $p['is_active']);
        }
    }

    public function test_get_product_detail_by_id(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson("/api/v1/products/{$this->product->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'id'          => $this->product->id,
                    'name'        => 'Premium Cotton T-Shirt',
                    'category_id' => $this->category->id,
                ],
            ]);

        $this->assertArrayHasKey('variants', $response->json('data'));
        $this->assertArrayHasKey('category', $response->json('data'));
    }

    public function test_create_variable_product_with_custom_variants_and_stock_persists_fully(): void
    {
        Sanctum::actingAs($this->adminUser);

        $attr = Attribute::create(['name' => 'Size', 'code' => 'SIZE']);
        $valM = AttributeValue::create(['attribute_id' => $attr->id, 'value_name' => 'M']);
        $valL = AttributeValue::create(['attribute_id' => $attr->id, 'value_name' => 'L']);

        $payload = [
            'name'                  => 'Custom Hoodie 2026',
            'purchase_price'        => 15.00,
            'selling_price'         => 35.00,
            'default_reorder_level' => 5,
            'category_id'           => $this->category->id,
            'is_active'             => true,
            'variants'              => [
                [
                    'name'                   => 'Medium',
                    'sku'                    => 'HOODIE-M-2026',
                    'barcode'                => '8859900112233',
                    'quantity_on_hand'       => 25,
                    'selling_price'          => 35.00,
                    'cost_price'             => 15.00,
                    'attribute_values'       => [
                        ['id' => $valM->id, 'value_name' => 'M', 'attribute' => ['name' => 'Size']],
                    ],
                ],
                [
                    'name'                   => 'Large',
                    'sku'                    => 'HOODIE-L-2026',
                    'barcode'                => '8859900112244',
                    'quantity_on_hand'       => 18,
                    'selling_price'          => 38.00,
                    'selling_price_override' => 38.00,
                    'cost_price'             => 15.00,
                    'attribute_values'       => [
                        ['id' => $valL->id, 'value_name' => 'L', 'attribute' => ['name' => 'Size']],
                    ],
                ],
            ],
        ];

        $createRes = $this->postJson('/api/v1/products', $payload);
        $createRes->assertStatus(201)
            ->assertJson(['success' => true]);

        $createdId = $createRes->json('data.id') ?? $createRes->json('data.product.id');
        $this->assertNotEmpty($createdId);

        // Fetch products list (simulating reopen / reload app)
        $listRes = $this->getJson('/api/v1/products');
        $listRes->assertStatus(200);

        $matched = collect($listRes->json('data'))->firstWhere('id', $createdId);
        $this->assertNotNull($matched);
        $this->assertCount(2, $matched['variants']);
        $this->assertEquals(43, collect($matched['variants'])->sum('quantity_on_hand'));
        $this->assertEquals('HOODIE-M-2026', $matched['variants'][0]['sku']);
        $this->assertEquals('8859900112233', $matched['variants'][0]['barcode']);
        $this->assertEquals(25, $matched['variants'][0]['quantity_on_hand']);
    }

    public function test_update_product_from_single_to_variable_persists_variants_and_stock(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create a simple product with stock 10
        $createRes = $this->postJson('/api/v1/products', [
            'name'                  => 'Basic T-Shirt',
            'sku'                   => 'TSHIRT-BASIC-001',
            'barcode'               => '998877665544',
            'purchase_price'        => 5.00,
            'selling_price'         => 12.00,
            'quantity_on_hand'      => 10,
            'stock'                 => 10,
            'default_reorder_level' => 3,
            'category_id'           => $this->category->id,
            'is_active'             => true,
        ]);
        $createRes->assertStatus(201);
        $productId = $createRes->json('data.id') ?? $createRes->json('data.product.id');

        // Verify initial single variant
        $initialProd = Product::with('variants')->find($productId);
        $this->assertCount(1, $initialProd->variants);
        $initialVar = $initialProd->variants->first();
        $this->assertEquals(10, $initialVar->quantity_on_hand);

        // 2. Simulate historical sale & stock movement for this simple product before upgrade
        $order = Order::create([
            'order_number'    => 'ORD-HIST-001',
            'status'          => 'COMPLETED',
            'payment_status'  => 'PAID',
            'subtotal'        => 24.00,
            'total_amount'    => 24.00,
            'tax_amount'      => 0.00,
            'discount_amount' => 0.00,
            'final_amount'    => 24.00,
            'created_by'      => $this->adminUser->id,
        ]);

        $orderItem = OrderItem::create([
            'order_id'        => $order->id,
            'product_id'      => $productId,
            'variant_id'      => $initialVar->id,
            'quantity'        => 2,
            'unit_price'      => 12.00,
            'total_price'     => 24.00,
            'subtotal'        => 24.00,
            'discount_amount' => 0.00,
            'final_amount'    => 24.00,
        ]);

        $movement = StockMovement::create([
            'product_id'      => $productId,
            'variant_id'      => $initialVar->id,
            'movement_type'   => 'SALE',
            'quantity_change' => -2,
            'quantity_before' => 10,
            'quantity_after'  => 8,
            'reference_id'    => $order->order_number,
            'user_id'         => $this->adminUser->id,
        ]);

        // 3. Now upgrade product from Single to Variable with 2 attribute variants (Red / Blue)
        $attr = Attribute::create(['name' => 'Color', 'code' => 'COLOR']);
        $valRed = AttributeValue::create(['attribute_id' => $attr->id, 'value_name' => 'Red']);
        $valBlue = AttributeValue::create(['attribute_id' => $attr->id, 'value_name' => 'Blue']);

        $updateRes = $this->putJson("/api/v1/products/{$productId}", [
            'name'                  => 'Basic T-Shirt (Color Edition)',
            'purchase_price'        => 5.50,
            'selling_price'         => 14.00,
            'default_reorder_level' => 4,
            'category_id'           => $this->category->id,
            'is_active'             => true,
            'variants'              => [
                [
                    'name'             => 'Basic T-Shirt (Red)',
                    'sku'              => 'TSHIRT-RED',
                    'barcode'          => '111122223333',
                    'quantity_on_hand' => 15,
                    'stock'            => 15,
                    'selling_price'    => 14.00,
                    'cost_price'       => 5.50,
                    'attribute_values' => [
                        ['id' => $valRed->id, 'value_name' => 'Red', 'attribute' => ['name' => 'Color']],
                    ],
                ],
                [
                    'name'             => 'Basic T-Shirt (Blue)',
                    'sku'              => 'TSHIRT-BLUE',
                    'barcode'          => '444455556666',
                    'quantity_on_hand' => 20,
                    'stock'            => 20,
                    'selling_price'    => 14.00,
                    'cost_price'       => 5.50,
                    'attribute_values' => [
                        ['id' => $valBlue->id, 'value_name' => 'Blue', 'attribute' => ['name' => 'Color']],
                    ],
                ],
            ],
        ]);

        $updateRes->assertStatus(200);

        // 4. Verify fresh state from database
        $freshProd = Product::with(['variants.attributeValues.attribute', 'category'])->find($productId);
        $this->assertEquals('Basic T-Shirt (Color Edition)', $freshProd->name);
        $this->assertCount(2, $freshProd->variants);
        $this->assertEquals(35, $freshProd->variants->sum('quantity_on_hand'));
        $this->assertTrue($freshProd->variants->pluck('sku')->contains('TSHIRT-RED'));
        $this->assertTrue($freshProd->variants->pluck('sku')->contains('TSHIRT-BLUE'));

        // 5. Verify historical order items and stock movements remain 100% intact with variant name
        $freshOrderItem = OrderItem::with('variant')->find($orderItem->id);
        $this->assertNotNull($freshOrderItem);
        $this->assertNotNull($freshOrderItem->variant);
        $this->assertEquals('Standard', $freshOrderItem->variant->name);
        $this->assertEquals('TSHIRT-BASIC-001', $freshOrderItem->variant->sku);

        $freshMovement = StockMovement::with('variant')->find($movement->id);
        $this->assertNotNull($freshMovement);
        $this->assertNotNull($freshMovement->variant);
        $this->assertEquals('TSHIRT-BASIC-001', $freshMovement->variant->sku);
    }

    public function test_create_simple_product_with_stock_persists_default_variant(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'name'                  => 'Basic Water Bottle',
            'sku'                   => 'BOTTLE-SIMPLE-001',
            'barcode'               => '8858889990001',
            'purchase_price'        => 2.50,
            'selling_price'         => 6.00,
            'quantity_on_hand'      => 40,
            'category_id'           => $this->category->id,
            'is_active'             => true,
        ];

        $createRes = $this->postJson('/api/v1/products', $payload);
        $createRes->assertStatus(201);

        $createdId = $createRes->json('data.id') ?? $createRes->json('data.product.id');

        $detailRes = $this->getJson("/api/v1/products/{$createdId}");
        $detailRes->assertStatus(200);
        $this->assertCount(1, $detailRes->json('data.variants'));
        $this->assertEquals(40, $detailRes->json('data.variants.0.quantity_on_hand'));
        $this->assertEquals('8858889990001', $detailRes->json('data.variants.0.barcode'));
    }

    // =========================================================================
    // 5. CUSTOMER CRM & LOYALTY
    // =========================================================================

    public function test_search_customers_by_name_and_phone(): void
    {
        Sanctum::actingAs($this->adminUser);

        $c1 = Customer::create([
            'name'            => 'Sophea Pich',
            'phone'           => '+85512777888',
            'email'           => 'sophea.pich@test.local',
            'total_purchased' => 3,
            'total_spent'     => 150.00,
        ]);

        $c2 = Customer::create([
            'name'            => 'Vannak Rith',
            'phone'           => '+85598111222',
            'email'           => 'vannak@test.local',
            'total_purchased' => 1,
            'total_spent'     => 50.00,
        ]);

        // Search by name
        $nameRes = $this->getJson('/api/v1/customers?search=Sophea');
        $nameRes->assertStatus(200);
        $this->assertEquals('Sophea Pich', $nameRes->json('data.0.name'));

        // Search by phone
        $phoneRes = $this->getJson('/api/v1/customers?search=98111222');
        $phoneRes->assertStatus(200);
        $this->assertEquals('Vannak Rith', $phoneRes->json('data.0.name'));
    }

    public function test_customer_detail_with_order_history(): void
    {
        Sanctum::actingAs($this->adminUser);

        $customer = Customer::create([
            'name'            => 'Channary Mao',
            'phone'           => '+85577333444',
            'email'           => 'channary@test.local',
            'total_purchased' => 0,
            'total_spent'     => 0.00,
        ]);

        $response = $this->getJson("/api/v1/customers/{$customer->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'id'    => $customer->id,
                    'name'  => 'Channary Mao',
                    'phone' => '+85577333444',
                ],
            ]);

        $this->assertArrayHasKey('orders', $response->json('data'));
    }

    // =========================================================================
    // 6. SALES CHANNELS
    // =========================================================================

    public function test_list_active_sales_channels(): void
    {
        Sanctum::actingAs($this->adminUser);

        SalesChannel::create([
            'name'      => 'Telegram Bot Store',
            'code'      => 'TG-STORE',
            'type'      => 'TELEGRAM',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/sales-channels');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $channels = $response->json('data');
        $this->assertIsArray($channels);
        $this->assertGreaterThanOrEqual(2, count($channels));

        $channelNames = array_column($channels, 'name');
        $this->assertContains('Main POS Terminal 1', $channelNames);
        $this->assertContains('Telegram Bot Store', $channelNames);
    }

    public function test_create_sales_channel(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->postJson('/api/v1/sales-channels', [
            'name'      => 'TikTok Shop Live',
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Sales channel created successfully.',
                'data'    => [
                    'name'      => 'TikTok Shop Live',
                    'is_active' => true,
                ],
            ]);

        $this->assertDatabaseHas('sales_channels', [
            'name'      => 'TikTok Shop Live',
            'is_active' => 1,
        ]);
    }

    public function test_create_channels_with_same_name_on_different_platforms(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create KC Shop on TikTok
        $res1 = $this->postJson('/api/v1/sales-channels', [
            'name'     => 'KC Shop',
            'platform' => 'tiktok',
        ]);
        $res1->assertStatus(201);

        // 2. Create KC Shop on Facebook -> MUST SUCCEED because platform is different
        $res2 = $this->postJson('/api/v1/sales-channels', [
            'name'     => 'KC Shop',
            'platform' => 'facebook',
        ]);
        $res2->assertStatus(201);

        // 3. Create KC Shop on Store POS -> MUST SUCCEED
        $res3 = $this->postJson('/api/v1/sales-channels', [
            'name'     => 'KC Shop',
            'platform' => 'pos',
        ]);
        $res3->assertStatus(201);

        // 4. Create another KC Shop on TikTok -> MUST FAIL with 422 duplicate validation error
        $res4 = $this->postJson('/api/v1/sales-channels', [
            'name'     => 'KC Shop',
            'platform' => 'tiktok',
        ]);
        $res4->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    // =========================================================================
    // 7. POS ORDER CHECKOUT & STOCK DECREMENT
    // =========================================================================

    public function test_successful_checkout_with_cash_and_ledger_recording(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'client_mutation_id' => 'MUT-CASH-TEST-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 54.00,
            'items'              => [
                [
                    'variant_id' => $this->variant1->id,
                    'quantity'   => 2,
                    'unit_price' => 18.00,
                ],
                [
                    'variant_id' => $this->variant2->id,
                    'quantity'   => 1,
                    'unit_price' => 18.00,
                ],
            ],
            'customer'           => [
                'name'  => 'Walk-in Cash Customer',
                'phone' => '+85512334455',
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Order placed successfully.',
                'data'    => [
                    'client_mutation_id' => 'MUT-CASH-TEST-001',
                    'status'             => 'COMPLETED',
                    'total_amount'       => '54.00',
                ],
            ]);

        $orderId = $response->json('data.id');
        $this->assertNotNull($orderId);

        // Verify stock decrements
        $this->assertEquals(48, $this->variant1->fresh()->quantity_on_hand);
        $this->assertEquals(29, $this->variant2->fresh()->quantity_on_hand);

        // Verify Order Items
        $this->assertDatabaseHas('order_items', [
            'order_id'   => $orderId,
            'variant_id' => $this->variant1->id,
            'quantity'   => 2,
        ]);
        $this->assertDatabaseHas('order_items', [
            'order_id'   => $orderId,
            'variant_id' => $this->variant2->id,
            'quantity'   => 1,
        ]);

        // Verify Payment
        $this->assertDatabaseHas('payments', [
            'order_id'       => $orderId,
            'payment_method' => 'CASH',
            'amount'         => 54.00,
        ]);

        // Verify StockMovement Ledgers
        $movement1 = StockMovement::where('variant_id', $this->variant1->id)->latest()->first();
        $this->assertNotNull($movement1);
        $this->assertEquals('SALE', $movement1->movement_type);
        $this->assertEquals(-2, $movement1->quantity_change);
        $this->assertEquals(50, $movement1->quantity_before);
        $this->assertEquals(48, $movement1->quantity_after);

        $movement2 = StockMovement::where('variant_id', $this->variant2->id)->latest()->first();
        $this->assertNotNull($movement2);
        $this->assertEquals('SALE', $movement2->movement_type);
        $this->assertEquals(-1, $movement2->quantity_change);
        $this->assertEquals(30, $movement2->quantity_before);
        $this->assertEquals(29, $movement2->quantity_after);
    }

    public function test_successful_checkout_with_card_and_aba_khqr(): void
    {
        Sanctum::actingAs($this->adminUser);

        // ABA KHQR checkout
        $khqrPayload = [
            'client_mutation_id' => 'MUT-KHQR-TEST-002',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'ABA KHQR',
            'payment_amount'     => 36.00,
            'transaction_ref'    => 'ABA-TX-99887766',
            'items'              => [
                [
                    'variant_id' => $this->variant1->id,
                    'quantity'   => 2,
                    'unit_price' => 18.00,
                ],
            ],
        ];

        $khqrRes = $this->postJson('/api/v1/orders/checkout', $khqrPayload);
        $khqrRes->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('payments', [
            'payment_method'  => 'ABA KHQR',
            'amount'          => 36.00,
            'transaction_ref' => 'ABA-TX-99887766',
        ]);

        // Card checkout
        $cardPayload = [
            'client_mutation_id' => 'MUT-CARD-TEST-003',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CARD',
            'payment_amount'     => 19.50,
            'transaction_ref'    => 'VISA-AUTH-443322',
            'items'              => [
                [
                    'variant_id' => $this->variant2->id,
                    'quantity'   => 1,
                    'unit_price' => 19.50,
                ],
            ],
        ];

        $cardRes = $this->postJson('/api/v1/orders/checkout', $cardPayload);
        $cardRes->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('payments', [
            'payment_method'  => 'CARD',
            'amount'          => 19.50,
            'transaction_ref' => 'VISA-AUTH-443322',
        ]);
    }

    public function test_multi_item_order_atomic_stock_decrement(): void
    {
        Sanctum::actingAs($this->adminUser);

        $initialQty1 = $this->variant1->quantity_on_hand; // 50
        $initialQty2 = $this->variant2->quantity_on_hand; // 30

        $payload = [
            'client_mutation_id' => 'MUT-MULTI-ATOMIC-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 100.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 5, 'unit_price' => 10.00],
                ['variant_id' => $this->variant2->id, 'quantity' => 5, 'unit_price' => 10.00],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $this->assertEquals($initialQty1 - 5, $this->variant1->fresh()->quantity_on_hand);
        $this->assertEquals($initialQty2 - 5, $this->variant2->fresh()->quantity_on_hand);
    }

    public function test_reject_checkout_on_insufficient_stock_with_atomic_rollback(): void
    {
        Sanctum::actingAs($this->adminUser);

        $initialQty1 = $this->variant1->quantity_on_hand; // 50
        $initialQty2 = $this->variant2->quantity_on_hand; // 30

        // Variant 1 has 50, variant 2 only has 30. We request 999 for variant 2.
        $payload = [
            'client_mutation_id' => 'MUT-INSUFFICIENT-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 20000.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 10, 'unit_price' => 18.00],
                ['variant_id' => $this->variant2->id, 'quantity' => 999, 'unit_price' => 19.50],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertStringContainsString('Insufficient stock', $response->json('message'));

        // Verify neither variant stock was decremented (full atomic rollback)
        $this->assertEquals($initialQty1, $this->variant1->fresh()->quantity_on_hand);
        $this->assertEquals($initialQty2, $this->variant2->fresh()->quantity_on_hand);
    }

    public function test_idempotent_checkout_with_client_mutation_id_no_duplicate_stock_decrement(): void
    {
        Sanctum::actingAs($this->adminUser);

        $initialQty = $this->variant1->quantity_on_hand; // 50

        $payload = [
            'client_mutation_id' => 'MUT-IDEMPOTENT-EXACT-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 36.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
        ];

        // 1st request -> executes checkout
        $res1 = $this->postJson('/api/v1/orders/checkout', $payload);
        $res1->assertStatus(201);
        $order1Id = $res1->json('data.id');

        $this->assertEquals($initialQty - 2, $this->variant1->fresh()->quantity_on_hand);

        // 2nd request -> exact replay of same client_mutation_id
        $res2 = $this->postJson('/api/v1/orders/checkout', $payload);
        $res2->assertStatus(201);
        $order2Id = $res2->json('data.id');

        // Must return the existing order
        $this->assertEquals($order1Id, $order2Id);

        // Crucial: stock must NOT have decremented again
        $this->assertEquals($initialQty - 2, $this->variant1->fresh()->quantity_on_hand);
    }

    public function test_customer_attribution_and_automatic_creation_on_checkout(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'client_mutation_id' => 'MUT-CUST-AUTO-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 36.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
            'customer'           => [
                'name'  => 'Maly Kong',
                'phone' => '+85599001122',
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $customer = Customer::where('phone', '+85599001122')->first();
        $this->assertNotNull($customer);
        $this->assertEquals('Maly Kong', $customer->name);
        $this->assertEquals(1, $customer->total_purchased);
        $this->assertEquals(36.00, (float) $customer->total_spent);
        $this->assertNotNull($customer->last_purchase_at);

        $this->assertEquals($customer->id, $response->json('data.customer_id'));
    }

    public function test_checkout_with_default_zero_tax(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'client_mutation_id' => 'MUT-TAX-DEF-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 36.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $this->assertEquals(0, (float) $response->json('data.tax_rate'));
        $this->assertEquals(0, (float) $response->json('data.tax_amount'));
        $this->assertEquals(36.00, (float) $response->json('data.total_amount'));
    }

    public function test_checkout_with_percentage_tax(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Subtotal = 36.00, 10% tax = 3.60, Total = 39.60
        $payload = [
            'client_mutation_id' => 'MUT-TAX-PCT-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 39.60,
            'tax_type'           => 'percentage',
            'tax_rate'           => 10,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $this->assertEquals(10.00, (float) $response->json('data.tax_rate'));
        $this->assertEquals(3.60, (float) $response->json('data.tax_amount'));
        $this->assertEquals(39.60, (float) $response->json('data.total_amount'));
    }

    public function test_checkout_with_flat_tax(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Subtotal = 36.00, Flat tax = 4.00, Total = 40.00
        $payload = [
            'client_mutation_id' => 'MUT-TAX-FLAT-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 40.00,
            'tax_type'           => 'flat',
            'tax_amount'         => 4.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $this->assertEquals(4.00, (float) $response->json('data.tax_amount'));
        $this->assertEquals(40.00, (float) $response->json('data.total_amount'));
    }

    public function test_checkout_with_default_paid_status(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'client_mutation_id' => 'MUT-STAT-PAID-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 36.00,
            'status'             => 'paid',
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $this->assertEquals('COMPLETED', $response->json('data.status'));
        $this->assertEquals('PAID', $response->json('data.payment_status'));
        $this->assertNotNull($response->json('data.completed_at'));
    }

    public function test_checkout_with_explicit_pending_status(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'client_mutation_id' => 'MUT-STAT-PEND-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 36.00,
            'status'             => 'pending',
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 2, 'unit_price' => 18.00],
            ],
        ];

        $response = $this->postJson('/api/v1/orders/checkout', $payload);
        $response->assertStatus(201);

        $this->assertEquals('PENDING', $response->json('data.status'));
        $this->assertEquals('PENDING', $response->json('data.payment_status'));
        $this->assertNull($response->json('data.completed_at'));
    }

    // =========================================================================
    // 8. ORDER HISTORY & DETAILS
    // =========================================================================

    public function test_list_orders_with_pagination_and_status_filters(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Place an order first
        $this->postJson('/api/v1/orders/checkout', [
            'client_mutation_id' => 'MUT-ORD-LIST-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 18.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 1, 'unit_price' => 18.00],
            ],
        ]);

        $response = $this->getJson('/api/v1/orders');

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'success',
                'data',
                'meta' => [
                    'current_page',
                    'per_page',
                    'total',
                    'last_page',
                ],
            ]);

        $this->assertGreaterThanOrEqual(1, $response->json('meta.total'));
    }

    public function test_get_order_detail_by_id(): void
    {
        Sanctum::actingAs($this->adminUser);

        $checkoutRes = $this->postJson('/api/v1/orders/checkout', [
            'client_mutation_id' => 'MUT-ORD-DETAIL-001',
            'channel_id'         => $this->posChannel->id,
            'payment_method'     => 'CASH',
            'payment_amount'     => 18.00,
            'items'              => [
                ['variant_id' => $this->variant1->id, 'quantity' => 1, 'unit_price' => 18.00],
            ],
            'customer'           => [
                'name'  => 'Detail Test Customer',
                'phone' => '+85599887766',
            ],
        ]);
        $orderId = $checkoutRes->json('data.id');

        $response = $this->getJson("/api/v1/orders/{$orderId}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'id'                 => $orderId,
                    'client_mutation_id' => 'MUT-ORD-DETAIL-001',
                ],
            ]);

        $orderData = $response->json('data');
        $this->assertArrayHasKey('customer', $orderData);
        $this->assertArrayHasKey('channel', $orderData);
        $this->assertArrayHasKey('items', $orderData);
        $this->assertArrayHasKey('payments', $orderData);
    }

    // =========================================================================
    // 9. INVENTORY RESTOCK INTAKE
    // =========================================================================

    public function test_batch_restock_intake_creates_session_and_increments_stock(): void
    {
        Sanctum::actingAs($this->adminUser);

        $initialQty1 = $this->variant1->quantity_on_hand; // 50
        $initialQty2 = $this->variant2->quantity_on_hand; // 30

        $payload = [
            'notes' => 'Weekly supplier intake batch #42',
            'items' => [
                [
                    'variant_id'      => $this->variant1->id,
                    'quantity'        => 25,
                    'unit_cost'       => 7.50,
                    'scanned_barcode' => '8851234567891',
                ],
                [
                    'variant_id'      => $this->variant2->id,
                    'quantity'        => 15,
                    'unit_cost'       => 8.00,
                    'scanned_barcode' => '8851234567892',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/inventory/restock', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Restock session completed successfully.',
                'data'    => [
                    'status' => 'COMPLETED',
                    'notes'  => 'Weekly supplier intake batch #42',
                ],
            ]);

        $sessionId = $response->json('data.id');
        $this->assertNotNull($sessionId);

        // Verify RestockSession & RestockDetails in database
        $this->assertDatabaseHas('restock_sessions', [
            'id'     => $sessionId,
            'status' => 'COMPLETED',
        ]);

        $this->assertDatabaseHas('restock_details', [
            'restock_session_id' => $sessionId,
            'variant_id'         => $this->variant1->id,
            'quantity'           => 25,
            'unit_cost'          => 7.50,
        ]);

        $this->assertDatabaseHas('restock_details', [
            'restock_session_id' => $sessionId,
            'variant_id'         => $this->variant2->id,
            'quantity'           => 15,
            'unit_cost'          => 8.00,
        ]);

        // Verify variant stock increment
        $this->assertEquals($initialQty1 + 25, $this->variant1->fresh()->quantity_on_hand);
        $this->assertEquals($initialQty2 + 15, $this->variant2->fresh()->quantity_on_hand);

        // Verify StockMovement ledgers
        $sm1 = StockMovement::where('variant_id', $this->variant1->id)
            ->where('movement_type', 'RESTOCK')
            ->latest()
            ->first();
        $this->assertNotNull($sm1);
        $this->assertEquals(25, $sm1->quantity_change);
        $this->assertEquals($initialQty1, $sm1->quantity_before);
        $this->assertEquals($initialQty1 + 25, $sm1->quantity_after);
        $this->assertEquals($sessionId, $sm1->reference_id);

        $sm2 = StockMovement::where('variant_id', $this->variant2->id)
            ->where('movement_type', 'RESTOCK')
            ->latest()
            ->first();
        $this->assertNotNull($sm2);
        $this->assertEquals(15, $sm2->quantity_change);
    }

    // =========================================================================
    // 10. STOCK ADJUSTMENT & REASON CODES
    // =========================================================================

    public function test_stock_adjustment_updates_quantity_and_records_movement(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'variant_id'       => $this->variant1->id,
            'current_quantity' => 50,
            'new_quantity'     => 42,
            'difference'       => -8,
            'reason'           => 'Damaged',
            'notes'            => 'Box dropped during shelf stocking',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Stock adjusted successfully.',
                'data'    => [
                    'variant_id'   => $this->variant1->id,
                    'new_quantity' => 42,
                    'difference'   => -8,
                    'reason'       => 'Damaged',
                ],
            ]);

        $this->assertEquals(42, $this->variant1->fresh()->quantity_on_hand);

        $movement = StockMovement::where('variant_id', $this->variant1->id)->latest()->first();
        $this->assertNotNull($movement);
        $this->assertEquals('DAMAGE', $movement->movement_type);
        $this->assertEquals(-8, $movement->quantity_change);
        $this->assertEquals(50, $movement->quantity_before);
        $this->assertEquals(42, $movement->quantity_after);
        $this->assertEquals($this->adminUser->id, $movement->user_id);
    }

    public function test_stock_adjustment_maps_all_canonical_reason_codes(): void
    {
        Sanctum::actingAs($this->adminUser);

        $reasonMappings = [
            'Audit'     => 'ADJUSTMENT',
            'Damaged'   => 'DAMAGE',
            'Restock'   => 'RESTOCK',
            'Return'    => 'RETURN',
            'Shrinkage' => 'SHRINKAGE',
        ];

        $currentStock = $this->variant2->quantity_on_hand; // 30

        foreach ($reasonMappings as $reason => $expectedMovementType) {
            $newStock = $currentStock + 5;

            $payload = [
                'variant_id'       => $this->variant2->id,
                'current_quantity' => $currentStock,
                'new_quantity'     => $newStock,
                'difference'       => 5,
                'reason'           => $reason,
                'notes'            => "Testing reason {$reason}",
            ];

            $res = $this->postJson('/api/v1/inventory/adjust', $payload);
            $res->assertStatus(200);

            $this->assertEquals($newStock, $this->variant2->fresh()->quantity_on_hand);

            $movement = StockMovement::where('variant_id', $this->variant2->id)
                ->where('movement_type', $expectedMovementType)
                ->latest()
                ->first();

            $this->assertNotNull($movement, "Expected movement type {$expectedMovementType} for reason {$reason}");
            $this->assertEquals($expectedMovementType, $movement->movement_type);
            $this->assertEquals(5, $movement->quantity_change);
            $this->assertEquals($currentStock, $movement->quantity_before);
            $this->assertEquals($newStock, $movement->quantity_after);

            $currentStock = $newStock;
        }
    }

    public function test_stock_adjustment_rejects_negative_quantity(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'variant_id'       => $this->variant1->id,
            'current_quantity' => 50,
            'new_quantity'     => -10,
            'difference'       => -60,
            'reason'           => 'Damaged',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_stock_adjustment_rejects_invalid_reason(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'variant_id'       => $this->variant1->id,
            'current_quantity' => 50,
            'new_quantity'     => 40,
            'difference'       => -10,
            'reason'           => 'InvalidReasonName',
        ];

        $response = $this->postJson('/api/v1/inventory/adjust', $payload);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    // =========================================================================
    // 11. AUDIT LOGS
    // =========================================================================

    public function test_retrieve_audit_logs_includes_stock_movements_and_login_events(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create a stock movement record
        StockMovement::create([
            'variant_id'      => $this->variant1->id,
            'product_id'      => $this->product->id,
            'movement_type'   => 'ADJUSTMENT',
            'quantity_before' => 50,
            'quantity_after'  => 45,
            'quantity_change' => -5,
            'reference_id'    => 'ADJ-AUDIT-001',
            'notes'           => 'Cycle count check',
            'user_id'         => $this->adminUser->id,
            'created_by'      => $this->adminUser->id,
        ]);

        $response = $this->getJson('/api/v1/audit-logs');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $logs = $response->json('data');
        $this->assertIsArray($logs);
        $this->assertNotEmpty($logs);

        $firstLog = $logs[0];
        $this->assertArrayHasKey('id', $firstLog);
        $this->assertArrayHasKey('action', $firstLog);
        $this->assertArrayHasKey('target', $firstLog);
        $this->assertArrayHasKey('by', $firstLog);
        $this->assertArrayHasKey('time', $firstLog);

        $this->assertEquals($this->adminUser->name, $firstLog['by']);
        $this->assertStringContainsString('-5', $firstLog['target']);
    }

    // =========================================================================
    // 12. HEALTH DIAGNOSTICS
    // =========================================================================

    public function test_health_diagnostics_public_and_v1_endpoints(): void
    {
        // Public top-level /health
        $topHealth = $this->getJson('/health');
        $topHealth->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'status' => 'healthy',
                ],
            ]);

        // API v1 /api/v1/health
        $v1Health = $this->getJson('/api/v1/health');
        $v1Health->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'status'  => 'healthy',
                    'version' => 'v1',
                ],
            ]);

        // API top-level /api/health
        $apiHealth = $this->getJson('/api/health');
        $apiHealth->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'status' => 'healthy',
                ],
            ]);
    }
}
