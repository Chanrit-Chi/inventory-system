<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\DeliveryCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryCompanyController extends BaseApiController
{
    /**
     * GET /api/v1/delivery-companies
     */
    public function index(Request $request): JsonResponse
    {
        $query = DeliveryCompany::query();

        if (!$request->boolean('include_inactive', false)) {
            $query->where('is_active', true);
        }

        if ($request->has('search') && !empty($request->query('search'))) {
            $term = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('phone', 'like', $term)
                  ->orWhere('notes', 'like', $term);
            });
        }

        $companies = $query->orderByDesc('is_default')->orderBy('name')->get();

        return $this->successResponse($companies);
    }

    /**
     * POST /api/v1/delivery-companies
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:100'],
            'phone'      => ['nullable', 'string', 'max:50'],
            'logo_icon'  => ['nullable', 'string', 'max:50'],
            'logoIcon'   => ['nullable', 'string', 'max:50'],
            'color'      => ['nullable', 'string', 'max:50'],
            'is_active'  => ['nullable', 'boolean'],
            'isActive'   => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'isDefault'  => ['nullable', 'boolean'],
            'notes'      => ['nullable', 'string'],
        ]);

        $isDefault = $request->has('isDefault')
            ? $request->boolean('isDefault')
            : ($request->has('is_default') ? $request->boolean('is_default') : false);

        if ($isDefault) {
            DeliveryCompany::where('is_default', true)->update(['is_default' => false]);
        }

        $isActive = $request->has('isActive')
            ? $request->boolean('isActive')
            : ($request->has('is_active') ? $request->boolean('is_active') : true);

        $company = DeliveryCompany::create([
            'name'       => $validated['name'],
            'phone'      => $validated['phone'] ?? null,
            'logo_icon'  => $request->input('logoIcon') ?? $request->input('logo_icon') ?? 'car',
            'color'      => $validated['color'] ?? '#0284C7',
            'is_active'  => $isActive,
            'is_default' => $isDefault,
            'notes'      => $validated['notes'] ?? null,
        ]);

        return $this->createdResponse($company, 'Delivery company created successfully.');
    }

    /**
     * GET /api/v1/delivery-companies/{id}
     */
    public function show(string $id): JsonResponse
    {
        $company = DeliveryCompany::find($id);

        if (!$company) {
            return $this->notFoundResponse('Delivery company not found.');
        }

        return $this->successResponse($company);
    }

    /**
     * PUT/PATCH /api/v1/delivery-companies/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $company = DeliveryCompany::find($id);

        if (!$company) {
            return $this->notFoundResponse('Delivery company not found.');
        }

        $validated = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:100'],
            'phone'      => ['nullable', 'string', 'max:50'],
            'logo_icon'  => ['nullable', 'string', 'max:50'],
            'logoIcon'   => ['nullable', 'string', 'max:50'],
            'color'      => ['nullable', 'string', 'max:50'],
            'is_active'  => ['nullable', 'boolean'],
            'isActive'   => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'isDefault'  => ['nullable', 'boolean'],
            'notes'      => ['nullable', 'string'],
        ]);

        $updateData = [];
        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }
        if (array_key_exists('phone', $validated)) {
            $updateData['phone'] = $validated['phone'];
        }
        if ($request->has('logoIcon') || $request->has('logo_icon')) {
            $updateData['logo_icon'] = $request->input('logoIcon') ?? $request->input('logo_icon');
        }
        if (isset($validated['color'])) {
            $updateData['color'] = $validated['color'];
        }
        if (array_key_exists('notes', $validated)) {
            $updateData['notes'] = $validated['notes'];
        }
        if ($request->has('isActive') || $request->has('is_active')) {
            $updateData['is_active'] = $request->has('isActive') ? $request->boolean('isActive') : $request->boolean('is_active');
        }
        if ($request->has('isDefault') || $request->has('is_default')) {
            $isDefault = $request->has('isDefault') ? $request->boolean('isDefault') : $request->boolean('is_default');
            $updateData['is_default'] = $isDefault;
            if ($isDefault) {
                DeliveryCompany::where('id', '!=', $company->id)->where('is_default', true)->update(['is_default' => false]);
            }
        }

        $company->update($updateData);

        return $this->successResponse($company, 'Delivery company updated successfully.');
    }

    /**
     * DELETE /api/v1/delivery-companies/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $company = DeliveryCompany::find($id);

        if (!$company) {
            return $this->notFoundResponse('Delivery company not found.');
        }

        $company->delete();

        return $this->successResponse(null, 'Delivery company deleted successfully.');
    }
}
