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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source_type', 50); // STOCK_MOVEMENT, PERSONAL_ACCESS_TOKEN, ORDER, INVOICE, USER, PAYROLL_AUDIT_LOG
            $table->string('source_id', 255); // Original record ID
            $table->string('action', 60); // e.g., STOCK_ADJUSTMENT, USER_LOGIN, ORDER_COMPLETED
            $table->string('category', 30); // INVENTORY, SECURITY, ORDERS, BILLING, STAFF, PAYROLL
            $table->string('target', 255); // Human-readable target description
            $table->string('actor_name', 100)->nullable(); // Who performed the action
            $table->string('actor_role', 30)->nullable(); // Actor's role
            $table->text('details')->nullable(); // Additional details
            $table->json('metadata')->nullable(); // Flexible additional data (IP, device, etc.)
            $table->timestamp('occurred_at'); // When the event actually happened
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
            $table->index('category');
            $table->index('action');
            $table->index('occurred_at');
            $table->index(['category', 'occurred_at']);
            $table->index(['actor_name', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};