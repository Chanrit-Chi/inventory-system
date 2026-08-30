<?php

namespace App\Observers;

use App\Models\StockMovement;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\Log;

class StockMovementObserver
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function created(StockMovement $movement): void
    {
        try {
            $this->auditLogService->syncStockMovement($movement);
        } catch (\Throwable $e) {
            Log::error('Failed to sync stock movement to audit log', [
                'movement_id' => $movement->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Don't rethrow - audit sync failure shouldn't block main transaction
        }
    }
}