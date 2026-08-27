<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StressSeederIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_idempotency_running_twice_without_error(): void
    {
        // Run first time
        $this->seed(DatabaseSeeder::class);

        // Run second time (must not violate unique constraints or throw duplicate key errors)
        $this->seed(DatabaseSeeder::class);

        $this->assertTrue(true);
    }
}
