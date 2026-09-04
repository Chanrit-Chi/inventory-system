<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Attribute;
use App\Models\AttributeValue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttributeController extends BaseApiController
{
    /**
     * GET /api/v1/attributes
     */
    public function index(): JsonResponse
    {
        $attributes = Attribute::with(['values' => fn ($q) => $q->where('is_active', true)])
            ->where('is_active', true)
            ->withCount(['values as bound_variants_count' => function ($query) {
                $query->join('variant_attribute_values', 'attribute_values.id', '=', 'variant_attribute_values.attribute_value_id');
            }])
            ->orderBy('name')
            ->get();

        return $this->successResponse($attributes);
    }

    /**
     * POST /api/v1/attributes
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:50', 'unique:attributes,name'],
            'is_active' => ['boolean'],
            'values'    => ['nullable', 'array'],
            'values.*'  => ['string', 'max:50'],
        ]);

        $attribute = Attribute::create([
            'name'      => $validated['name'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        if (!empty($validated['values'])) {
            foreach ($validated['values'] as $valueName) {
                AttributeValue::create([
                    'attribute_id' => $attribute->id,
                    'value_name'   => $valueName,
                    'is_active'    => true,
                ]);
            }
        }

        return $this->createdResponse($attribute->load('values'), 'Attribute created successfully.');
    }

    /**
     * PATCH /api/v1/attributes/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $attribute = Attribute::findOrFail($id);

        $validated = $request->validate([
            'name'      => ['sometimes', 'required', 'string', 'max:50', 'unique:attributes,name,' . $attribute->id],
            'is_active' => ['boolean'],
            'values'    => ['nullable', 'array'],
            'values.*'  => ['string', 'max:50'],
        ]);

        if (array_key_exists('name', $validated)) {
            $attribute->name = $validated['name'];
        }
        if (array_key_exists('is_active', $validated)) {
            $attribute->is_active = $validated['is_active'];
        }
        $attribute->save();

        if (array_key_exists('values', $validated)) {
            $submittedValues = array_values(array_unique(array_filter(array_map('trim', $validated['values'] ?? []))));

            // Sync values:
            $currentValues = $attribute->values()->get();
            $currentMap = $currentValues->keyBy('value_name');

            $keptIds = [];
            foreach ($submittedValues as $valName) {
                if ($currentMap->has($valName)) {
                    $valModel = $currentMap->get($valName);
                    if (!$valModel->is_active) {
                        $valModel->update(['is_active' => true]);
                    }
                    $keptIds[] = $valModel->id;
                } else {
                    $newVal = AttributeValue::create([
                        'attribute_id' => $attribute->id,
                        'value_name'   => $valName,
                        'is_active'    => true,
                    ]);
                    $keptIds[] = $newVal->id;
                }
            }

            // Remove or deactivate values omitted from update
            foreach ($currentValues as $existingVal) {
                if (!in_array($existingVal->id, $keptIds)) {
                    $isBound = \App\Models\VariantAttributeValue::where('attribute_value_id', $existingVal->id)->exists();
                    if (!$isBound) {
                        $existingVal->delete();
                    } else {
                        $existingVal->update(['is_active' => false]);
                    }
                }
            }
        }

        return $this->successResponse($attribute->fresh(['values' => fn ($q) => $q->where('is_active', true)]), 'Attribute updated successfully.');
    }

    /**
     * DELETE /api/v1/attributes/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $attribute = Attribute::findOrFail($id);
        $valueIds = $attribute->values()->pluck('id');
        $isBound = \App\Models\VariantAttributeValue::whereIn('attribute_value_id', $valueIds)->exists();

        if ($isBound) {
            return $this->errorResponse(
                'Cannot delete attribute: it is currently linked to active product variants.',
                null,
                422
            );
        }

        $attribute->values()->delete();
        $attribute->delete();

        return $this->successResponse(null, 'Attribute deleted successfully.');
    }
}

