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
        Schema::create('seller_daily_settlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('seller_id');
            $table->date('confirmed_date');
            $table->integer('total_orders_count')->default(0);
            $table->decimal('total_sales_amount', 12, 2)->default(0.00);
            $table->decimal('total_incentive_amount', 12, 2)->default(0.00);
            $table->string('status', 32)->default('CONFIRMED'); // CONFIRMED, REVISED, DISPUTED
            $table->timestamp('confirmed_at');
            $table->uuid('confirmed_by');
            $table->json('order_ids')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('seller_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('confirmed_by')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['seller_id', 'confirmed_date'], 'seller_daily_settlement_unique');
            $table->index(['confirmed_date', 'seller_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seller_daily_settlements');
    }
};
