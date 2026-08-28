<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\RestockDetail;
use App\Models\RestockSession;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RestockControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $cashier;
    protected ProductVariant $variant1;
    protected ProductVariant $variant2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin_restock@pos.test',
            'password'  => \Illuminate\Support\Facades\Hash::make('password123'),
            'role'      => 'SUPER_ADMIN',
            'is_active' => true,
        ]);

        $this->cashier = User::create([
            'name'      => 'Cashier User',
            'email'     => 'cashier_restock@pos.test',
            'password'  => \Illuminate\Support\Facades\Hash::make('password123'),
            'role'      => 'CASHIER',
            'is_active' => true,
        ]);

        $category = ProductCategory::create([
            'name' => 'Beverages',
            'code' => 'BEV',
        ]);

        $product = Product::create([
            'name'        => 'Energy Drink',
            'sku'         => 'ENG-DRK',
            'category_id' => $category->id,
            'is_active'   => true,
        ]);

        $this->variant1 = ProductVariant::create([
            'product_id'       => $product->id,
            'name'             => 'Energy Drink 250ml',
            'sku'              => 'ENG-250',
            'barcode'          => '8850001112223',
            'cost_price'       => 1.00,
            'selling_price'    => 2.50,
            'quantity_on_hand' => 10,
            'is_active'        => true,
        ]);

        $this->variant2 = ProductVariant::create([
            'product_id'       => $product->id,
            'name'             => 'Energy Drink 500ml',
            'sku'              => 'ENG-500',
            'barcode'          => '8850001112224',
            'cost_price'       => 1.50,
            'selling_price'    => 3.50,
            'quantity_on_hand' => 5,
            'is_active'        => true,
        ]);
    }

    public function test_authenticated_admin_can_restock_single_variant(): void
    {
        $payload = [
            'notes' => 'Weekly warehouse shipment',
            'items' => [
                [
                    'variant_id'      => $this->variant1->id,
                    'quantity'        => 20,
                    'unit_cost'       => 0.95,
                    'scanned_barcode' => '8850001112223',
                ],
            ],
        ];

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/inventory/restock', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Restock session completed successfully.');

        $this->variant1->refresh();
        $this->assertEquals(30, $this->variant1->quantity_on_hand);

        $this->assertDatabaseHas('restock_sessions', [
            'status' => 'COMPLETED',
            'notes'  => 'Weekly warehouse shipment',
        ]);

        $session = RestockSession::latest()->first();

        $this->assertDatabaseHas('restock_details', [
            'restock_session_id' => $session->id,
            'variant_id'         => $this->variant1->id,
            'quantity'           => 20,
            'unit_cost'          => '0.95',
            'scanned_barcode'    => '8850001112223',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'variant_id'      => $this->variant1->id,
            'movement_type'   => 'RESTOCK',
            'quantity_change' => 20,
            'quantity_before' => 10,
            'quantity_after'  => 30,
            'reference_id'    => $session->id,
        ]);
    }

    public function test_multi_variant_restock_is_atomic(): void
    {
        $payload = [
            'notes' => 'Bulk restock session',
            'items' => [
                [
                    'variant_id' => $this->variant1->id,
                    'quantity'   => 15,
                    'unit_cost'  => 0.90,
                ],
                [
                    'variant_id' => $this->variant2->id,
                    'quantity'   => 25,
                    'unit_cost'  => 1.40,
                ],
            ],
        ];

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/inventory/restock', $payload);

        $response->assertStatus(201);

        $this->variant1->refresh();
        $this->variant2->refresh();

        $this->assertEquals(25, $this->variant1->quantity_on_hand);
        $this->assertEquals(30, $this->variant2->quantity_on_hand);
        $this->assertEquals(2, RestockDetail::count());
    }

    public function test_restock_validation_fails_on_empty_items_or_invalid_variant(): void
    {
        $emptyPayload = [
            'items' => [],
        ];

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/inventory/restock', $emptyPayload);

        $response->assertStatus(422);

        $invalidVariantPayload = [
            'items' => [
                [
                    'variant_id' => '00000000-0000-0000-0000-000000000000',
                    'quantity'   => 10,
                    'unit_cost'  => 1.00,
                ],
            ],
        ];

        $response2 = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/inventory/restock', $invalidVariantPayload);

        $response2->assertStatus(422);
    }
}
