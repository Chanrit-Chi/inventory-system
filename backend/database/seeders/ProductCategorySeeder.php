<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use Illuminate\Database\Seeder;

class ProductCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Apparel & Fashion',
                'code' => 'CAT-APPAREL',
                'description' => "Men's and women's clothing, tops, and bottoms",
            ],
            [
                'name' => 'Footwear & Shoes',
                'code' => 'CAT-FOOTWEAR',
                'description' => 'Sneakers, formal shoes, and sandals',
            ],
            [
                'name' => 'Bags & Accessories',
                'code' => 'CAT-ACCESSORIES',
                'description' => 'Bags, backpacks, belts, and headwear',
            ],
            [
                'name' => 'Electronics & Audio',
                'code' => 'CAT-ELECTRONICS',
                'description' => 'Audio gear, wireless earbuds, and smart accessories',
            ],
        ];

        foreach ($categories as $cat) {
            ProductCategory::firstOrCreate(
                ['code' => $cat['code']],
                $cat
            );
        }
    }
}
