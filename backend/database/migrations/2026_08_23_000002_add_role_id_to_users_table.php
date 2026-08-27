<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignUuid('role_id')
                ->nullable()
                ->after('password')
                ->constrained('roles')
                ->nullOnDelete();
        });

        // Migrate existing users.role to role_id if roles table has records
        if (Schema::hasTable('roles')) {
            $roles = DB::table('roles')->pluck('id', 'slug');
            if ($roles->isNotEmpty()) {
                foreach ($roles as $slug => $roleId) {
                    DB::table('users')->where('role', $slug)->update(['role_id' => $roleId]);
                }
                // Handle lowercase legacy values
                if (isset($roles['ADMIN'])) {
                    DB::table('users')->where('role', 'admin')->update(['role_id' => $roles['ADMIN']]);
                }
                if (isset($roles['SELLER'])) {
                    DB::table('users')->where('role', 'cashier')->update(['role_id' => $roles['SELLER']]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });
    }
};
