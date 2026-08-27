<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'hire_date')) {
                $table->date('hire_date')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('users', 'department')) {
                $table->string('department')->nullable()->after('role');
            }
            if (!Schema::hasColumn('users', 'notes')) {
                $table->text('notes')->nullable()->after('permission_group');
            }
        });

        Schema::table('user_salaries', function (Blueprint $table) {
            if (!Schema::hasColumn('user_salaries', 'reason')) {
                $table->string('reason')->nullable()->after('effective_from');
            }
            if (!Schema::hasColumn('user_salaries', 'created_by')) {
                $table->uuid('created_by')->nullable()->after('reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['hire_date', 'department', 'notes']);
        });

        Schema::table('user_salaries', function (Blueprint $table) {
            $table->dropColumn(['reason', 'created_by']);
        });
    }
};
