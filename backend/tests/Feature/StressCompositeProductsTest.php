<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StressCompositeProductsTest extends TestCase
{
    use RefreshDatabase;

    public function test_composite_product_flag_and_variants(): void
    {
        $cat = ProductCategory::create([
            'name' => 'Gift Bundles',
            'code' => 'CAT-BUNDLE',
        ]);

        $product = Product::create([
            'category_id' => $cat->id,
            'name' => 'Summer Outfit Bundle',
            'sku' => 'BUNDLE-SUMMER-01',
            'cost_price' => 20.00,
            'selling_price' => 45.00,
            'is_composite' => true,
        ]);

        $this->assertTrue($product->is_composite);
        $this->assertTrue(Product::composite()->exists());
    }
}
