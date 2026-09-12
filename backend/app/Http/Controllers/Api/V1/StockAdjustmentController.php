<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\StockAdjustmentRequest;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StockAdjustmentController extends BaseApiController
{
    /**
     * GET /api/v1/inventory/movements
     *
     * Returns cursor-paginated stock movement log (newest first).
     * Query params:
     *   - product_id (optional): scope to a single product
     *   - per_page   (optional): records per page, default 30, max 100
     *   - cursor     (optional): opaque cursor string from previous response
     */
    public function index(Request $request): JsonResponse
    {
        $perPage   = min((int) $request->query('per_page', 30), 100);
        $productId = $request->query('product_id');

        $query = StockMovement::with(['variant.product', 'user'])
            ->latest('created_at')
            ->orderBy('id', 'desc');

        if ($productId) {
            $query->where('product_id', $productId);
        }

        $paginator = $query->cursorPaginate($perPage, ['*'], 'cursor');

        $data = $paginator->getCollection()->map(function (StockMovement $movement) {
            $quantity = (int) ($movement->quantity_change ?? 0);

            return [
                'id'              => (string) $movement->id,
                'variantId'       => (string) ($movement->variant_id ?? ''),
                'productName'     => $movement->variant?->product?->name
                                        ?? ($movement->variant?->sku ?? 'Unknown Product'),
                'sku'             => $movement->variant?->sku ?? '',
                'movementType'    => strtoupper($movement->movement_type ?? $movement->type ?? 'ADJUSTMENT'),
                'quantity'        => $quantity,
                'balanceAfter'    => (int) ($movement->quantity_after ?? 0),
                'referenceNumber' => $movement->reference_id ?? null,
                'notes'           => $movement->notes ?? null,
                'createdAt'       => $movement->created_at?->toIso8601String() ?? now()->toIso8601String(),
                'recordedBy'      => $movement->user?->name ?? 'System',
            ];
        });

        return $this->successResponse([
            'data'        => $data,
            'next_cursor' => $paginator->nextCursor()?->encode(),
            'has_more'    => $paginator->hasMorePages(),
        ]);
    }

    /**
     * POST /api/v1/inventory/adjust
     *
     * Perform physical stock count variance adjustment with ledger auditing.
     * Supports single item or bulk items payload.
     */
    public function adjust(StockAdjustmentRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $userId    = $request->user()?->id;

        // 1. Bulk adjustments handling
        if ($request->has('items') && is_array($validated['items'])) {
            $itemsList = $validated['items'];
            if (empty($itemsList)) {
                return $this->errorResponse('Items list cannot be empty.', null, 422);
            }

            try {
                $adjustedVariantsToDispatch = [];
                $results = DB::transaction(function () use ($itemsList, $userId, $request, &$adjustedVariantsToDispatch) {
                    $processed = [];
                    foreach ($itemsList as $item) {
                        $vId = $item['variant_id'];
                        $newQty = (int) $item['new_quantity'];
                        if ($newQty < 0) {
                            throw new \InvalidArgumentException("New quantity cannot be negative for variant {$vId}.");
                        }

                        $reason = $item['reason'] ?? 'Audit';
                        $movementType = match ($reason) {
                            'Damaged'   => 'DAMAGE',
                            'Audit'     => 'ADJUSTMENT',
                            'Restock'   => 'RESTOCK',
                            'Return'    => 'RETURN',
                            'Shrinkage' => 'SHRINKAGE',
                            default     => 'ADJUSTMENT',
                        };

                        /** @var ProductVariant $variant */
                        $variant = ProductVariant::lockForUpdate()->findOrFail($vId);
                        $qtyBefore = (int) $variant->quantity_on_hand;
                        $difference = $newQty - $qtyBefore;

                        $variant->quantity_on_hand = $newQty;
                        $variant->save();

                        if ($difference !== 0) {
                            $refId = 'ADJ-' . strtoupper(Str::random(8));
                            StockMovement::create([
                                'product_id'      => $variant->product_id,
                                'variant_id'      => $variant->id,
                                'movement_type'   => $movementType,
                                'quantity_before' => $qtyBefore,
                                'quantity_after'  => $newQty,
                                'quantity_change' => $difference,
                                'reference_id'    => $refId,
                                'notes'           => $item['notes'] ?? "Stock adjustment: {$reason}",
                                'user_id'         => $userId,
                                'created_by'      => $userId,
                                'created_at'      => now(),
                            ]);
                        }

                        $adjustedVariantsToDispatch[] = $variant;

                        $processed[] = [
                            'variant_id'   => $variant->id,
                            'new_quantity' => $newQty,
                            'difference'   => $difference,
                            'reason'       => $reason,
                        ];
                    }
                    return $processed;
                });

                // Dispatch events safely after transaction commits
                foreach ($adjustedVariantsToDispatch as $v) {
                    \App\Events\StockAdjusted::dispatch($v);
                }

                return $this->successResponse([
                    'adjusted_count' => count($results),
                    'items'          => $results,
                ], 'Bulk stock adjusted successfully.');
            } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
                return $this->errorResponse('One or more product variants not found.', null, 404);
            } catch (\Throwable $e) {
                return $this->errorResponse($e->getMessage(), null, 422);
            }
        }

        // 2. Single item adjustment handling
        $variantId   = $validated['variant_id'];
        $newQuantity = (int) $validated['new_quantity'];
        $reason      = $validated['reason'];
        $notes       = $validated['notes'] ?? null;
        $adjustedAt  = !empty($validated['adjusted_at']) ? $validated['adjusted_at'] : now();

        if ($newQuantity < 0) {
            return $this->errorResponse('New quantity cannot be negative.', null, 422);
        }

        $movementType = match ($reason) {
            'Damaged'   => 'DAMAGE',
            'Audit'     => 'ADJUSTMENT',
            'Restock'   => 'RESTOCK',
            'Return'    => 'RETURN',
            'Shrinkage' => 'SHRINKAGE',
            default     => 'ADJUSTMENT',
        };

        $mutationId = $validated['client_mutation_id'] ?? null;
        if ($mutationId) {
            $existingMovement = StockMovement::where('reference_id', $mutationId)->first();
            if ($existingMovement) {
                return $this->successResponse([
                    'variant_id'   => $existingMovement->variant_id,
                    'new_quantity' => (int) $existingMovement->quantity_after,
                    'difference'   => (int) $existingMovement->quantity_change,
                    'reason'       => $reason,
                ], 'Stock adjusted successfully.');
            }
        }

        try {
            $result = DB::transaction(function () use ($variantId, $newQuantity, $reason, $movementType, $notes, $adjustedAt, $mutationId, $request) {
                /** @var ProductVariant $variant */
                $variant = ProductVariant::lockForUpdate()->findOrFail($variantId);

                $qtyBefore  = (int) $variant->quantity_on_hand;
                $difference = $newQuantity - $qtyBefore;

                $variant->quantity_on_hand = $newQuantity;
                $variant->save();

                if ($difference !== 0) {
                    $userId = $request->user()?->id;
                    $refId  = $mutationId ?: ('ADJ-' . strtoupper(Str::random(8)));

                    StockMovement::create([
                        'product_id'      => $variant->product_id,
                        'variant_id'      => $variant->id,
                        'movement_type'   => $movementType,
                        'quantity_before' => $qtyBefore,
                        'quantity_after'  => $newQuantity,
                        'quantity_change' => $difference,
                        'reference_id'    => $refId,
                        'notes'           => $notes ?? "Stock adjustment: {$reason}",
                        'user_id'         => $userId,
                        'created_by'      => $userId,
                        'created_at'      => $adjustedAt,
                    ]);
                }

                $data = [
                    'variant_id'   => $variant->id,
                    'new_quantity' => $newQuantity,
                    'difference'   => $difference,
                    'reason'       => $reason,
                    '_variant'     => $variant,
                ];

                return $data;
            });

            if (isset($result['_variant'])) {
                \App\Events\StockAdjusted::dispatch($result['_variant']);
                unset($result['_variant']);
            }

            return $this->successResponse($result, 'Stock adjusted successfully.');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return $this->errorResponse('Product variant not found.', null, 404);
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        }
    }

    /**
     * Alias for store method.
     */
    public function store(StockAdjustmentRequest $request): JsonResponse
    {
        return $this->adjust($request);
    }
}
