<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'thirteenth_month_payout')) {
                $table->decimal('thirteenth_month_payout', 10, 2)->default(0)->after('thirteenth_month_contribution');
            }
        });

        if (!Schema::hasTable('thirteenth_month_payouts')) {
            Schema::create('thirteenth_month_payouts', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->uuid('payroll_id')->nullable();
                $table->decimal('amount', 10, 2);
                $table->date('payout_date');
                $table->string('payment_method', 50)->default('Cash');
                $table->string('notes', 255)->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('payroll_id')->references('id')->on('payrolls')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('thirteenth_month_payouts');

        Schema::table('payrolls', function (Blueprint $table) {
            if (Schema::hasColumn('payrolls', 'thirteenth_month_payout')) {
                $table->dropColumn('thirteenth_month_payout');
            }
        });
    }
};
