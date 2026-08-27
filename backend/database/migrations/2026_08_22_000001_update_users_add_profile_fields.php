<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Expand role to support all mobile app roles
            // SQLite doesn't support ALTER COLUMN for enums, so we use string
            $table->string('role')->default('SELLER')->change();
            $table->string('phone')->nullable()->after('email');
            $table->boolean('is_active')->default(true)->after('role');
            $table->string('permission_group')->nullable()->after('is_active');
        });

        // Migrate existing role values to new uppercase format
        DB::table('users')->where('role', 'admin')->update(['role' => 'ADMIN']);
        DB::table('users')->where('role', 'cashier')->update(['role' => 'SELLER']);
    }

    public function down(): void
    {
        DB::table('users')->whereIn('role', ['SUPER_ADMIN', 'ADMIN'])->update(['role' => 'admin']);
        DB::table('users')->whereNotIn('role', ['admin', 'cashier'])->update(['role' => 'cashier']);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'is_active', 'permission_group']);
            $table->enum('role', ['admin', 'cashier'])->default('cashier')->change();
        });
    }
};
