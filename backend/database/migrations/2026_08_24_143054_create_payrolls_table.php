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
        Schema::create('payrolls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->integer('period_month');
            $table->integer('period_year');
            $table->decimal('base_salary', 15, 2)->default(0);
            $table->decimal('incentive_amount', 15, 2)->default(0);
            $table->decimal('thirteenth_month_contribution', 15, 2)->default(0);
            $table->decimal('performance_benefit', 15, 2)->default(0);
            $table->decimal('delivery_benefit', 15, 2)->default(0);
            $table->decimal('overtime_days', 8, 2)->default(0);
            $table->decimal('overtime_amount', 15, 2)->default(0);
            $table->decimal('unpaid_leave_days', 8, 2)->default(0);
            $table->decimal('unpaid_leave_deduction', 15, 2)->default(0);
            $table->decimal('collective_benefit', 15, 2)->default(0);
            $table->decimal('other_benefits', 15, 2)->default(0);
            $table->decimal('total_net_pay', 15, 2)->default(0);
            $table->string('status')->default('DRAFT'); // DRAFT, FINALIZED, PAID
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['user_id', 'period_month', 'period_year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payrolls');
    }
};
