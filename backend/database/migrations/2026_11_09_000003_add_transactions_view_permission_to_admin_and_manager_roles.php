<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $perm = Permission::where('slug', 'transactions:view')->first();
        if (! $perm) {
            $perm = Permission::create([
                'name'        => 'View Transactions',
                'slug'        => 'transactions:view',
                'module'      => 'sales',
                'description' => 'View order transactions and payment receipts',
            ]);
        }

        $roles = Role::whereIn('slug', ['ADMIN', 'MANAGER'])->get();
        foreach ($roles as $role) {
            if (! $role->permissions()->where('permissions.id', $perm->id)->exists()) {
                $role->permissions()->attach($perm->id);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $perm = Permission::where('slug', 'transactions:view')->first();
        if ($perm) {
            $roles = Role::whereIn('slug', ['ADMIN', 'MANAGER'])->get();
            foreach ($roles as $role) {
                $role->permissions()->detach($perm->id);
            }
        }
    }
};

