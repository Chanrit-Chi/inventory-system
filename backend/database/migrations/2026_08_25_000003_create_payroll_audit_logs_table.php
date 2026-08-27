<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('payroll_audit_logs')) {
            Schema::create('payroll_audit_logs', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('actor_id')->nullable();
                $table->uuid('staff_id')->nullable();
                $table->string('action', 60);
                $table->string('subject')->nullable();
                $table->json('changes')->nullable();
                $table->timestamps();

                $table->foreign('actor_id')->references('id')->on('users')->nullOnDelete();
                $table->foreign('staff_id')->references('id')->on('users')->nullOnDelete();

                $table->index('action');
                $table->index('created_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_audit_logs');
    }
};
