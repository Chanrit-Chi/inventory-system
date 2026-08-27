<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StoreBrandingTaxTest extends TestCase
{
    use DatabaseMigrations;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(
            ['slug' => 'super_admin'],
            ['name' => 'Super Admin', 'description' => 'System Super Admin']
        );

        $this->admin = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@test.com',
            'password'  => Hash::make('Password123!'),
            'role_id'   => $adminRole->id,
            'is_active' => true,
        ]);
    }

    public function test_get_branding_returns_show_tax_field(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/v1/settings/branding');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'show_tax' => false,
                ],
            ]);
    }

    public function test_update_branding_can_toggle_show_tax(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Enable show_tax
        $updateResponse = $this->postJson('/api/v1/settings/branding', [
            'store_name' => 'KC Shop',
            'show_tax'   => true,
        ]);

        $updateResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'store_name' => 'KC Shop',
                    'show_tax'   => true,
                ],
            ]);

        // Verify retrieval returns updated show_tax
        $getRes = $this->getJson('/api/v1/settings/branding');

        $getRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'show_tax' => true,
                ],
            ]);

        // 2. Disable show_tax
        $disableRes = $this->postJson('/api/v1/settings/branding', [
            'show_tax' => false,
        ]);

        $disableRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'show_tax' => false,
                ],
            ]);
    }
}
