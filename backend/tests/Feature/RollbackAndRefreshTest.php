<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RollbackAndRefreshTest extends TestCase
{
    public function test_migrations_rollback_and_refresh_cleanly(): void
    {
        // 1. Ensure migrations are in place
        Artisan::call('migrate');

        // 2. Rollback all migrations
        $rollbackExitCode = Artisan::call('migrate:reset');
        $this->assertEquals(0, $rollbackExitCode, 'migrate:reset failed with non-zero exit code');

        // Verify tables are dropped
        $this->assertFalse(Schema::hasTable('orders'));
        $this->assertFalse(Schema::hasTable('products'));

        // 3. Re-run migrations fresh with seed
        $migrateExitCode = Artisan::call('migrate:fresh', [
            '--seed' => true,
        ]);
        $this->assertEquals(0, $migrateExitCode, 'migrate:fresh --seed failed with non-zero exit code');

        // Verify tables exist again
        $this->assertTrue(Schema::hasTable('orders'));
        $this->assertTrue(Schema::hasTable('products'));
        $this->assertTrue(Schema::hasTable('product_variants'));

        // 4. Verify rollback on seeded database without CHECK constraint failure
        $seededRollbackExitCode = Artisan::call('migrate:rollback', [
            '--step' => 1,
        ]);
        $this->assertEquals(0, $seededRollbackExitCode, 'migrate:rollback --step=1 on seeded DB failed');

        // 5. Restore migrations
        $remigrateExitCode = Artisan::call('migrate');
        $this->assertEquals(0, $remigrateExitCode, 'migrate after rollback failed');
    }
}
