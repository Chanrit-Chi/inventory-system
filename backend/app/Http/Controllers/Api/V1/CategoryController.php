<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends BaseApiController
{
    /**
     * GET /api/v1/categories
     */
    public function index(): JsonResponse
    {
        $categories = ProductCategory::whereNull('deleted_at')
            ->withCount(['products' => fn ($q) => $q->whereNull('deleted_at')])
            ->orderBy('name')
            ->get();

        return $this->successResponse($categories);
    }

    /**
     * POST /api/v1/categories
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:100', 'unique:product_categories,name'],
            'code'        => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
        ]);

        $category = ProductCategory::create([
            'name'        => $validated['name'],
            'code'        => $validated['code'] ?? strtoupper(substr($validated['name'], 0, 3)),
            'description' => $validated['description'] ?? null,
        ]);

        return $this->createdResponse($category, 'Category created successfully.');
    }

    /**
     * PUT/PATCH /api/v1/categories/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $category = ProductCategory::whereNull('deleted_at')->findOrFail($id);

        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:100', 'unique:product_categories,name,' . $id],
            'code'        => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
        ]);

        $category->update($validated);

        return $this->successResponse($category, 'Category updated successfully.');
    }

    /**
     * DELETE /api/v1/categories/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $category = ProductCategory::whereNull('deleted_at')->findOrFail($id);

        $boundProductsCount = $category->products()->whereNull('deleted_at')->count();
        if ($boundProductsCount > 0) {
            return $this->errorResponse(
                "Cannot delete category: it is currently linked to {$boundProductsCount} active products.",
                null,
                422
            );
        }

        $category->delete();

        return $this->successResponse(null, 'Category deleted successfully.');
    }
}
