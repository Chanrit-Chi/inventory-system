<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class RbacDatabaseAndModelsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that dynamic RBAC tables and user role_id column exist.
     */
    public function test_dynamic_rbac_tables_and_columns_exist(): void
    {
        $this->assertTrue(Schema::hasTable('roles'), "Table 'roles' does not exist.");
        $this->assertTrue(Schema::hasTable('permissions'), "Table 'permissions' does not exist.");
        $this->assertTrue(Schema::hasTable('permission_role'), "Table 'permission_role' does not exist.");

        $this->assertTrue(
            Schema::hasColumns('roles', ['id', 'name', 'slug', 'description', 'created_at', 'updated_at']),
            "Columns on 'roles' table mismatch."
        );

        $this->assertTrue(
            Schema::hasColumns('permissions', ['id', 'name', 'slug', 'module', 'description', 'created_at', 'updated_at']),
            "Columns on 'permissions' table mismatch."
        );

        $this->assertTrue(
            Schema::hasColumns('permission_role', ['id', 'role_id', 'permission_id', 'created_at', 'updated_at']),
            "Columns on 'permission_role' table mismatch."
        );

        $this->assertTrue(
            Schema::hasColumn('users', 'role_id'),
            "Column 'role_id' missing from 'users' table."
        );
    }

    /**
     * Test Role and Permission relationship and UUID pivot generation.
     */
    public function test_roles_and_permissions_relationship(): void
    {
        $role = Role::create([
            'name'        => 'Custom Role',
            'slug'        => 'CUSTOM_ROLE',
            'description' => 'A custom role for testing',
        ]);

        $permission = Permission::create([
            'name'        => 'Custom Action',
            'slug'        => 'custom:action',
            'module'      => 'custom',
            'description' => 'Perform custom action',
        ]);

        $this->assertTrue(Str::isUuid($role->id));
        $this->assertTrue(Str::isUuid($permission->id));

        $role->permissions()->attach($permission->id);

        $this->assertDatabaseHas('permission_role', [
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
        ]);

        $pivotRow = \Illuminate\Support\Facades\DB::table('permission_role')
            ->where('role_id', $role->id)
            ->where('permission_id', $permission->id)
            ->first();

        $this->assertNotNull($pivotRow);
        $this->assertTrue(Str::isUuid($pivotRow->id));

        $this->assertCount(1, $role->fresh()->permissions);
        $this->assertEquals('custom:action', $role->fresh()->permissions->first()->slug);
        $this->assertCount(1, $permission->fresh()->roles);
        $this->assertEquals('CUSTOM_ROLE', $permission->fresh()->roles->first()->slug);
    }

    /**
     * Test permission evaluation including module wildcards and global wildcard.
     */
    public function test_role_has_permission_and_wildcard_matching(): void
    {
        $adminRole = Role::create([
            'name' => 'Admin Role',
            'slug' => 'ADMIN_ROLE',
        ]);

        $productsWildcard = Permission::create([
            'name'   => 'All Products',
            'slug'   => 'products:*',
            'module' => 'products',
        ]);

        $usersManage = Permission::create([
            'name'   => 'Manage Users',
            'slug'   => 'users:manage',
            'module' => 'users',
        ]);

        $adminRole->permissions()->attach([$productsWildcard->id, $usersManage->id]);

        // Exact match
        $this->assertTrue($adminRole->hasPermission('users:manage'));
        $this->assertTrue($adminRole->hasPermission('products:*'));

        // Wildcard module matching
        $this->assertTrue($adminRole->hasPermission('products:create'));
        $this->assertTrue($adminRole->hasPermission('products:read'));
        $this->assertTrue($adminRole->hasPermission('products:delete'));

        // Disallowed
        $this->assertFalse($adminRole->hasPermission('pos:checkout'));
        $this->assertFalse($adminRole->hasPermission('expenses:view'));

        // Super Admin bypass
        $superAdminRole = Role::create([
            'name' => 'Super Admin',
            'slug' => 'SUPER_ADMIN',
        ]);
        $this->assertTrue($superAdminRole->hasPermission('pos:checkout'));
        $this->assertTrue($superAdminRole->hasPermission('any:wild:permission'));
        $this->assertEquals(['*'], $superAdminRole->getPermissionsArray());
    }

    /**
     * Test User backward compatibility with role string and dynamic permission methods.
     */
    public function test_user_backward_compatibility_and_permissions(): void
    {
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->seed(RolePermissionSeeder::class);

        // 1. Create user with legacy role string 'MANAGER'
        $manager = User::create([
            'name'     => 'Store Manager Test',
            'email'    => 'mgr_test@inventory.local',
            'password' => 'password',
            'role'     => 'MANAGER',
        ]);

        $this->assertEquals('MANAGER', $manager->role);
        $this->assertNotNull($manager->role_id);
        $this->assertEquals('MANAGER', $manager->roleRelation->slug);
        $this->assertTrue($manager->hasPermission('inventory:adjust'));
        $this->assertTrue($manager->hasPermission('products:read'));
        $this->assertFalse($manager->hasPermission('users:manage'));

        // 2. Create user with legacy lowercase 'cashier'
        $cashier = User::create([
            'name'     => 'Cashier Test',
            'email'    => 'cashier_test@inventory.local',
            'password' => 'password',
            'role'     => 'cashier',
        ]);

        $this->assertEquals('SELLER', $cashier->role);
        $this->assertNotNull($cashier->role_id);
        $this->assertTrue($cashier->hasPermission('pos:checkout'));
        $this->assertTrue($cashier->hasPermission('inventory:scan'));
        $this->assertFalse($cashier->hasPermission('inventory:adjust'));

        // 3. Super Admin has unrestricted permissions
        $superAdmin = User::create([
            'name'     => 'Super Admin Test',
            'email'    => 'sa_test@inventory.local',
            'password' => 'password',
            'role'     => 'SUPER_ADMIN',
        ]);

        $this->assertTrue($superAdmin->hasPermission('any:unassigned:capability'));
        $this->assertEquals(['*'], $superAdmin->getPermissionsArray());
    }

    /**
     * Test DatabaseSeeder populates all RBAC tables and relationships cleanly.
     */
    public function test_seeders_populate_default_roles_and_permissions(): void
    {
        $this->seed(DatabaseSeeder::class);

        // 1. Roles seeded
        $this->assertEquals(4, Role::count());
        $this->assertDatabaseHas('roles', ['slug' => 'SUPER_ADMIN']);
        $this->assertDatabaseHas('roles', ['slug' => 'ADMIN']);
        $this->assertDatabaseHas('roles', ['slug' => 'MANAGER']);
        $this->assertDatabaseHas('roles', ['slug' => 'SELLER']);

        // 2. Permissions seeded
        $this->assertGreaterThanOrEqual(20, Permission::count());
        $this->assertDatabaseHas('permissions', ['slug' => 'products:*']);
        $this->assertDatabaseHas('permissions', ['slug' => 'users:manage']);
        $this->assertDatabaseHas('permissions', ['slug' => 'pos:checkout']);

        // 3. Role capabilities attached
        $admin = Role::where('slug', 'ADMIN')->first();
        $this->assertNotNull($admin);
        $adminPerms = $admin->getPermissionsArray();
        $this->assertContains('products:*', $adminPerms);
        $this->assertContains('sales:*', $adminPerms);
        $this->assertContains('users:manage', $adminPerms);
        $this->assertContains('reports:view', $adminPerms);
        $this->assertContains('expenses:*', $adminPerms);
        $this->assertContains('settings:*', $adminPerms);

        $manager = Role::where('slug', 'MANAGER')->first();
        $this->assertNotNull($manager);
        $managerPerms = $manager->getPermissionsArray();
        $this->assertContains('products:read', $managerPerms);
        $this->assertContains('inventory:adjust', $managerPerms);
        $this->assertContains('pos:*', $managerPerms);
        $this->assertContains('expenses:*', $managerPerms);
        $this->assertContains('reports:view', $managerPerms);
        $this->assertContains('quotations:*', $managerPerms);
        $this->assertContains('customers:*', $managerPerms);

        $seller = Role::where('slug', 'SELLER')->first();
        $this->assertNotNull($seller);
        $sellerPerms = $seller->getPermissionsArray();
        $this->assertContains('pos:checkout', $sellerPerms);
        $this->assertContains('inventory:scan', $sellerPerms);
        $this->assertContains('quotations:create', $sellerPerms);
        $this->assertContains('customers:view', $sellerPerms);
        $this->assertContains('transactions:view', $sellerPerms);

        // 4. Seeded users have valid role_id
        $seededUsers = User::with('roleRelation')->get();
        foreach ($seededUsers as $user) {
            $this->assertNotNull($user->role_id, "User {$user->email} has null role_id");
            $this->assertNotNull($user->roleRelation, "User {$user->email} has invalid role relation");
            $this->assertEquals($user->role, $user->roleRelation->slug);
        }
    }

    /**
     * Test cascade delete behavior on roles and permissions.
     */
    public function test_cascade_delete_on_roles_and_permissions(): void
    {
        $role = Role::create(['name' => 'Temp Role', 'slug' => 'TEMP_ROLE']);
        $permission = Permission::create(['name' => 'Temp Perm', 'slug' => 'temp:perm', 'module' => 'temp']);
        $role->permissions()->attach($permission->id);

        $user = User::create([
            'name'     => 'Temp User',
            'email'    => 'temp@inventory.local',
            'password' => 'password',
            'role_id'  => $role->id,
            'role'     => 'TEMP_ROLE',
        ]);

        $this->assertDatabaseHas('permission_role', ['role_id' => $role->id, 'permission_id' => $permission->id]);

        // Delete role -> cascade drops pivot and sets user.role_id to null
        $role->delete();

        $this->assertDatabaseMissing('permission_role', ['role_id' => $role->id]);
        $this->assertNull($user->fresh()->role_id);

        // Delete permission -> cascade drops pivot
        $role2 = Role::create(['name' => 'Temp Role 2', 'slug' => 'TEMP_ROLE_2']);
        $role2->permissions()->attach($permission->id);
        $this->assertDatabaseHas('permission_role', ['role_id' => $role2->id, 'permission_id' => $permission->id]);

        $permission->delete();
        $this->assertDatabaseMissing('permission_role', ['permission_id' => $permission->id]);
    }
}
