<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\ProductVariant;
use App\Models\RestockDetail;
use App\Models\RestockSession;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RestockController extends BaseApiController
{
    /**
     * POST /api/v1/inventory/restock
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_date'              => ['nullable', 'date'],
            'notes'                     => ['nullable', 'string'],
            'items'                     => ['required', 'array', 'min:1'],
            'items.*.variant_id'        => ['required', 'uuid', 'exists:product_variants,id'],
            'items.*.quantity'          => ['required', 'integer', 'min:1'],
            'items.*.unit_cost'         => ['required', 'numeric', 'min:0'],
            'items.*.scanned_barcode'   => ['nullable', 'string'],
        ]);

        try {
            $session = DB::transaction(function () use ($validated): RestockSession {
                $session = RestockSession::create([
                    'session_date' => $validated['session_date'] ?? now(),
                    'status'       => 'COMPLETED',
                    'notes'        => $validated['notes'] ?? null,
                ]);

                foreach ($validated['items'] as $item) {
                    $variant   = ProductVariant::lockForUpdate()->findOrFail($item['variant_id']);
                    $qtyBefore = $variant->quantity_on_hand;
                    $qtyAfter  = $qtyBefore + $item['quantity'];

                    $variant->increment('quantity_on_hand', $item['quantity']);

                    RestockDetail::create([
                        'restock_session_id' => $session->id,
                        'variant_id'         => $variant->id,
                        'scanned_barcode'    => $item['scanned_barcode'] ?? null,
                        'quantity'           => $item['quantity'],
                        'unit_cost'          => $item['unit_cost'],
                    ]);

                    StockMovement::create([
                        'variant_id'      => $variant->id,
                        'movement_type'   => 'RESTOCK',
                        'quantity_change' => $item['quantity'],
                        'quantity_before' => $qtyBefore,
                        'quantity_after'  => $qtyAfter,
                        'reference_id'    => $session->id,
                        'notes'           => "Restock session {$session->id}",
                    ]);
                }

                return $session->load('details.variant');
            });

            return $this->createdResponse($session, 'Restock session completed successfully.');
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        }
    }
}
