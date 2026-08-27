<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MediaUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_upload_image(): void
    {
        Storage::fake('public');

        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $file = UploadedFile::fake()->image('product_photo.jpg', 600, 600);

        $response = $this->postJson('/api/v1/media/upload', [
            'image' => $file,
            'folder' => 'products',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'url',
                    'path',
                    'disk',
                    'filename',
                ],
            ]);

        $path = $response->json('data.path');
        Storage::disk('public')->assertExists($path);
    }

    public function test_rejects_non_image_files(): void
    {
        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $file = UploadedFile::fake()->create('document.pdf', 500, 'application/pdf');

        $response = $this->postJson('/api/v1/media/upload', [
            'image' => $file,
        ]);

        $response->assertStatus(422);
    }
}
