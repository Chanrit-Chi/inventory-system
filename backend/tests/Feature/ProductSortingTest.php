<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProductSortingTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        if (!\Illuminate\Support\Facades\Schema::hasTable('personal_access_tokens')) {
            $this->artisan('migrate', ['--path' => 'vendor/laravel/sanctum/database/migrations']);
        }

        $this->admin = User::create([
            'name'             => 'Admin User',
            'email'            => 'admin@inventory.local',
            'password'         => Hash::make('Secret123!'),
            'role'             => 'ADMIN',
            'is_active'        => true,
            'permission_group' => 'Admin',
        ]);
    }

    public function test_products_can_be_sorted_by_name(): void
    {
        Product::create([
            'name' => 'Bravo Product',
            'purchase_price' => 10.00,
            'selling_price' => 20.00,
            'is_active' => true,
        ]);
        Product::create([
            'name' => 'Alpha Product',
            'purchase_price' => 15.00,
            'selling_price' => 30.00,
            'is_active' => true,
        ]);

        $resAsc = $this->actingAs($this->admin)->getJson('/api/v1/products?sort_by=name&sort_direction=asc');
        $resAsc->assertOk();
        $namesAsc = collect($resAsc->json('data'))->pluck('name')->all();
        $this->assertSame(['Alpha Product', 'Bravo Product'], $namesAsc);

        $resDesc = $this->actingAs($this->admin)->getJson('/api/v1/products?sort_by=name&sort_direction=desc');
        $resDesc->assertOk();
        $namesDesc = collect($resDesc->json('data'))->pluck('name')->all();
        $this->assertSame(['Bravo Product', 'Alpha Product'], $namesDesc);
    }

    public function test_products_can_be_sorted_by_selling_price(): void
    {
        Product::create([
            'name' => 'Cheap Product',
            'purchase_price' => 5.00,
            'selling_price' => 10.00,
            'is_active' => true,
        ]);
        Product::create([
            'name' => 'Expensive Product',
            'purchase_price' => 50.00,
            'selling_price' => 100.00,
            'is_active' => true,
        ]);

        $resAsc = $this->actingAs($this->admin)->getJson('/api/v1/products?sort_by=selling_price&sort_direction=asc');
        $resAsc->assertOk();
        $namesAsc = collect($resAsc->json('data'))->pluck('name')->all();
        $this->assertSame(['Cheap Product', 'Expensive Product'], $namesAsc);

        $resDesc = $this->actingAs($this->admin)->getJson('/api/v1/products?sort_by=selling_price&sort_direction=desc');
        $resDesc->assertOk();
        $namesDesc = collect($resDesc->json('data'))->pluck('name')->all();
        $this->assertSame(['Expensive Product', 'Cheap Product'], $namesDesc);
    }

    public function test_products_can_be_sorted_by_total_stock(): void
    {
        $p1 = Product::create([
            'name' => 'Low Stock Product',
            'purchase_price' => 10.00,
            'selling_price' => 20.00,
            'is_active' => true,
        ]);
        ProductVariant::create([
            'product_id' => $p1->id,
            'sku' => 'SKU-LOW-1',
            'quantity_on_hand' => 5,
            'cost_price' => 10.00,
            'selling_price' => 20.00,
            'reorder_level' => 2,
            'is_active' => true,
        ]);

        $p2 = Product::create([
            'name' => 'High Stock Product',
            'purchase_price' => 10.00,
            'selling_price' => 20.00,
            'is_active' => true,
        ]);
        ProductVariant::create([
            'product_id' => $p2->id,
            'sku' => 'SKU-HIGH-1',
            'quantity_on_hand' => 50,
            'cost_price' => 10.00,
            'selling_price' => 20.00,
            'reorder_level' => 2,
            'is_active' => true,
        ]);
        ProductVariant::create([
            'product_id' => $p2->id,
            'sku' => 'SKU-HIGH-2',
            'quantity_on_hand' => 30,
            'cost_price' => 10.00,
            'selling_price' => 20.00,
            'reorder_level' => 2,
            'is_active' => true,
        ]);

        $resAsc = $this->actingAs($this->admin)->getJson('/api/v1/products?sort_by=stock&sort_direction=asc');
        $resAsc->assertOk();
        $namesAsc = collect($resAsc->json('data'))->pluck('name')->all();
        $this->assertSame(['Low Stock Product', 'High Stock Product'], $namesAsc);

        $resDesc = $this->actingAs($this->admin)->getJson('/api/v1/products?sort_by=stock&sort_direction=desc');
        $resDesc->assertOk();
        $namesDesc = collect($resDesc->json('data'))->pluck('name')->all();
        $this->assertSame(['High Stock Product', 'Low Stock Product'], $namesDesc);
    }
}
