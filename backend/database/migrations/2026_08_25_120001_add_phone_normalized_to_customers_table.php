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
        Schema::table('customers', function (Blueprint $table) {
            $table->string('phone_normalized', 50)->nullable()->after('phone');
            $table->index('phone_normalized');
        });

        // Backfill existing customer normalized phone numbers (digits only)
        $customers = DB::table('customers')->get(['id', 'phone']);
        foreach ($customers as $c) {
            if ($c->phone) {
                $digits = preg_replace('/\D/', '', $c->phone);
                DB::table('customers')
                    ->where('id', $c->id)
                    ->update(['phone_normalized' => $digits]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['phone_normalized']);
            $table->dropColumn('phone_normalized');
        });
    }
};
