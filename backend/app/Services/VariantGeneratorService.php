<?php

namespace App\Services;

use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\VariantAttributeValue;
use Illuminate\Support\Str;

class VariantGeneratorService
{
    /**
     * Generate all variant combinations for a product.
     *
     * @param  Product  $product
     * @param  array<int, array{attribute_id: string, value_ids: array<string>}>  $attributes
     * @return array<int, ProductVariant>
     */
    public function generate(Product $product, array $attributes): array
    {
        if (empty($attributes)) {
            return [];
        }

        // Attach attribute pivot records
        foreach ($attributes as $attributeEntry) {
            ProductAttribute::firstOrCreate([
                'product_id'   => $product->id,
                'attribute_id' => $attributeEntry['attribute_id'],
            ]);
        }

        // Build value groups per attribute (each group = array of AttributeValue models)
        $valueGroups = [];
        foreach ($attributes as $attributeEntry) {
            $values = AttributeValue::whereIn('id', $attributeEntry['value_ids'])
                ->where('attribute_id', $attributeEntry['attribute_id'])
                ->get();

            if ($values->isEmpty()) {
                continue;
            }

            $valueGroups[] = $values->all();
        }

        if (empty($valueGroups)) {
            return [];
        }

        // Compute Cartesian product
        $combinations = $this->cartesian($valueGroups);

        $created = [];

        foreach ($combinations as $combination) {
            // Build deterministic SKU slug
            $slugParts = [Str::slug($product->name)];
            foreach ($combination as $attributeValue) {
                $slugParts[] = Str::slug($attributeValue->value_name);
            }
            $sku = implode('-', $slugParts);

            // Ensure uniqueness by appending short random suffix if collision
            $baseSku = $sku;
            $attempt = 0;
            while (ProductVariant::where('sku', $sku)->withTrashed()->exists()) {
                $attempt++;
                $sku = $baseSku . '-' . $attempt;
            }

            /** @var ProductVariant $variant */
            $variant = ProductVariant::create([
                'product_id'     => $product->id,
                'sku'            => $sku,
                'cost_price'     => $product->purchase_price ?? $product->cost_price,
                'selling_price'  => $product->selling_price,
                'reorder_level'  => $product->default_reorder_level ?? 5,
                'is_active'      => true,
            ]);

            // Attach junction records
            foreach ($combination as $attributeValue) {
                VariantAttributeValue::create([
                    'variant_id'         => $variant->id,
                    'attribute_value_id' => $attributeValue->id,
                ]);
            }

            $created[] = $variant->load('attributeValues.attribute');
        }

        return $created;
    }

    /**
     * Compute the Cartesian product of multiple arrays.
     *
     * @param  array<int, array<int, AttributeValue>>  $sets
     * @return array<int, array<int, AttributeValue>>
     */
    private function cartesian(array $sets): array
    {
        $result = [[]];

        foreach ($sets as $set) {
            $append = [];
            foreach ($result as $combination) {
                foreach ($set as $item) {
                    $append[] = array_merge($combination, [$item]);
                }
            }
            $result = $append;
        }

        return $result;
    }
}
