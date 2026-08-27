<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $rolePermissions = [
            'SUPER_ADMIN' => [
                '*',
            ],
            'ADMIN' => [
                'products:*',
                'categories:manage',
                'attributes:manage',
                'inventory:*',
                'suppliers:*',
                'purchase-orders:*',
                'pos:*',
                'sales:*',
                'invoices:*',
                'quotations:*',
                'customers:*',
                'delivery:*',
                'payment-methods:*',
                'channels:*',
                'expenses:*',
                'payroll:*',
                'reports:view',
                'reports:export',
                'users:*',
                'users:view',
                'users:manage',
                'roles:manage',
                'audit:view',
                'settings:*',
            ],
            'MANAGER' => [
                'products:read',
                'categories:manage',
                'attributes:manage',
                'inventory:adjust',
                'inventory:restock',
                'inventory:scan',
                'suppliers:view',
                'purchase-orders:*',
                'pos:*',
                'sales:*',
                'invoices:*',
                'quotations:*',
                'customers:*',
                'delivery:view',
                'payment-methods:view',
                'channels:view',
                'expenses:*',
                'payroll:view',
                'users:view',
                'reports:view',
                'reports:export',
            ],
            'SELLER' => [
                'pos:checkout',
                'inventory:scan',
                'quotations:create',
                'invoices:view',
                'invoices:record-payment',
                'customers:view',
                'transactions:view',
                'delivery:view',
            ],
        ];

        foreach ($rolePermissions as $roleSlug => $permissionSlugs) {
            $role = Role::where('slug', $roleSlug)->first();
            if (!$role) {
                continue;
            }

            $permissionIds = Permission::whereIn('slug', $permissionSlugs)->pluck('id')->toArray();
            $role->permissions()->sync($permissionIds);
        }
    }
}
