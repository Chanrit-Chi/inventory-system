<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\StoreProductRequest;
use App\Http\Requests\Api\V1\UpdateProductRequest;
use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Models\VariantAttributeValue;
use App\Services\VariantGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends BaseApiController
{
    public function __construct(
        private readonly VariantGeneratorService $variantGenerator
    ) {}

    /**
     * GET /api/v1/products
     * Paginated product listing with optional filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['variants.attributeValues.attribute', 'category'])
            ->whereNull('deleted_at');

        if ($request->filled('search')) {
            $search = '%' . $request->string('search') . '%';
            $query->where(fn ($q) =>
                $q->where('name', 'like', $search)
                  ->orWhere('barcode', 'like', $search)
            );
        }

        if ($request->has('is_active')) {
            $isActiveVal = $request->input('is_active');
            if ($isActiveVal !== 'all' && $isActiveVal !== '' && $isActiveVal !== null) {
                $query->where('is_active', filter_var($isActiveVal, FILTER_VALIDATE_BOOLEAN));
            }
        } elseif (!$request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }

        $perPage = min((int) $request->input('per_page', 15), 200);
        $products = $query->latest()->paginate($perPage > 0 ? $perPage : 15);

        return $this->paginatedResponse($products);
    }

    /**
     * POST /api/v1/products
     * Create a product and optionally generate or persist variants.
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $fresh = DB::transaction(function () use ($validated) {
            $product = Product::create([
                'name'                 => $validated['name'],
                'barcode'              => $validated['barcode'] ?? null,
                'purchase_price'       => $validated['purchase_price'],
                'selling_price'        => $validated['selling_price'],
                'default_reorder_level'=> $validated['default_reorder_level'] ?? 5,
                'image_url'            => $validated['image_url'] ?? null,
                'is_active'            => $validated['is_active'] ?? true,
                'category_id'          => $validated['category_id'] ?? null,
                'description'          => $validated['description'] ?? null,
            ]);

            // 1. Explicit variants array provided from client
            if (!empty($validated['variants']) && is_array($validated['variants'])) {
                foreach ($validated['variants'] as $vData) {
                    $sku = !empty($vData['sku']) ? $vData['sku'] : ('SKU-' . strtoupper(Str::random(6)));
                    $baseSku = $sku;
                    $attempt = 0;
                    while (ProductVariant::where('sku', $sku)->withTrashed()->exists()) {
                        $attempt++;
                        $sku = $baseSku . '-' . $attempt;
                    }

                    $costP = isset($vData['cost_price']) ? (float)$vData['cost_price'] : (float)$product->purchase_price;
                    $sellP = isset($vData['selling_price']) ? (float)$vData['selling_price'] : (float)$product->selling_price;

                    $variant = ProductVariant::create([
                        'product_id'             => $product->id,
                        'name'                   => $vData['name'] ?? 'Standard',
                        'sku'                    => $sku,
                        'barcode'                => !empty($vData['barcode']) ? $vData['barcode'] : null,
                        'cost_price'             => $costP,
                        'selling_price'          => $sellP,
                        'cost_price_override'    => !empty($vData['cost_price_override']) ? (float)$vData['cost_price_override'] : null,
                        'selling_price_override' => !empty($vData['selling_price_override']) ? (float)$vData['selling_price_override'] : null,
                        'quantity_on_hand'       => (int) ($vData['quantity_on_hand'] ?? $vData['stock'] ?? 0),
                        'reorder_level'          => (int) ($vData['reorder_level'] ?? $product->default_reorder_level ?? 5),
                        'is_active'              => isset($vData['is_active']) ? (bool) $vData['is_active'] : true,
                    ]);

                    // Attach variant attribute values
                    if (!empty($vData['attribute_values']) && is_array($vData['attribute_values'])) {
                        foreach ($vData['attribute_values'] as $av) {
                            $attrValId = null;
                            if (is_array($av)) {
                                $attrValId = $av['id'] ?? $av['attribute_value_id'] ?? null;
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

                            if ($attrValId && AttributeValue::where('id', $attrValId)->exists()) {
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
                }
            } elseif (!empty($validated['attributes'])) {
                // 2. Generate variants from taxonomy matrix
                $this->variantGenerator->generate($product, $validated['attributes']);
            } else {
                // 3. Simple Product default single variant
                $initialStock = (int) ($validated['quantity_on_hand'] ?? $validated['stock'] ?? $validated['simple_stock'] ?? 0);
                $sku = !empty($validated['sku']) ? $validated['sku'] : ($product->name ? (Str::slug($product->name) . '-' . strtoupper(Str::random(4))) : ('SKU-' . strtoupper(Str::random(6))));
                $baseSku = $sku;
                $attempt = 0;
                while (ProductVariant::where('sku', $sku)->withTrashed()->exists()) {
                    $attempt++;
                    $sku = $baseSku . '-' . $attempt;
                }

                ProductVariant::create([
                    'product_id'        => $product->id,
                    'name'              => 'Standard',
                    'sku'               => $sku,
                    'barcode'           => $product->barcode,
                    'cost_price'        => $product->purchase_price,
                    'selling_price'     => $product->selling_price,
                    'quantity_on_hand'  => $initialStock,
                    'reorder_level'     => $product->default_reorder_level ?? 5,
                    'is_active'         => true,
                ]);
            }

            return $product->fresh(['variants.attributeValues.attribute', 'category']);
        });

        return $this->createdResponse([
            'product'  => $fresh,
            'variants' => $fresh->variants,
            ...$fresh->toArray(),
        ], 'Product created successfully.');
    }

    /**
     * GET /api/v1/products/{id}
     */
    public function show(string $id): JsonResponse
    {
        $product = Product::with(['variants.attributeValues.attribute', 'category'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        return $this->successResponse($product);
    }

    /**
     * PUT/PATCH /api/v1/products/{id}
     */
    public function update(UpdateProductRequest $request, string $id): JsonResponse
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        $validated = $request->validated();

        $fresh = DB::transaction(function () use ($product, $validated) {
            $productFields = Arr::only($validated, [
                'name',
                'sku',
                'barcode',
                'purchase_price',
                'selling_price',
                'default_reorder_level',
                'image_url',
                'is_active',
                'category_id',
                'description',
            ]);

            $product->update($productFields);

            // If product barcode/stock was updated and it has exactly 1 base variant (simple product)
            if (empty($validated['variants']) && $product->variants()->count() === 1) {
                $baseVar = $product->variants()->first();
                $baseUpdates = [];
                if (array_key_exists('barcode', $validated)) {
                    $baseUpdates['barcode'] = $validated['barcode'];
                }
                if (isset($validated['quantity_on_hand']) || isset($validated['stock']) || isset($validated['simple_stock'])) {
                    $baseUpdates['quantity_on_hand'] = (int) ($validated['quantity_on_hand'] ?? $validated['stock'] ?? $validated['simple_stock']);
                }
                if (isset($validated['purchase_price'])) {
                    $baseUpdates['cost_price'] = (float) $validated['purchase_price'];
                }
                if (isset($validated['selling_price'])) {
                    $baseUpdates['selling_price'] = (float) $validated['selling_price'];
                }
                if (array_key_exists('is_active', $validated)) {
                    $baseUpdates['is_active'] = (bool) $validated['is_active'];
                }
                if (!empty($baseUpdates)) {
                    $baseVar->update($baseUpdates);
                }
            }

            // If variant updates/creations were provided (variable product or multi-variant)
            if (!empty($validated['variants']) && is_array($validated['variants'])) {
                $hadSingleSimpleVariant = $product->variants()->count() === 1 && $product->variants()->first()->attributeValues()->count() === 0;
                $oldSimpleVariantId = $hadSingleSimpleVariant ? $product->variants()->first()->id : null;
                $processedVariantIds = [];

                foreach ($validated['variants'] as $varData) {
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
                            if (isset($varData['quantity_on_hand']) || isset($varData['stock'])) {
                                $variantUpdate['quantity_on_hand'] = (int) ($varData['quantity_on_hand'] ?? $varData['stock']);
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
                        // Create new variant for this product
                        $sku = !empty($varData['sku']) ? $varData['sku'] : ('SKU-' . strtoupper(Str::random(6)));
                        $baseSku = $sku;
                        $attempt = 0;
                        while (ProductVariant::where('sku', $sku)->withTrashed()->exists()) {
                            $attempt++;
                            $sku = $baseSku . '-' . $attempt;
                        }

                        $newVar = ProductVariant::create([
                            'product_id'             => $product->id,
                            'name'                   => $varData['name'] ?? 'Standard',
                            'sku'                    => $sku,
                            'barcode'                => !empty($varData['barcode']) ? $varData['barcode'] : null,
                            'cost_price'             => isset($varData['cost_price']) ? (float)$varData['cost_price'] : (float)$product->purchase_price,
                            'selling_price'          => isset($varData['selling_price']) ? (float)$varData['selling_price'] : (float)$product->selling_price,
                            'cost_price_override'    => !empty($varData['cost_price_override']) ? (float)$varData['cost_price_override'] : null,
                            'selling_price_override' => !empty($varData['selling_price_override']) ? (float)$varData['selling_price_override'] : null,
                            'quantity_on_hand'       => (int) ($varData['quantity_on_hand'] ?? $varData['stock'] ?? 0),
                            'reorder_level'          => (int) ($varData['reorder_level'] ?? $product->default_reorder_level ?? 5),
                            'is_active'              => isset($varData['is_active']) ? (bool) $varData['is_active'] : true,
                        ]);

                        $processedVariantIds[] = $newVar->id;

                        if (!empty($varData['attribute_values']) && is_array($varData['attribute_values'])) {
                            foreach ($varData['attribute_values'] as $av) {
                                $attrValId = null;
                                if (is_array($av)) {
                                    $attrValId = $av['id'] ?? $av['attribute_value_id'] ?? null;
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

                                if ($attrValId && AttributeValue::where('id', $attrValId)->exists()) {
                                    VariantAttributeValue::firstOrCreate([
                                        'variant_id'         => $newVar->id,
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
                    }
                }

                // If product transitioned from single simple product to variable product with new variants, clean up old simple placeholder variant
                if ($oldSimpleVariantId && !in_array($oldSimpleVariantId, $processedVariantIds) && count($processedVariantIds) > 0) {
                    $oldVar = ProductVariant::find($oldSimpleVariantId);
                    if ($oldVar) {
                        $oldVar->update([
                            'is_active'        => false,
                            'quantity_on_hand' => 0,
                        ]);
                        $oldVar->delete(); // Soft-deletes so historical OrderItems, Receipts & StockMovements remain 100% intact
                    }
                }
            }

            return $product->fresh(['variants.attributeValues.attribute', 'category']);
        });

        return $this->successResponse([
            'product'  => $fresh,
            'variants' => $fresh->variants,
            ...$fresh->toArray(),
        ], 'Product updated successfully.');
    }

    /**
     * DELETE /api/v1/products/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        $variantIds = $product->variants()->pluck('id')->toArray();
        $hasLinkedRecords = \App\Models\OrderItem::whereIn('variant_id', $variantIds)->orWhere('product_id', $product->id)->exists()
            || \App\Models\StockMovement::whereIn('variant_id', $variantIds)->orWhere('product_id', $product->id)->exists()
            || \App\Models\RestockDetail::whereIn('variant_id', $variantIds)->orWhere('product_id', $product->id)->exists()
            || \App\Models\InvoiceItem::whereIn('variant_id', $variantIds)->orWhere('product_id', $product->id)->exists()
            || \App\Models\QuotationItem::whereIn('variant_id', $variantIds)->orWhere('product_id', $product->id)->exists();

        if ($hasLinkedRecords) {
            DB::transaction(function () use ($product) {
                $product->update(['is_active' => false]);
                $product->variants()->update(['is_active' => false]);
            });

            return $this->successResponse([
                'deactivated' => true,
                'product'     => $product->fresh(['variants.attributeValues.attribute', 'category']),
            ], 'Product has historical transaction records and has been deactivated instead of deleted.');
        }

        DB::transaction(function () use ($product) {
            $product->variants()->delete();
            $product->delete();
        });

        return $this->successResponse(null, 'Product deleted successfully.');
    }
}
