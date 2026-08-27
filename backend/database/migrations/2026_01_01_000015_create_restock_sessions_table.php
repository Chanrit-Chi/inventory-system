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
        Schema::create('restock_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('session_code', 100)->nullable()->unique();
            $table->timestamp('session_date')->useCurrent();
            $table->string('status', 50)->default('DRAFT');
            $table->decimal('total_cost', 10, 2)->default(0.00);
            $table->foreignUuid('user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->index('session_code');
            $table->index('session_date');
            $table->index('user_id');
            $table->index('status');
            $table->index('confirmed_at');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('restock_sessions');
    }
};
