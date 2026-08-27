<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StressApiEnvelopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_health_endpoint_response_structure(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_404_error_envelope_structure(): void
    {
        $response = $this->getJson('/api/v1/non-existent-route-for-testing');

        $response->assertStatus(404)
            ->assertJsonStructure([
                'success',
                'message',
                'errors',
            ])
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_405_error_envelope_structure(): void
    {
        $response = $this->deleteJson('/api/v1/health');

        $response->assertStatus(405)
            ->assertJsonStructure([
                'success',
                'message',
                'errors',
            ])
            ->assertJson([
                'success' => false,
                'message' => 'Method not allowed.',
            ]);
    }
}
