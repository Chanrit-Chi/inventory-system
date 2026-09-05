<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\RecordInvoicePaymentRequest;
use App\Http\Requests\Api\V1\StoreInvoiceRequest;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\StoreSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends BaseApiController
{
    /**
     * GET /api/v1/invoices
     */
    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer', 'order', 'items', 'payments', 'user:id,name'])
            ->whereNull('deleted_at');

        if ($request->filled('status') && strtoupper($request->input('status')) !== 'ALL') {
            $query->where('status', strtoupper($request->input('status')));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', $search)
                  ->orWhere('order_number', 'like', $search)
                  ->orWhere('customer_name', 'like', $search)
                  ->orWhere('customer_phone', 'like', $search);
            });
        }

        $invoices = $query->latest()->paginate($request->integer('per_page', 20));

        return $this->paginatedResponse($invoices);
    }

    /**
     * POST /api/v1/invoices
     */
    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $invoice = DB::transaction(function () use ($validated, $request) {
            $totalAmount = 0;
            $itemsData = [];

            foreach ($validated['items'] as $item) {
                $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                $totalAmount += $lineTotal;
                $itemsData[] = [
                    'product_name' => $item['product_name'],
                    'sku'          => $item['sku'] ?? null,
                    'quantity'     => $item['quantity'],
                    'unit_price'   => $item['unit_price'],
                    'total_price'  => $lineTotal,
                ];
            }

            $invoice = Invoice::create([
                'invoice_number' => Invoice::generateInvoiceNumber(),
                'order_id'       => $validated['order_id'] ?? null,
                'order_number'   => $validated['order_number'] ?? null,
                'customer_id'    => $validated['customer_id'] ?? null,
                'customer_name'  => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'] ?? null,
                'status'         => 'SENT',
                'total_amount'   => $totalAmount,
                'amount_paid'    => 0,
                'balance_due'    => $totalAmount,
                'due_date'       => $validated['due_date'] ?? now()->addDays(7)->toDateString(),
                'notes'          => $validated['notes'] ?? null,
                'user_id'        => $request->user()?->id,
            ]);

            foreach ($itemsData as $it) {
                $invoice->items()->create($it);
            }

            return $invoice->load(['items', 'payments', 'customer', 'user:id,name']);
        });

        return $this->createdResponse($invoice, 'Invoice created successfully.');
    }

    /**
     * GET /api/v1/invoices/{id}
     */
    public function show(string $id): JsonResponse
    {
        $invoice = Invoice::with(['customer', 'order', 'items', 'payments', 'user:id,name'])->findOrFail($id);
        return $this->successResponse($invoice);
    }

    /**
     * GET /api/v1/invoices/{id}/receipt
     *
     * Serves printable thermal invoice HTML or JSON.
     */
    public function receipt(Request $request, string $id)
    {
        $invoice = Invoice::with(['customer', 'order', 'items', 'payments', 'user:id,name'])->findOrFail($id);

        $accept = (string) $request->header('Accept', '');
        $wantsJson = $request->query('format') === 'json' ||
            ($accept === 'application/json' || (str_contains($accept, 'application/json') && !str_contains($accept, 'text/html')));
        if ($wantsJson) {
            return $this->successResponse($invoice);
        }

        $setting = StoreSetting::current();

        return response()->view('receipts.invoice', [
            'invoice' => $invoice,
            'setting' => $setting,
        ])->header('Content-Type', 'text/html; charset=UTF-8');
    }

    /**
     * POST /api/v1/invoices/{id}/payments
     */
    public function recordPayment(RecordInvoicePaymentRequest $request, string $id): JsonResponse
    {
        $invoice = Invoice::with('payments')->findOrFail($id);
        $validated = $request->validated();

        $recordedBy = $validated['recorded_by'] ?? ($request->user()?->name ?? 'Cashier');

        $payment = $invoice->recordPayment(
            amount: (float) $validated['amount'],
            paymentMethod: $validated['payment_method'],
            transactionRef: $validated['transaction_ref'] ?? null,
            recordedBy: $recordedBy,
            notes: $validated['notes'] ?? null
        );

        \App\Events\InvoicePaymentRecorded::dispatch($invoice, $payment);

        return $this->createdResponse([
            'payment' => $payment,
            'invoice' => $invoice->fresh(['items', 'payments', 'customer', 'user:id,name']),
        ], 'Payment recorded successfully.');
    }

    /**
     * PATCH /api/v1/invoices/{id}/status
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:DRAFT,SENT,PAID,PARTIAL,OVERDUE'],
        ]);

        $invoice = Invoice::findOrFail($id);
        $invoice->status = strtoupper($request->input('status'));
        $invoice->save();

        return $this->successResponse($invoice->load(['items', 'payments', 'customer']), 'Invoice status updated.');
    }

    /**
     * DELETE /api/v1/invoices/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);
        $invoice->delete();

        return $this->successResponse(null, 'Invoice deleted.');
    }
}
