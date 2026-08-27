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
        if (Schema::hasTable('sales_channels')) {
            if (!Schema::hasColumn('sales_channels', 'platform')) {
                Schema::table('sales_channels', function (Blueprint $table) {
                    $table->string('platform', 50)->default('pos')->after('name');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sales_channels')) {
            if (Schema::hasColumn('sales_channels', 'platform')) {
                Schema::table('sales_channels', function (Blueprint $table) {
                    if (DB::getDriverName() !== 'sqlite') {
                        $table->dropColumn('platform');
                    }
                });
            }
        }
    }
};
