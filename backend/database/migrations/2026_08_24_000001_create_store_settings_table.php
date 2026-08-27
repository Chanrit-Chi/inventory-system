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
        Schema::create('store_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('store_name')->default('KC Inventory');
            $table->string('tagline')->nullable()->default('Omnichannel Suite');
            $table->longText('logo_url')->nullable();
            $table->string('primary_color')->default('#005F83');
            $table->string('store_address')->nullable();
            $table->string('store_phone')->nullable();
            $table->string('receipt_header')->nullable();
            $table->text('receipt_footer')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('store_settings');
    }
};
