<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class VariantController extends BaseApiController
{
    /**
     * GET /api/v1/variants
     * Paginated product variant listing with optional filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ProductVariant::with(['product.category', 'attributeValues.attribute'])
            ->whereNull('deleted_at');

        if ($request->filled('search')) {
            $search = '%' . $request->string('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('sku', 'like', $search)
                  ->orWhere('barcode', 'like', $search)
                  ->orWhereHas('product', function ($pq) use ($search) {
                      $pq->where('name', 'like', $search);
                  });
            });
        }

        if ($request->has('is_active')) {
            $isActiveVal = $request->input('is_active');
            if ($isActiveVal !== 'all' && $isActiveVal !== '' && $isActiveVal !== null) {
                $query->where('is_active', filter_var($isActiveVal, FILTER_VALIDATE_BOOLEAN));
            }
        } elseif (!$request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->input('product_id'));
        }

        if ($request->filled('category_id')) {
            $catId = $request->input('category_id');
            $query->whereIn('product_id', function ($sub) use ($catId) {
                $sub->select('id')->from('products')->where('category_id', $catId)->whereNull('deleted_at');
            });
        }

        $perPage = min((int) $request->input('per_page', 25), 200);
        $variants = $query->latest()->paginate($perPage > 0 ? $perPage : 25);

        return $this->paginatedResponse($variants);
    }

    /**
     * GET /api/v1/variants/{id}
     */
    public function show(string $id): JsonResponse
    {
        $variant = ProductVariant::with(['product.category', 'attributeValues.attribute'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        return $this->successResponse($variant);
    }

    /**
     * PUT/PATCH /api/v1/variants/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $variant = ProductVariant::whereNull('deleted_at')->findOrFail($id);

        $validated = $request->validate([
            'name'                   => ['sometimes', 'string', 'max:255'],
            'sku'                    => ['sometimes', 'string', 'max:100'],
            'barcode'                => ['nullable', 'string', 'max:100'],
            'cost_price'             => ['sometimes', 'numeric', 'min:0'],
            'selling_price'          => ['sometimes', 'numeric', 'min:0'],
            'cost_price_override'    => ['nullable', 'numeric', 'min:0'],
            'selling_price_override' => ['nullable', 'numeric', 'min:0'],
            'quantity_on_hand'       => ['sometimes', 'integer', 'min:0'],
            'reorder_level'          => ['nullable', 'integer', 'min:0'],
            'is_active'              => ['sometimes', 'boolean'],
        ]);

        $updateFields = Arr::only($validated, [
            'name',
            'sku',
            'barcode',
            'cost_price',
            'selling_price',
            'cost_price_override',
            'selling_price_override',
            'quantity_on_hand',
            'reorder_level',
            'is_active',
        ]);

        DB::transaction(function () use ($variant, $updateFields) {
            $variant->update($updateFields);
        });

        $fresh = $variant->fresh(['product.category', 'attributeValues.attribute']);

        return $this->successResponse($fresh, 'Variant updated successfully.');
    }
}
