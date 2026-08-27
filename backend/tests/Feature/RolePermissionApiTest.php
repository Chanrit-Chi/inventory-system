<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * RolePermissionApiTest
 *
 * Comprehensive feature tests for Milestone 2 (Requirement R2):
 * - Super Admin Role & Permission Management API (GET /roles, GET /permissions, GET /roles/{id}, PUT /roles/{id}/permissions)
 * - Strict RBAC guarding against Non-Super Admin access (Admin, Manager, Seller receiving 403)
 * - Auth login and /me payload including dynamic 'permissions' array
 * - Real-time dynamic access mutation (granting/revoking capability dynamically alters endpoint authorization)
 * - Super Admin lockout protection
 * - Validation and error handling
 */
class RolePermissionApiTest extends TestCase
{
    use DatabaseMigrations;

    private User $superAdmin;
    private User $admin;
    private User $manager;
    private User $seller;
    private Role $superAdminRole;
    private Role $adminRole;
    private Role $managerRole;
    private Role $sellerRole;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        // Seed full database with RBAC roles, permissions, and default relations
        $this->seed(DatabaseSeeder::class);

        $this->superAdminRole = Role::where('slug', 'SUPER_ADMIN')->firstOrFail();
        $this->adminRole = Role::where('slug', 'ADMIN')->firstOrFail();
        $this->managerRole = Role::where('slug', 'MANAGER')->firstOrFail();
        $this->sellerRole = Role::where('slug', 'SELLER')->firstOrFail();

        $this->superAdmin = User::where('email', 'admin@inventory.local')->firstOrFail();
        $this->admin = User::where('email', 'branch@inventory.local')->firstOrFail();
        $this->manager = User::where('email', 'manager@inventory.local')->firstOrFail();
        $this->seller = User::where('email', 'cashier1@inventory.local')->firstOrFail();
    }

    // =========================================================================
    // 1. SUPER ADMIN ROLE & PERMISSION LISTING TESTS
    // =========================================================================

    public function test_super_admin_can_list_all_roles(): void
    {
        $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/roles');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'slug',
                        'description',
                        'permissions',
                        'users_count',
                        'usersCount',
                    ],
                ],
            ]);

        $rolesData = $response->json('data');
        $this->assertCount(4, $rolesData);

        $slugs = array_column($rolesData, 'slug');
        $this->assertContains('SUPER_ADMIN', $slugs);
        $this->assertContains('ADMIN', $slugs);
        $this->assertContains('MANAGER', $slugs);
        $this->assertContains('SELLER', $slugs);

        // Check user count on roles
        $adminItem = collect($rolesData)->firstWhere('slug', 'ADMIN');
        $this->assertNotNull($adminItem);
        $this->assertGreaterThanOrEqual(1, $adminItem['users_count']);
        $this->assertIsArray($adminItem['permissions']);
    }

    public function test_super_admin_can_list_all_system_permissions(): void
    {
        $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/permissions');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'slug',
                        'module',
                        'description',
                    ],
                ],
            ]);

        $permsData = $response->json('data');
        $this->assertGreaterThanOrEqual(20, count($permsData));

        $slugs = array_column($permsData, 'slug');
        $this->assertContains('products:*', $slugs);
        $this->assertContains('users:manage', $slugs);
        $this->assertContains('inventory:adjust', $slugs);
        $this->assertContains('pos:checkout', $slugs);
    }

    public function test_super_admin_can_view_single_role_by_id(): void
    {
        $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson("/api/v1/roles/{$this->managerRole->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id'   => $this->managerRole->id,
                    'slug' => 'MANAGER',
                ],
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id', 'name', 'slug', 'description', 'permissions', 'users_count', 'usersCount'
                ],
            ]);

        $this->assertContains('inventory:adjust', $response->json('data.permissions'));
    }

    // =========================================================================
    // 2. NON-SUPER ADMIN ACCESS RESTRICTION TESTS (403 FORBIDDEN)
    // =========================================================================

    public function test_admin_cannot_access_or_manage_roles_and_permissions(): void
    {
        // Admin GET /roles -> 403
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/roles')
            ->assertStatus(403)
            ->assertJson(['success' => false]);

        // Admin GET /permissions -> 403
        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/permissions')
            ->assertStatus(403)
            ->assertJson(['success' => false]);

        // Admin GET /roles/{id} -> 403
        $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/roles/{$this->adminRole->id}")
            ->assertStatus(403)
            ->assertJson(['success' => false]);

        // Admin PUT /roles/{id}/permissions -> 403
        $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/roles/{$this->adminRole->id}/permissions", [
            'permissions' => ['products:*'],
        ])->assertStatus(403)->assertJson(['success' => false]);
    }

    public function test_manager_cannot_access_or_manage_roles_and_permissions(): void
    {
        $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/roles')
            ->assertStatus(403)->assertJson(['success' => false]);

        $this->actingAs($this->manager, 'sanctum')->getJson('/api/v1/permissions')
            ->assertStatus(403)->assertJson(['success' => false]);

        $this->actingAs($this->manager, 'sanctum')->putJson("/api/v1/roles/{$this->managerRole->id}/permissions", [
            'permissions' => ['products:*'],
        ])->assertStatus(403)->assertJson(['success' => false]);
    }

    public function test_seller_cannot_access_or_manage_roles_and_permissions(): void
    {
        $this->actingAs($this->seller, 'sanctum')->getJson('/api/v1/roles')
            ->assertStatus(403)->assertJson(['success' => false]);

        $this->actingAs($this->seller, 'sanctum')->getJson('/api/v1/permissions')
            ->assertStatus(403)->assertJson(['success' => false]);

        $this->actingAs($this->seller, 'sanctum')->putJson("/api/v1/roles/{$this->sellerRole->id}/permissions", [
            'permissions' => ['products:*'],
        ])->assertStatus(403)->assertJson(['success' => false]);
    }

    public function test_unauthenticated_request_to_roles_returns_401(): void
    {
        $this->getJson('/api/v1/roles')->assertStatus(401);
        $this->getJson('/api/v1/permissions')->assertStatus(401);
        $this->putJson("/api/v1/roles/{$this->sellerRole->id}/permissions", ['permissions' => []])->assertStatus(401);
    }

    // =========================================================================
    // 3. ROLE PERMISSION UPDATE & PIVOT SYNC TESTS
    // =========================================================================

    public function test_super_admin_can_update_role_permissions_via_slugs(): void
    {
        $newPermissions = ['products:read', 'pos:checkout', 'expenses:view'];

        $response = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->sellerRole->id}/permissions",
            ['permissions' => $newPermissions]
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Role permissions updated successfully.',
                'data' => [
                    'id'   => $this->sellerRole->id,
                    'slug' => 'SELLER',
                ],
            ]);

        $returnedPerms = $response->json('data.permissions');
        sort($newPermissions);
        sort($returnedPerms);
        $this->assertEquals($newPermissions, $returnedPerms);

        // Verify Database pivot
        $updatedPermSlugs = $this->sellerRole->fresh()->permissions->pluck('slug')->toArray();
        sort($updatedPermSlugs);
        $this->assertEquals($newPermissions, $updatedPermSlugs);
    }

    public function test_super_admin_can_update_role_permissions_via_permission_ids(): void
    {
        $perm1 = Permission::where('slug', 'products:read')->firstOrFail();
        $perm2 = Permission::where('slug', 'inventory:adjust')->firstOrFail();

        $response = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->sellerRole->id}/permissions",
            ['permissions' => [$perm1->id, $perm2->id]]
        );

        $response->assertStatus(200);

        $updatedPermSlugs = $this->sellerRole->fresh()->permissions->pluck('slug')->toArray();
        $this->assertContains('products:read', $updatedPermSlugs);
        $this->assertContains('inventory:adjust', $updatedPermSlugs);
        $this->assertCount(2, $updatedPermSlugs);
    }

    public function test_super_admin_lockout_protection_preserves_wildcard(): void
    {
        // Attempt to update SUPER_ADMIN role with only 'products:read'
        $response = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->superAdminRole->id}/permissions",
            ['permissions' => ['products:read']]
        );

        $response->assertStatus(200);

        // Wildcard '*' must still be present in permissions
        $perms = $this->superAdminRole->fresh()->getPermissionsArray();
        $this->assertContains('*', $perms);
    }

    // =========================================================================
    // 4. AUTH LOGIN & /ME PAYLOAD TESTS (DYNAMIC PERMISSIONS IN USER DICT)
    // =========================================================================

    public function test_login_payload_includes_dynamic_permissions_array(): void
    {
        // 1. Super Admin login
        $saRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'admin@inventory.local',
            'password' => 'password',
        ]);

        $saRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'user' => [
                        'id', 'name', 'email', 'role', 'isActive', 'permissions',
                    ],
                ],
            ]);

        $this->assertEquals(['*'], $saRes->json('data.user.permissions'));

        // 2. Manager login
        $mgrRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'manager@inventory.local',
            'password' => 'password',
        ]);

        $mgrRes->assertStatus(200);
        $mgrPerms = $mgrRes->json('data.user.permissions');
        $this->assertIsArray($mgrPerms);
        $this->assertContains('inventory:adjust', $mgrPerms);
        $this->assertContains('products:read', $mgrPerms);
        $this->assertNotContains('users:manage', $mgrPerms);

        // 3. Seller login
        $sellerRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'cashier1@inventory.local',
            'password' => 'password',
        ]);

        $sellerRes->assertStatus(200);
        $sellerPerms = $sellerRes->json('data.user.permissions');
        $this->assertIsArray($sellerPerms);
        $this->assertContains('pos:checkout', $sellerPerms);
    }

    public function test_auth_me_payload_includes_dynamic_permissions_array(): void
    {
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'manager@inventory.local',
            'password' => 'password',
        ]);
        $token = $loginRes->json('data.token');

        $meRes = $this->withToken($token)->getJson('/api/v1/auth/me');

        $meRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'email' => 'manager@inventory.local',
                    'role'  => 'MANAGER',
                ],
            ])
            ->assertJsonStructure([
                'data' => [
                    'id', 'name', 'email', 'role', 'isActive', 'permissions',
                ],
            ]);

        $permissions = $meRes->json('data.permissions');
        $this->assertIsArray($permissions);
        $this->assertContains('inventory:adjust', $permissions);
    }

    public function test_user_management_endpoint_formats_permissions(): void
    {
        $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson("/api/v1/users/{$this->manager->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'id', 'name', 'email', 'role', 'permissions',
                ],
            ]);

        $this->assertIsArray($response->json('data.permissions'));
    }

    // =========================================================================
    // 5. REAL-TIME DYNAMIC PERMISSION GAIN / LOSS MUTATION TESTS
    // =========================================================================

    public function test_user_immediately_gains_and_loses_endpoint_access_when_role_permissions_update(): void
    {
        // 1. Initially, Manager attempts to create a user -> 403 Forbidden (no users:manage permission)
        $initialRes = $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/users', [
            'name'     => 'Dynamic Staff',
            'email'    => 'dynamic.staff@inventory.local',
            'password' => 'Pass123456!',
            'role'     => 'SELLER',
        ]);
        $initialRes->assertStatus(403);

        // 2. Super Admin grants 'users:manage' to MANAGER role
        $currentManagerPerms = $this->managerRole->getPermissionsArray();
        $updatedPerms = array_unique(array_merge($currentManagerPerms, ['users:manage']));

        $grantRes = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->managerRole->id}/permissions",
            ['permissions' => $updatedPerms]
        );
        $grantRes->assertStatus(200);

        // 3. Manager immediately attempts to create user again -> 201 Created!
        $allowedRes = $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/users', [
            'name'     => 'Dynamic Staff',
            'email'    => 'dynamic.staff@inventory.local',
            'password' => 'Pass123456!',
            'role'     => 'SELLER',
        ]);
        $allowedRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'User created successfully.',
            ]);

        $this->assertDatabaseHas('users', ['email' => 'dynamic.staff@inventory.local']);

        // 4. Super Admin revokes 'users:manage' from MANAGER role
        $revokedPerms = array_values(array_diff($updatedPerms, ['users:manage']));
        $revokeRes = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->managerRole->id}/permissions",
            ['permissions' => $revokedPerms]
        );
        $revokeRes->assertStatus(200);

        // 5. Manager immediately attempts to create another user -> 403 Forbidden!
        $blockedRes = $this->actingAs($this->manager, 'sanctum')->postJson('/api/v1/users', [
            'name'     => 'Another Staff',
            'email'    => 'another.staff@inventory.local',
            'password' => 'Pass123456!',
            'role'     => 'SELLER',
        ]);
        $blockedRes->assertStatus(403);
    }

    // =========================================================================
    // 6. VALIDATION & ERROR HANDLING TESTS
    // =========================================================================

    public function test_updating_role_permissions_requires_valid_permissions_array(): void
    {
        // Missing permissions key -> 422
        $res1 = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->sellerRole->id}/permissions",
            []
        );
        $res1->assertStatus(422);

        // Non-array permissions key -> 422
        $res2 = $this->actingAs($this->superAdmin, 'sanctum')->putJson(
            "/api/v1/roles/{$this->sellerRole->id}/permissions",
            ['permissions' => 'not-an-array']
        );
        $res2->assertStatus(422);
    }

    public function test_non_existent_role_returns_404(): void
    {
        $nonExistentUuid = '00000000-0000-0000-0000-000000000000';

        $this->actingAs($this->superAdmin, 'sanctum')->getJson("/api/v1/roles/{$nonExistentUuid}")
            ->assertStatus(404);

        $this->actingAs($this->superAdmin, 'sanctum')->putJson("/api/v1/roles/{$nonExistentUuid}/permissions", [
            'permissions' => ['products:*'],
        ])->assertStatus(404);
    }
}
