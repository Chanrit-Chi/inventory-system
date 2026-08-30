<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FirstLoginPasswordTest extends TestCase
{
    use DatabaseMigrations;

    public function test_admin_can_create_user_with_auto_generated_password(): void
    {
        $admin = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@inventory.local',
            'password'  => Hash::make('AdminPass123!'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users', [
            'name'       => 'New Staff Member',
            'email'      => 'staff.auto@inventory.local',
            'role'       => 'SELLER',
            'department' => 'Front Counter',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'New Staff Member')
            ->assertJsonPath('data.email', 'staff.auto@inventory.local')
            ->assertJsonPath('data.must_change_password', true)
            ->assertJsonPath('data.mustChangePassword', true);

        $tempPassword = $response->json('data.temporary_password');
        $this->assertNotEmpty($tempPassword);
        $this->assertGreaterThanOrEqual(8, strlen($tempPassword));

        $createdUser = User::where('email', 'staff.auto@inventory.local')->first();
        $this->assertNotNull($createdUser);
        $this->assertTrue((bool) $createdUser->must_change_password);
        $this->assertTrue(Hash::check($tempPassword, $createdUser->password));
    }

    public function test_admin_can_create_user_with_provided_password(): void
    {
        $admin = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@inventory.local',
            'password'  => Hash::make('AdminPass123!'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users', [
            'name'       => 'Seller With Preset Pass',
            'email'      => 'seller.preset@inventory.local',
            'password'   => 'TempSecret123!',
            'role'       => 'SELLER',
            'department' => 'POS',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.temporary_password', 'TempSecret123!')
            ->assertJsonPath('data.must_change_password', true);

        $createdUser = User::where('email', 'seller.preset@inventory.local')->first();
        $this->assertTrue((bool) $createdUser->must_change_password);
        $this->assertTrue(Hash::check('TempSecret123!', $createdUser->password));
    }

    public function test_first_login_flow_and_mandatory_password_change(): void
    {
        $admin = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@inventory.local',
            'password'  => Hash::make('AdminPass123!'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        // 1. Admin creates user
        $createRes = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users', [
            'name'  => 'First Login User',
            'email' => 'firstlogin@inventory.local',
            'role'  => 'SELLER',
        ]);
        $createRes->assertStatus(201);
        $tempPassword = $createRes->json('data.temporary_password');

        // Clear test auth guard state
        auth()->forgetGuards();

        // 2. User logs in with temporary password
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'firstlogin@inventory.local',
            'password' => $tempPassword,
        ]);

        $loginRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.must_change_password', true)
            ->assertJsonPath('data.user.mustChangePassword', true);

        $token = $loginRes->json('data.token');
        $this->assertNotEmpty($token);

        // 3. User checks auth/me
        $meRes = $this->withToken($token)->getJson('/api/v1/auth/me');
        $meRes->assertStatus(200)
            ->assertJsonPath('data.must_change_password', true);

        // 4. User changes password
        $changePassRes = $this->withToken($token)->patchJson('/api/v1/auth/password', [
            'current_password' => $tempPassword,
            'new_password'     => 'BrandNewPassword2026!',
        ]);

        $changePassRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.must_change_password', false)
            ->assertJsonPath('data.mustChangePassword', false);

        // 5. Check auth/me again
        $meResAfter = $this->withToken($token)->getJson('/api/v1/auth/me');
        $meResAfter->assertStatus(200)
            ->assertJsonPath('data.must_change_password', false);

        // Clear auth guards
        auth()->forgetGuards();

        // 6. User logs in again with new password
        $secondLoginRes = $this->postJson('/api/v1/auth/login', [
            'email'    => 'firstlogin@inventory.local',
            'password' => 'BrandNewPassword2026!',
        ]);

        $secondLoginRes->assertStatus(200)
            ->assertJsonPath('data.user.must_change_password', false)
            ->assertJsonPath('data.user.mustChangePassword', false);
    }
}
