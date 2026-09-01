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
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->text('logo_icon')->nullable()->change();
            if (!Schema::hasColumn('bank_accounts', 'account_type')) {
                $table->string('account_type', 50)->nullable()->default('checking')->after('account_number');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->string('logo_icon', 50)->nullable()->default('qr-code')->change();
            if (Schema::hasColumn('bank_accounts', 'account_type')) {
                $table->dropColumn('account_type');
            }
        });
    }
};
