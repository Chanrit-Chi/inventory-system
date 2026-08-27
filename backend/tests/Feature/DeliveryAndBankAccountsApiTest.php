<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\DeliveryCompany;
use App\Models\DeliveryZone;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeliveryAndBankAccountsApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $cashierUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@inventory.local',
            'password'  => 'secret123',
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $this->cashierUser = User::create([
            'name'      => 'Cashier User',
            'email'     => 'cashier@inventory.local',
            'password'  => 'secret123',
            'role'      => 'cashier',
            'is_active' => true,
        ]);
    }

    public function test_delivery_company_lifecycle(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create Delivery Company
        $createRes = $this->postJson('/api/v1/delivery-companies', [
            'name'       => 'J&T Express',
            'phone'      => '+85512345678',
            'logo_icon'  => 'car',
            'color'      => '#DC2626',
            'is_default' => true,
            'notes'      => 'Express delivery nationwide',
        ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'name'       => 'J&T Express',
                    'is_default' => true,
                ],
            ]);

        $companyId = $createRes->json('data.id');
        $this->assertNotNull($companyId);

        // 2. Cashier can list delivery companies
        Sanctum::actingAs($this->cashierUser);
        $listRes = $this->getJson('/api/v1/delivery-companies');
        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    ['name' => 'J&T Express'],
                ],
            ]);

        // 3. Admin can update
        Sanctum::actingAs($this->adminUser);
        $updateRes = $this->putJson("/api/v1/delivery-companies/{$companyId}", [
            'name'  => 'J&T Express Cambodia',
            'phone' => '+85599887766',
        ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'name'  => 'J&T Express Cambodia',
                    'phone' => '+85599887766',
                ],
            ]);

        // 4. Admin can delete
        $delRes = $this->deleteJson("/api/v1/delivery-companies/{$companyId}");
        $delRes->assertStatus(200);

        $this->assertSoftDeleted('delivery_companies', ['id' => $companyId]);
    }

    public function test_delivery_zone_lifecycle(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create Delivery Zone
        $createRes = $this->postJson('/api/v1/delivery-zones', [
            'name'       => 'Phnom Penh Urban',
            'cost'       => 1.50,
            'is_default' => true,
        ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'name'       => 'Phnom Penh Urban',
                    'cost'       => '1.50',
                    'is_default' => true,
                ],
            ]);

        $zoneId = $createRes->json('data.id');

        // 2. Cashier can list zones
        Sanctum::actingAs($this->cashierUser);
        $listRes = $this->getJson('/api/v1/delivery-zones');
        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    ['name' => 'Phnom Penh Urban'],
                ],
            ]);

        // 3. Admin can update
        Sanctum::actingAs($this->adminUser);
        $updateRes = $this->putJson("/api/v1/delivery-zones/{$zoneId}", [
            'cost' => 2.00,
        ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'cost' => '2.00',
                ],
            ]);

        // 4. Admin can delete
        $delRes = $this->deleteJson("/api/v1/delivery-zones/{$zoneId}");
        $delRes->assertStatus(200);

        $this->assertSoftDeleted('delivery_zones', ['id' => $zoneId]);
    }

    public function test_bank_account_lifecycle(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create Bank Account
        $createRes = $this->postJson('/api/v1/bank-accounts', [
            'bank_name'      => 'ABA Bank',
            'account_name'   => 'John Doe',
            'account_number' => '000 123 456',
            'currency'       => 'USD',
            'qr_image_url'   => 'https://example.com/qr.png',
            'is_default'     => true,
        ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'bank_name'      => 'ABA Bank',
                    'account_name'   => 'JOHN DOE',
                    'account_number' => '000 123 456',
                    'currency'       => 'USD',
                    'is_default'     => true,
                ],
            ]);

        $bankId = $createRes->json('data.id');

        // 2. Cashier can list bank accounts
        Sanctum::actingAs($this->cashierUser);
        $listRes = $this->getJson('/api/v1/bank-accounts');
        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    ['bank_name' => 'ABA Bank'],
                ],
            ]);

        // 3. Admin can update
        Sanctum::actingAs($this->adminUser);
        $updateRes = $this->putJson("/api/v1/bank-accounts/{$bankId}", [
            'account_name' => 'John Doe Updated',
        ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'account_name' => 'JOHN DOE UPDATED',
                ],
            ]);

        // 4. Admin can delete
        $delRes = $this->deleteJson("/api/v1/bank-accounts/{$bankId}");
        $delRes->assertStatus(200);

        $this->assertSoftDeleted('bank_accounts', ['id' => $bankId]);
    }

    public function test_sales_channel_default_lifecycle(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Create channel with default
        $res1 = $this->postJson('/api/v1/sales-channels', [
            'name'       => 'Telegram Store',
            'code'       => 'TG-MAIN',
            'type'       => 'social_media',
            'is_default' => true,
        ]);

        $res1->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'name'       => 'Telegram Store',
                    'is_default' => true,
                ],
            ]);

        $ch1Id = $res1->json('data.id');

        // 2. Create second channel with default - should clear first
        $res2 = $this->postJson('/api/v1/sales-channels', [
            'name'       => 'Facebook Store',
            'code'       => 'FB-MAIN',
            'type'       => 'social_media',
            'is_default' => true,
        ]);

        $res2->assertStatus(201);
        $ch2Id = $res2->json('data.id');

        $this->assertDatabaseHas('sales_channels', ['id' => $ch2Id, 'is_default' => true]);
        $this->assertDatabaseHas('sales_channels', ['id' => $ch1Id, 'is_default' => false]);

        // 3. Update first channel back to default
        $updateRes = $this->putJson("/api/v1/sales-channels/{$ch1Id}", [
            'is_default' => true,
        ]);

        $updateRes->assertStatus(200);
        $this->assertDatabaseHas('sales_channels', ['id' => $ch1Id, 'is_default' => true]);
        $this->assertDatabaseHas('sales_channels', ['id' => $ch2Id, 'is_default' => false]);

        // 4. Delete channel without orders
        $delRes = $this->deleteJson("/api/v1/sales-channels/{$ch2Id}");
        $delRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Sales channel deleted successfully.',
            ]);
        $this->assertDatabaseMissing('sales_channels', ['id' => $ch2Id]);
    }
}

