<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\StoreProductRequest;
use App\Http\Requests\Api\V1\UpdateProductRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\VariantGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

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
        $query = Product::forListing();

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
                $this->variantGenerator->createExplicitVariants($product, $validated['variants']);
            } elseif (!empty($validated['attributes'])) {
                // 2. Generate variants from taxonomy matrix
                $this->variantGenerator->generate($product, $validated['attributes']);
            } else {
                // 3. Simple Product default single variant
                $this->variantGenerator->createSimpleVariant($product, $validated);
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
        $product = Product::forDetail()->findOrFail($id);

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
                    $baseUpdates['quantity_on_hand'] = $this->variantGenerator->resolveInitialStock($validated, 'simple_stock');
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
                $this->variantGenerator->syncVariantsForUpdate($product, $validated['variants'], $validated);
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
     * Soft-deletes a product and its variants if unlinked, or deactivates them if transaction history exists.
     */
    public function destroy(string $id): JsonResponse
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        $hasOrders = DB::table('order_items')
            ->whereIn('variant_id', $product->variants()->withTrashed()->pluck('id'))
            ->exists();

        $hasMovements = DB::table('stock_movements')
            ->whereIn('variant_id', $product->variants()->withTrashed()->pluck('id'))
            ->exists();

        if ($hasOrders || $hasMovements) {
            $product->update(['is_active' => false]);
            $product->variants()->update(['is_active' => false]);

            return $this->successResponse([
                'product'     => $product->fresh(['variants']),
                'action'      => 'deactivated',
                'deactivated' => true,
            ], 'Product has historical transactions and has been deactivated instead of deleted.');
        }

        DB::transaction(function () use ($product) {
            $product->variants()->delete();
            $product->delete();
        });

        return $this->successResponse(null, 'Product deleted successfully.');
    }
}
