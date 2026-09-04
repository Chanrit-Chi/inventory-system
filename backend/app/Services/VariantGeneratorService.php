<?php

namespace App\Services;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\VariantAttributeValue;
use Illuminate\Support\Str;

class VariantGeneratorService
{
    /**
     * Resolve initial stock quantity from various input field names.
     * Supports: quantity_on_hand, stock, initial_stock, simple_stock
     */
    public function resolveInitialStock(array $data, ?string $fallbackField = null): int
    {
        $fields = ['quantity_on_hand', 'stock', 'initial_stock'];
        if ($fallbackField) {
            array_unshift($fields, $fallbackField);
        }
        foreach ($fields as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                return (int) $data[$field];
            }
        }
        return 0;
    }

    /**
     * Generate a collision-free SKU based on an input base or product name.
     */
    public function generateUniqueSku(string $baseSku): string
    {
        $sku = !empty($baseSku) ? $baseSku : ('SKU-' . strtoupper(Str::random(6)));
        $cleanBase = $sku;
        $attempt = 0;
        while (ProductVariant::where('sku', $sku)->withTrashed()->exists()) {
            $attempt++;
            $sku = $cleanBase . '-' . $attempt;
        }
        return $sku;
    }

    /**
     * Create a default single variant for a simple product.
     */
    public function createSimpleVariant(Product $product, array $validated): ProductVariant
    {
        $initialStock = $this->resolveInitialStock($validated, 'simple_stock');
        $rawSku = !empty($validated['sku'])
            ? $validated['sku']
            : ($product->name ? (Str::slug($product->name) . '-' . strtoupper(Str::random(4))) : ('SKU-' . strtoupper(Str::random(6))));

        $sku = $this->generateUniqueSku($rawSku);

        return ProductVariant::create([
            'product_id'        => $product->id,
            'name'              => 'Standard',
            'sku'               => $sku,
            'barcode'           => $product->barcode,
            'cost_price'        => $product->purchase_price ?? $product->cost_price,
            'selling_price'     => $product->selling_price,
            'quantity_on_hand'  => $initialStock,
            'reorder_level'     => $product->default_reorder_level ?? 5,
            'is_active'         => true,
        ]);
    }

    /**
     * Create explicit variant models from client payload with attribute mapping.
     *
     * @param  Product  $product
     * @param  array<int, array>  $variants
     * @return array<int, ProductVariant>
     */
    public function createExplicitVariants(Product $product, array $variants): array
    {
        $created = [];

        foreach ($variants as $vData) {
            $sku = $this->generateUniqueSku(!empty($vData['sku']) ? $vData['sku'] : ('SKU-' . strtoupper(Str::random(6))));
            $costP = isset($vData['cost_price']) ? (float) $vData['cost_price'] : (float) ($product->purchase_price ?? $product->cost_price);
            $sellP = isset($vData['selling_price']) ? (float) $vData['selling_price'] : (float) $product->selling_price;

            $variant = ProductVariant::create([
                'product_id'             => $product->id,
                'name'                   => $vData['name'] ?? 'Standard',
                'sku'                    => $sku,
                'barcode'                => !empty($vData['barcode']) ? $vData['barcode'] : null,
                'cost_price'             => $costP,
                'selling_price'          => $sellP,
                'cost_price_override'    => !empty($vData['cost_price_override']) ? (float) $vData['cost_price_override'] : null,
                'selling_price_override' => !empty($vData['selling_price_override']) ? (float) $vData['selling_price_override'] : null,
                'quantity_on_hand'       => $this->resolveInitialStock($vData),
                'reorder_level'          => (int) ($vData['reorder_level'] ?? $product->default_reorder_level ?? 5),
                'is_active'              => isset($vData['is_active']) ? (bool) $vData['is_active'] : true,
            ]);

            $this->attachAttributeValuesToVariant($product, $variant, $vData['attribute_values'] ?? []);

            $created[] = $variant;
        }

        return $created;
    }

    /**
     * Attach attribute values to variant and product pivots.
     */
    public function attachAttributeValuesToVariant(Product $product, ProductVariant $variant, array $attributeValues): void
    {
        if (empty($attributeValues)) {
            return;
        }

        foreach ($attributeValues as $av) {
            $attrValId = null;
            if (is_array($av)) {
                $rawId = $av['id'] ?? $av['attribute_value_id'] ?? null;
                $attrValId = ($rawId && Str::isUuid((string) $rawId)) ? (string) $rawId : null;
                $attrName = $av['attribute']['name'] ?? $av['attribute_name'] ?? null;
                $valName = $av['value_name'] ?? $av['value'] ?? null;

                if (!$attrValId && $attrName && $valName) {
                    $attribute = Attribute::firstOrCreate(
                        ['name' => $attrName],
                        ['code' => strtoupper(Str::slug($attrName, '_'))]
                    );
                    $attrVal = AttributeValue::firstOrCreate(
                        ['attribute_id' => $attribute->id, 'value_name' => $valName]
                    );
                    $attrValId = $attrVal->id;
                }
            } elseif (is_string($av) && Str::isUuid($av)) {
                $attrValId = $av;
            }

            if ($attrValId && Str::isUuid($attrValId) && AttributeValue::where('id', $attrValId)->exists()) {
                VariantAttributeValue::firstOrCreate([
                    'variant_id'         => $variant->id,
                    'attribute_value_id' => $attrValId,
                ]);
                $valModel = AttributeValue::find($attrValId);
                if ($valModel) {
                    ProductAttribute::firstOrCreate([
                        'product_id'   => $product->id,
                        'attribute_id' => $valModel->attribute_id,
                    ]);
                }
            }
        }
    }

    /**
     * Generate all variant combinations for a product from taxonomy matrix.
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
            $attrId = $attributeEntry['attribute_id'] ?? null;
            if ($attrId && Str::isUuid((string) $attrId)) {
                ProductAttribute::firstOrCreate([
                    'product_id'   => $product->id,
                    'attribute_id' => $attrId,
                ]);
            }
        }

        // Build value groups per attribute
        $valueGroups = [];
        foreach ($attributes as $attributeEntry) {
            $attrId = $attributeEntry['attribute_id'] ?? null;
            $rawValIds = $attributeEntry['value_ids'] ?? [];
            $valIds = array_values(array_filter($rawValIds, fn ($id) => Str::isUuid((string) $id)));

            if (empty($valIds) || !$attrId || !Str::isUuid((string) $attrId)) {
                continue;
            }

            $values = AttributeValue::whereIn('id', $valIds)
                ->where('attribute_id', $attrId)
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
            $slugParts = [Str::slug($product->name)];
            foreach ($combination as $attributeValue) {
                $slugParts[] = Str::slug($attributeValue->value_name);
            }
            $baseSku = implode('-', $slugParts);
            $sku = $this->generateUniqueSku($baseSku);

            /** @var ProductVariant $variant */
            $variant = ProductVariant::create([
                'product_id'     => $product->id,
                'sku'            => $sku,
                'cost_price'     => $product->purchase_price ?? $product->cost_price,
                'selling_price'  => $product->selling_price,
                'reorder_level'  => $product->default_reorder_level ?? 5,
                'is_active'      => true,
            ]);

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
     * Sync and update product variants during product update.
     */
    public function syncVariantsForUpdate(Product $product, array $variantsData, array $validated): array
    {
        $hadSingleSimpleVariant = $product->variants()->count() === 1 && $product->variants()->first()->attributeValues()->count() === 0;
        $oldSimpleVariantId = $hadSingleSimpleVariant ? $product->variants()->first()->id : null;
        $processedVariantIds = [];

        foreach ($variantsData as $varData) {
            if (!empty($varData['id']) && Str::isUuid($varData['id'])) {
                $variant = ProductVariant::where('product_id', $product->id)->find($varData['id']);
                if ($variant) {
                    $processedVariantIds[] = $variant->id;
                    $variantUpdate = [];
                    if (array_key_exists('barcode', $varData)) {
                        $variantUpdate['barcode'] = $varData['barcode'];
                    }
                    if (array_key_exists('sku', $varData) && !empty($varData['sku'])) {
                        $variantUpdate['sku'] = $varData['sku'];
                    }
                    if (array_key_exists('name', $varData) && !empty($varData['name'])) {
                        $variantUpdate['name'] = $varData['name'];
                    }
                    $stock = $this->resolveInitialStock($varData);
                    if ($stock > 0 || array_key_exists('quantity_on_hand', $varData) || array_key_exists('stock', $varData) || array_key_exists('initial_stock', $varData)) {
                        $variantUpdate['quantity_on_hand'] = $stock;
                    }
                    if (isset($varData['selling_price'])) {
                        $variantUpdate['selling_price'] = (float) $varData['selling_price'];
                    }
                    if (isset($varData['cost_price'])) {
                        $variantUpdate['cost_price'] = (float) $varData['cost_price'];
                    }
                    if (isset($varData['selling_price_override'])) {
                        $variantUpdate['selling_price_override'] = !empty($varData['selling_price_override']) ? (float)$varData['selling_price_override'] : null;
                    }
                    if (isset($varData['cost_price_override'])) {
                        $variantUpdate['cost_price_override'] = !empty($varData['cost_price_override']) ? (float)$varData['cost_price_override'] : null;
                    }
                    if (isset($varData['reorder_level'])) {
                        $variantUpdate['reorder_level'] = (int) $varData['reorder_level'];
                    }
                    if (array_key_exists('is_active', $varData)) {
                        $variantUpdate['is_active'] = (bool) $varData['is_active'];
                    }
                    if (!empty($variantUpdate)) {
                        $variant->update($variantUpdate);
                    }
                }
            } else {
                $sku = $this->generateUniqueSku(!empty($varData['sku']) ? $varData['sku'] : ('SKU-' . strtoupper(Str::random(6))));

                $newVar = ProductVariant::create([
                    'product_id'             => $product->id,
                    'name'                   => $varData['name'] ?? 'Standard',
                    'sku'                    => $sku,
                    'barcode'                => !empty($varData['barcode']) ? $varData['barcode'] : null,
                    'cost_price'             => isset($varData['cost_price']) ? (float)$varData['cost_price'] : (float)($product->purchase_price ?? $product->cost_price),
                    'selling_price'          => isset($varData['selling_price']) ? (float)$varData['selling_price'] : (float)$product->selling_price,
                    'cost_price_override'    => !empty($varData['cost_price_override']) ? (float)$varData['cost_price_override'] : null,
                    'selling_price_override' => !empty($varData['selling_price_override']) ? (float)$varData['selling_price_override'] : null,
                    'quantity_on_hand'       => $this->resolveInitialStock($varData),
                    'reorder_level'          => (int) ($varData['reorder_level'] ?? $product->default_reorder_level ?? 5),
                    'is_active'              => isset($varData['is_active']) ? (bool) $varData['is_active'] : true,
                ]);

                $processedVariantIds[] = $newVar->id;

                $this->attachAttributeValuesToVariant($product, $newVar, $varData['attribute_values'] ?? []);
            }
        }

        // If product was upgraded from Simple to Variable, delete or deactivate old placeholder variant
        if ($oldSimpleVariantId && count($processedVariantIds) > 0 && !in_array($oldSimpleVariantId, $processedVariantIds)) {
            $oldVar = ProductVariant::find($oldSimpleVariantId);
            if ($oldVar) {
                if ($oldVar->stockMovements()->count() === 0 && $oldVar->orderItems()->count() === 0) {
                    $oldVar->forceDelete();
                } else {
                    $oldVar->delete();
                }
            }
        }

        return $processedVariantIds;
    }

    /**
     * Compute the Cartesian product of multiple arrays.
     *
     * @param  array<int, array>  $input
     * @return array<int, array>
     */
    private function cartesian(array $input): array
    {
        $result = [[]];

        foreach ($input as $values) {
            $append = [];
            foreach ($result as $product) {
                foreach ($values as $item) {
                    $append[] = array_merge($product, [$item]);
                }
            }
            $result = $append;
        }

        return $result;
    }
}
