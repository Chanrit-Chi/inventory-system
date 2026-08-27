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
        Schema::table('payrolls', function (Blueprint $table) {
            $table->integer('working_days')->default(26)->after('base_salary');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignUuid('seller_id')->nullable()->constrained('users')->nullOnDelete()->after('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['seller_id']);
            $table->dropColumn('seller_id');
        });

        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn('working_days');
        });
    }
};
