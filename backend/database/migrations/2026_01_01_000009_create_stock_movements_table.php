<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->foreignUuid('variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->string('movement_type', 50)->default('INITIAL');
            $table->string('type', 50)->nullable();
            $table->integer('quantity_change');
            $table->integer('quantity_before')->default(0);
            $table->integer('quantity_after')->default(0);
            $table->string('reference_id', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index('variant_id');
            $table->index('product_id');
            $table->index('movement_type');
            $table->index('type');
            $table->index('reference_id');
            $table->index('user_id');
            $table->index('created_at');
        });

        if (in_array(DB::getDriverName(), ['pgsql', 'mysql'])) {
            DB::statement("ALTER TABLE stock_movements ADD CONSTRAINT check_quantity_change CHECK (quantity_change != 0)");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
