<?php

namespace App\Observers;

use App\Models\PayrollAuditLog;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\Log;

class PayrollAuditLogObserver
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function created(PayrollAuditLog $entry): void
    {
        try {
            $this->auditLogService->syncPayrollAuditLog($entry);
        } catch (\Throwable $e) {
            Log::error('Failed to sync payroll audit log to unified audit log', [
                'payroll_audit_log_id' => $entry->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}