<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\SalesChannel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesChannelController extends BaseApiController
{
    /**
     * GET /api/v1/sales-channels
     */
    public function index(Request $request): JsonResponse
    {
        $query = SalesChannel::query();

        if (!$request->boolean('include_inactive', false)) {
            $query->where('is_active', true);
        }

        if ($request->has('search') && !empty($request->query('search'))) {
            $term = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('code', 'like', $term);
            });
        }

        $channels = $query->orderByDesc('is_default')->orderBy('name')->get();

        return $this->successResponse($channels);
    }

    /**
     * POST /api/v1/sales-channels
     */
    public function store(Request $request): JsonResponse
    {
        $platform = $request->input('platform') ?? $request->input('type') ?? 'pos';

        $validated = $request->validate([
            'name'       => [
                'required',
                'string',
                'max:100',
                Rule::unique('sales_channels', 'name')->where(fn ($q) => $q->where('platform', $platform)),
            ],
            'platform'   => ['nullable', 'string', 'max:50'],
            'code'       => ['nullable', 'string', 'max:50'],
            'type'       => ['nullable', 'string', 'max:50'],
            'image_url'  => ['nullable', 'string'],
            'imageUrl'   => ['nullable', 'string'],
            'is_active'  => ['nullable', 'boolean'],
            'isActive'   => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'isDefault'  => ['nullable', 'boolean'],
        ]);

        $isDefault = $request->has('isDefault')
            ? $request->boolean('isDefault')
            : ($request->has('is_default') ? $request->boolean('is_default') : false);

        if ($isDefault) {
            SalesChannel::where('is_default', true)->update(['is_default' => false]);
        }

        $isActive = $request->has('isActive')
            ? $request->boolean('isActive')
            : ($request->has('is_active') ? $request->boolean('is_active') : true);

        $imageUrl = $request->input('imageUrl') ?? $request->input('image_url') ?? null;

        $channel = SalesChannel::create([
            'name'       => $validated['name'],
            'platform'   => $platform,
            'code'       => $validated['code'] ?? strtoupper(preg_replace('/[^A-Za-z0-9]/', '-', $validated['name'])),
            'type'       => $platform,
            'image_url'  => $imageUrl,
            'is_active'  => $isActive,
            'is_default' => $isDefault,
        ]);

        return $this->createdResponse($channel, 'Sales channel created successfully.');
    }

    /**
     * PUT /api/v1/sales-channels/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $channel = SalesChannel::find($id);

        if (!$channel) {
            return $this->notFoundResponse('Sales channel not found.');
        }

        $platform = $request->input('platform') ?? $request->input('type') ?? $channel->platform ?? $channel->type ?? 'pos';

        $validated = $request->validate([
            'name'       => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('sales_channels', 'name')->where(fn ($q) => $q->where('platform', $platform))->ignore($channel->id),
            ],
            'platform'   => ['nullable', 'string', 'max:50'],
            'code'       => ['nullable', 'string', 'max:50'],
            'type'       => ['nullable', 'string', 'max:50'],
            'image_url'  => ['nullable', 'string'],
            'imageUrl'   => ['nullable', 'string'],
            'is_active'  => ['nullable', 'boolean'],
            'isActive'   => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'isDefault'  => ['nullable', 'boolean'],
        ]);

        $updateData = [];
        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }
        $updateData['platform'] = $platform;
        $updateData['type'] = $platform;
        if (array_key_exists('code', $validated)) {
            $updateData['code'] = $validated['code'];
        }
        if ($request->has('imageUrl') || $request->has('image_url')) {
            $updateData['image_url'] = $request->input('imageUrl') ?? $request->input('image_url');
        }
        if ($request->has('isActive') || $request->has('is_active')) {
            $updateData['is_active'] = $request->has('isActive') ? $request->boolean('isActive') : $request->boolean('is_active');
        }
        if ($request->has('isDefault') || $request->has('is_default')) {
            $isDefault = $request->has('isDefault') ? $request->boolean('isDefault') : $request->boolean('is_default');
            $updateData['is_default'] = $isDefault;
            if ($isDefault) {
                SalesChannel::where('id', '!=', $channel->id)->where('is_default', true)->update(['is_default' => false]);
            }
        }

        $channel->update($updateData);

        return $this->successResponse($channel, 'Sales channel updated successfully.');
    }

    /**
     * DELETE /api/v1/sales-channels/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $channel = SalesChannel::find($id);

        if (!$channel) {
            return $this->notFoundResponse('Sales channel not found.');
        }

        // Check if referenced by existing orders
        $hasOrders = $channel->orders()->exists()
            || \App\Models\Order::where('sales_channel_id', $channel->id)->exists()
            || \App\Models\Order::where('channel_id', $channel->id)->exists();

        if ($hasOrders) {
            // Soft-deactivate if orders exist
            $channel->update(['is_active' => false]);
            return $this->successResponse($channel, 'Sales channel deactivated as it has associated orders.');
        }

        $channel->delete();

        return $this->successResponse(null, 'Sales channel deleted successfully.');
    }
}
