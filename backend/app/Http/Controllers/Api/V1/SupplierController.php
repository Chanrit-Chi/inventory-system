<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends BaseApiController
{
    /**
     * GET /api/v1/suppliers
     */
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $suppliers = $query->orderBy('name', 'asc')->get();

        return $this->successResponse($suppliers, 'Suppliers retrieved successfully.');
    }

    /**
     * POST /api/v1/suppliers
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone'          => ['required', 'string', 'max:50'],
            'email'          => ['nullable', 'email', 'max:255'],
            'address'        => ['nullable', 'string'],
            'lead_time_days' => ['nullable', 'integer', 'min:0'],
            'payment_terms'  => ['nullable', 'string', 'max:100'],
            'tax_id'         => ['nullable', 'string', 'max:100'],
            'notes'          => ['nullable', 'string'],
            'is_active'      => ['nullable', 'boolean'],
        ]);

        $supplier = Supplier::create($validated);

        return $this->createdResponse($supplier, 'Supplier created successfully.');
    }

    /**
     * GET /api/v1/suppliers/{id}
     */
    public function show(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        return $this->successResponse($supplier, 'Supplier retrieved successfully.');
    }

    /**
     * PUT/PATCH /api/v1/suppliers/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'name'           => ['sometimes', 'required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone'          => ['sometimes', 'required', 'string', 'max:50'],
            'email'          => ['nullable', 'email', 'max:255'],
            'address'        => ['nullable', 'string'],
            'lead_time_days' => ['nullable', 'integer', 'min:0'],
            'payment_terms'  => ['nullable', 'string', 'max:100'],
            'tax_id'         => ['nullable', 'string', 'max:100'],
            'notes'          => ['nullable', 'string'],
            'is_active'      => ['nullable', 'boolean'],
        ]);

        $supplier->update($validated);

        return $this->successResponse($supplier, 'Supplier updated successfully.');
    }

    /**
     * DELETE /api/v1/suppliers/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->delete();

        return $this->successResponse(null, 'Supplier deleted successfully.');
    }
}
