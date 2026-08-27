<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_salaries', function (Blueprint $table) {
            // Allow salary history: one row per raise instead of one row per staff
            $table->dropUnique(['user_id']);
            $table->date('effective_from')->nullable()->after('base_salary');
            $table->index(['user_id', 'effective_from']);
        });

        // Existing rows were the "current" salary since they were created
        DB::table('user_salaries')
            ->whereNull('effective_from')
            ->update(['effective_from' => DB::raw('DATE(created_at)')]);
    }

    public function down(): void
    {
        Schema::table('user_salaries', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'effective_from']);
            $table->dropColumn('effective_from');
            $table->unique('user_id');
        });
    }
};
