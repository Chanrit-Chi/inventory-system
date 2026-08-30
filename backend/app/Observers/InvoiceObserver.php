<?php

namespace App\Observers;

use App\Models\Invoice;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\Log;

class InvoiceObserver
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function created(Invoice $invoice): void
    {
        try {
            $this->auditLogService->syncInvoice($invoice);
        } catch (\Throwable $e) {
            Log::error('Failed to sync invoice create to audit log', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function updated(Invoice $invoice): void
    {
        try {
            $this->auditLogService->syncInvoice($invoice);
        } catch (\Throwable $e) {
            Log::error('Failed to sync invoice update to audit log', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function deleted(Invoice $invoice): void
    {
        try {
            $this->auditLogService->log(
                'INVOICE',
                'inv-del-' . $invoice->id,
                'INVOICE_DELETED',
                'BILLING',
                "Invoice {$invoice->invoice_number} (Deleted)",
                $invoice->user?->name ?? 'Finance Admin',
                $invoice->user?->role ?? null,
                "Invoice {$invoice->invoice_number} was deleted",
                [
                    'invoice_number' => $invoice->invoice_number,
                    'total_amount' => (float) ($invoice->total_amount ?? 0),
                ]
            );
        } catch (\Throwable $e) {
            Log::error('Failed to sync invoice delete to audit log', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}