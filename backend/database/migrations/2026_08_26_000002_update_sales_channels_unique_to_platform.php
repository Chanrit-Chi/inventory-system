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
            $driver = DB::getDriverName();
            if ($driver === 'sqlite') {
                DB::statement('DROP INDEX IF EXISTS sales_channels_name_unique');
                DB::statement('DROP INDEX IF EXISTS sales_channels_code_unique');
                DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS sales_channels_name_platform_unique ON sales_channels(name, platform)');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE sales_channels DROP CONSTRAINT IF EXISTS sales_channels_name_unique');
                DB::statement('ALTER TABLE sales_channels DROP CONSTRAINT IF EXISTS sales_channels_code_unique');
                $exists = DB::select("SELECT 1 FROM pg_constraint WHERE conname = 'sales_channels_name_platform_unique'");
                if (empty($exists)) {
                    DB::statement('ALTER TABLE sales_channels ADD CONSTRAINT sales_channels_name_platform_unique UNIQUE (name, platform)');
                }
            } else {
                Schema::table('sales_channels', function (Blueprint $table) {
                    try {
                        $table->dropUnique('sales_channels_name_unique');
                    } catch (\Throwable $e) {}
                    try {
                        $table->dropUnique('sales_channels_code_unique');
                    } catch (\Throwable $e) {}
                    try {
                        $table->unique(['name', 'platform'], 'sales_channels_name_platform_unique');
                    } catch (\Throwable $e) {}
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
            $driver = DB::getDriverName();
            if ($driver === 'sqlite') {
                DB::statement('DROP INDEX IF EXISTS sales_channels_name_platform_unique');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE sales_channels DROP CONSTRAINT IF EXISTS sales_channels_name_platform_unique');
            } else {
                Schema::table('sales_channels', function (Blueprint $table) {
                    try {
                        $table->dropUnique('sales_channels_name_platform_unique');
                    } catch (\Throwable $e) {}
                });
            }
        }
    }
};
