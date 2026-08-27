<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\DeliveryZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryZoneController extends BaseApiController
{
    /**
     * GET /api/v1/delivery-zones
     */
    public function index(Request $request): JsonResponse
    {
        $query = DeliveryZone::query();

        if (!$request->boolean('include_inactive', false)) {
            $query->where('is_active', true);
        }

        if ($request->has('search') && !empty($request->query('search'))) {
            $term = '%' . $request->query('search') . '%';
            $query->where('name', 'like', $term);
        }

        $zones = $query->orderByDesc('is_default')->orderBy('name')->get();

        return $this->successResponse($zones);
    }

    /**
     * POST /api/v1/delivery-zones
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:100'],
            'cost'       => ['required', 'numeric', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
            'isActive'   => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'isDefault'  => ['nullable', 'boolean'],
        ]);

        $isDefault = $request->has('isDefault')
            ? $request->boolean('isDefault')
            : ($request->has('is_default') ? $request->boolean('is_default') : false);

        if ($isDefault) {
            DeliveryZone::where('is_default', true)->update(['is_default' => false]);
        }

        $isActive = $request->has('isActive')
            ? $request->boolean('isActive')
            : ($request->has('is_active') ? $request->boolean('is_active') : true);

        $zone = DeliveryZone::create([
            'name'       => $validated['name'],
            'cost'       => $validated['cost'],
            'is_active'  => $isActive,
            'is_default' => $isDefault,
        ]);

        return $this->createdResponse($zone, 'Delivery zone created successfully.');
    }

    /**
     * GET /api/v1/delivery-zones/{id}
     */
    public function show(string $id): JsonResponse
    {
        $zone = DeliveryZone::find($id);

        if (!$zone) {
            return $this->notFoundResponse('Delivery zone not found.');
        }

        return $this->successResponse($zone);
    }

    /**
     * PUT/PATCH /api/v1/delivery-zones/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $zone = DeliveryZone::find($id);

        if (!$zone) {
            return $this->notFoundResponse('Delivery zone not found.');
        }

        $validated = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:100'],
            'cost'       => ['sometimes', 'required', 'numeric', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
            'isActive'   => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'isDefault'  => ['nullable', 'boolean'],
        ]);

        $updateData = [];
        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }
        if (isset($validated['cost'])) {
            $updateData['cost'] = $validated['cost'];
        }
        if ($request->has('isActive') || $request->has('is_active')) {
            $updateData['is_active'] = $request->has('isActive') ? $request->boolean('isActive') : $request->boolean('is_active');
        }
        if ($request->has('isDefault') || $request->has('is_default')) {
            $isDefault = $request->has('isDefault') ? $request->boolean('isDefault') : $request->boolean('is_default');
            $updateData['is_default'] = $isDefault;
            if ($isDefault) {
                DeliveryZone::where('id', '!=', $zone->id)->where('is_default', true)->update(['is_default' => false]);
            }
        }

        $zone->update($updateData);

        return $this->successResponse($zone, 'Delivery zone updated successfully.');
    }

    /**
     * DELETE /api/v1/delivery-zones/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $zone = DeliveryZone::find($id);

        if (!$zone) {
            return $this->notFoundResponse('Delivery zone not found.');
        }

        $zone->delete();

        return $this->successResponse(null, 'Delivery zone deleted successfully.');
    }
}
