<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\StoreQuotationRequest;
use App\Models\Quotation;
use App\Models\StoreSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuotationController extends BaseApiController
{
    /**
     * GET /api/v1/quotations
     */
    public function index(Request $request): JsonResponse
    {
        $query = Quotation::with(['customer', 'items', 'user:id,name'])
            ->whereNull('deleted_at');

        if ($request->filled('status') && strtoupper($request->input('status')) !== 'ALL') {
            $query->where('status', strtoupper($request->input('status')));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('quotation_number', 'like', $search)
                  ->orWhere('customer_name', 'like', $search)
                  ->orWhere('customer_phone', 'like', $search);
            });
        }

        $quotations = $query->latest()->paginate($request->integer('per_page', 20));

        return $this->paginatedResponse($quotations);
    }

    /**
     * POST /api/v1/quotations
     */
    public function store(StoreQuotationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $quotation = DB::transaction(function () use ($validated, $request) {
            $subtotal = 0;
            $itemsData = [];

            foreach ($validated['items'] as $item) {
                $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                $subtotal += $lineTotal;
                $itemsData[] = [
                    'variant_id'   => $item['variant_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'sku'          => $item['sku'] ?? null,
                    'quantity'     => $item['quantity'],
                    'unit_price'   => $item['unit_price'],
                    'line_total'   => $lineTotal,
                ];
            }

            $discount = (float) ($validated['discount'] ?? 0);
            $totalAmount = max(0, $subtotal - $discount);

            $quotation = Quotation::create([
                'quotation_number' => Quotation::generateQuotationNumber(),
                'customer_id'      => $validated['customer_id'] ?? null,
                'customer_name'    => $validated['customer_name'],
                'customer_phone'   => $validated['customer_phone'] ?? null,
                'customer_email'   => $validated['customer_email'] ?? null,
                'status'           => 'DRAFT',
                'subtotal'         => $subtotal,
                'discount'         => $discount,
                'total_amount'     => $totalAmount,
                'notes'            => $validated['notes'] ?? null,
                'valid_until'      => $validated['valid_until'] ?? now()->addDays(14)->toDateString(),
                'user_id'          => $request->user()?->id,
            ]);

            foreach ($itemsData as $it) {
                $quotation->items()->create($it);
            }

            return $quotation->load(['items', 'customer', 'user:id,name']);
        });

        return $this->createdResponse($quotation, 'Quotation created successfully.');
    }

    /**
     * GET /api/v1/quotations/{id}
     */
    public function show(string $id): JsonResponse
    {
        $quotation = Quotation::with(['customer', 'items', 'user:id,name'])->findOrFail($id);
        return $this->successResponse($quotation);
    }

    /**
     * GET /api/v1/quotations/{id}/receipt
     *
     * Serves printable thermal quotation HTML or JSON.
     */
    public function receipt(Request $request, string $id)
    {
        $quotation = Quotation::with(['customer', 'items', 'user:id,name'])->findOrFail($id);

        $accept = (string) $request->header('Accept', '');
        $wantsJson = $request->query('format') === 'json' ||
            ($accept === 'application/json' || (str_contains($accept, 'application/json') && !str_contains($accept, 'text/html')));
        if ($wantsJson) {
            return $this->successResponse($quotation);
        }

        $setting = StoreSetting::current();

        return response()->view('receipts.quotation', [
            'quotation' => $quotation,
            'setting'   => $setting,
        ])->header('Content-Type', 'text/html; charset=UTF-8');
    }

    /**
     * PATCH /api/v1/quotations/{id}/status
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:DRAFT,SENT,ACCEPTED,REJECTED,CONVERTED'],
        ]);

        $quotation = Quotation::findOrFail($id);

        if (strtoupper($quotation->status) === 'CONVERTED') {
            return $this->errorResponse('This quotation has already been converted to a sale order and cannot be modified.', null, 422);
        }

        $quotation->status = strtoupper($request->input('status'));
        $quotation->save();

        return $this->successResponse($quotation->load(['items', 'customer']), 'Quotation status updated.');
    }

    /**
     * POST /api/v1/quotations/{id}/convert
     */
    public function convert(Request $request, string $id): JsonResponse
    {
        $quotation = Quotation::with('items')->findOrFail($id);
        $quotation->status = 'CONVERTED';
        $quotation->save();

        return $this->successResponse([
            'quotation' => $quotation,
            'items'     => $quotation->items,
        ], 'Quotation marked as converted.');
    }

    /**
     * DELETE /api/v1/quotations/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $quotation = Quotation::findOrFail($id);
        $quotation->delete();

        return $this->successResponse(null, 'Quotation deleted.');
    }
}
