<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignUuid('payroll_id')
                ->nullable()
                ->after('id')
                ->constrained('payrolls')
                ->nullOnDelete();

            $table->index('payroll_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['payroll_id']);
            $table->dropIndex(['payroll_id']);
            $table->dropColumn('payroll_id');
        });
    }
};
