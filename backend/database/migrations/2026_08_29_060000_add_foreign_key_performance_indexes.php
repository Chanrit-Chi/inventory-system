<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations to add explicit B-tree indexes for all key foreign relationships.
     */
    public function up(): void
    {
        // 1. Orders foreign indexes
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'seller_id')) {
                $table->index('seller_id', 'idx_orders_seller_id');
            }
            if (Schema::hasColumn('orders', 'customer_id')) {
                $table->index('customer_id', 'idx_orders_customer_id');
            }
            if (Schema::hasColumn('orders', 'channel_id')) {
                $table->index('channel_id', 'idx_orders_channel_id');
            }
            if (Schema::hasColumn('orders', 'status') && Schema::hasColumn('orders', 'created_at')) {
                $table->index(['status', 'created_at'], 'idx_orders_status_created');
            }
        });

        // 2. Order Items foreign indexes
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'variant_id')) {
                $table->index('variant_id', 'idx_order_items_variant_id');
            }
            if (Schema::hasColumn('order_items', 'product_id')) {
                $table->index('product_id', 'idx_order_items_product_id');
            }
        });

        // 3. Invoices foreign indexes
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'order_id')) {
                $table->index('order_id', 'idx_invoices_order_id');
            }
            if (Schema::hasColumn('invoices', 'customer_id')) {
                $table->index('customer_id', 'idx_invoices_customer_id');
            }
            if (Schema::hasColumn('invoices', 'status') && Schema::hasColumn('invoices', 'created_at')) {
                $table->index(['status', 'created_at'], 'idx_invoices_status_created');
            }
        });

        // 4. Stock movements foreign indexes
        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'variant_id') && Schema::hasColumn('stock_movements', 'created_at')) {
                $table->index(['variant_id', 'created_at'], 'idx_stock_mov_variant_created');
            }
        });

        // 5. Quotations foreign indexes
        Schema::table('quotations', function (Blueprint $table) {
            if (Schema::hasColumn('quotations', 'customer_id')) {
                $table->index('customer_id', 'idx_quotations_customer_id');
            }
            if (Schema::hasColumn('quotations', 'user_id')) {
                $table->index('user_id', 'idx_quotations_user_id');
            }
        });

        // 6. Expenses foreign indexes
        Schema::table('expenses', function (Blueprint $table) {
            if (Schema::hasColumn('expenses', 'user_id')) {
                $table->index('user_id', 'idx_expenses_user_id');
            }
            if (Schema::hasColumn('expenses', 'payroll_id')) {
                $table->index('payroll_id', 'idx_expenses_payroll_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('idx_orders_seller_id');
            $table->dropIndex('idx_orders_customer_id');
            $table->dropIndex('idx_orders_channel_id');
            $table->dropIndex('idx_orders_status_created');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropIndex('idx_order_items_variant_id');
            $table->dropIndex('idx_order_items_product_id');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('idx_invoices_order_id');
            $table->dropIndex('idx_invoices_customer_id');
            $table->dropIndex('idx_invoices_status_created');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex('idx_stock_mov_variant_created');
        });

        Schema::table('quotations', function (Blueprint $table) {
            $table->dropIndex('idx_quotations_customer_id');
            $table->dropIndex('idx_quotations_user_id');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex('idx_expenses_user_id');
            $table->dropIndex('idx_expenses_payroll_id');
        });
    }
};
