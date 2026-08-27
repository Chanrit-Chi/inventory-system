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
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('payment_method', 50);
            $table->decimal('amount', 10, 2);
            $table->string('transaction_ref', 100)->nullable();
            $table->string('reference_number', 100)->nullable();
            $table->text('proof_image_url')->nullable();
            $table->string('status', 50)->default('completed');
            $table->timestamps();

            $table->index('order_id');
            $table->index('payment_method');
            $table->index('transaction_ref');
            $table->index('reference_number');
            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
