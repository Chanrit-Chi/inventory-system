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

        if ($request->has('filter_type')) {
            $ft = strtoupper(trim($request->query('filter_type')));
            if ($ft === 'ACTIVE') {
                $query->where('is_active', true);
            } elseif ($ft === 'INACTIVE') {
                $query->where('is_active', false);
            } elseif ($ft === 'SOCIAL') {
                $query->whereIn('platform', ['facebook', 'tiktok', 'telegram', 'instagram', 'whatsapp', 'line']);
            } elseif ($ft === 'POS_ONLINE') {
                $query->whereIn('platform', ['pos', 'web', 'online', 'shopee', 'lazada', 'wholesale', 'b2b']);
            }
        } elseif (!$request->boolean('include_inactive', false)) {
            $query->where('is_active', true);
        }

        if ($request->has('search') && !empty($request->query('search'))) {
            $term = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('code', 'like', $term)
                  ->orWhere('platform', 'like', $term);
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
        $platform = strtolower(trim($request->input('platform') ?? $request->input('type') ?? 'pos'));

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
        ], [
            'name.unique' => "The sales channel name has already been taken on the " . strtoupper($platform) . " platform.",
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
        $code = !empty($validated['code'])
            ? trim($validated['code'])
            : $this->generateUniqueCode($validated['name'], $platform);

        $channel = SalesChannel::create([
            'name'       => $validated['name'],
            'platform'   => $platform,
            'code'       => $code,
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

        $platform = strtolower(trim($request->input('platform') ?? $request->input('type') ?? $channel->platform ?? $channel->type ?? 'pos'));

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
        ], [
            'name.unique' => "The sales channel name has already been taken on the " . strtoupper($platform) . " platform.",
        ]);

        $updateData = [];
        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }
        $updateData['platform'] = $platform;
        $updateData['type'] = $platform;
        if (array_key_exists('code', $validated)) {
            $updateData['code'] = !empty($validated['code'])
                ? trim($validated['code'])
                : $this->generateUniqueCode($validated['name'] ?? $channel->name, $platform, $channel->id);
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
     * Auto-generate a clean, unique channel code with platform prefix
     */
    private function generateUniqueCode(string $name, string $platform, ?string $ignoreId = null): string
    {
        $prefixMap = [
            'pos'       => 'POS',
            'facebook'  => 'FB',
            'tiktok'    => 'TT',
            'telegram'  => 'TG',
            'instagram' => 'IG',
            'whatsapp'  => 'WA',
            'line'      => 'LN',
            'shopee'    => 'SP',
            'lazada'    => 'LZ',
            'web'       => 'WEB',
            'online'    => 'WEB',
            'wholesale' => 'B2B',
        ];
        $prefix = $prefixMap[strtolower($platform)] ?? strtoupper(substr($platform, 0, 3));
        $nameSlug = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', trim($name)));
        $nameSlug = trim($nameSlug, '-');
        $baseCode = $prefix . ($nameSlug ? '-' . $nameSlug : '');
        if (strlen($baseCode) > 35) {
            $baseCode = substr($baseCode, 0, 35);
        }

        $candidate = $baseCode ?: $prefix;
        $counter = 1;
        while (SalesChannel::where('code', $candidate)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists()) {
            $candidate = $baseCode . '-' . str_pad((string) $counter, 2, '0', STR_PAD_LEFT);
            $counter++;
        }
        return $candidate;
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
