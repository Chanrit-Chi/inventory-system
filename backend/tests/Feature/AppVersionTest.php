<?php

namespace Tests\Feature;

use Tests\TestCase;

class AppVersionTest extends TestCase
{
    public function test_can_check_app_version_without_authentication(): void
    {
        $response = $this->getJson('/api/v1/app/version?platform=android&version=1.0.0');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'platform',
                    'client_version',
                    'latest_version',
                    'latest_version_code',
                    'min_supported_version',
                    'update_available',
                    'update_required',
                    'apk_url',
                    'changelog',
                    'checked_at',
                ],
                'message',
            ]);

        $this->assertTrue($response->json('success'));
        $this->assertSame('android', $response->json('data.platform'));
        $this->assertSame('1.0.0', $response->json('data.client_version'));
    }

    public function test_detects_when_update_is_available(): void
    {
        config(['app.mobile_latest_version' => '2.0.0']);

        $response = $this->getJson('/api/v1/app/version?platform=android&version=1.0.0');

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.update_available'));
    }
}
