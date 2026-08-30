<?php

namespace App\Observers;

use App\Models\Order;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\Log;

class OrderObserver
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function created(Order $order): void
    {
        try {
            $this->auditLogService->syncOrder($order);
        } catch (\Throwable $e) {
            Log::error('Failed to sync order create to audit log', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function updated(Order $order): void
    {
        try {
            $this->auditLogService->syncOrder($order);
        } catch (\Throwable $e) {
            Log::error('Failed to sync order update to audit log', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function deleted(Order $order): void
    {
        try {
            $this->auditLogService->log(
                'ORDER',
                'ord-del-' . $order->id,
                'ORDER_DELETED',
                'ORDERS',
                "Order {$order->order_number} (Deleted)",
                $order->user?->name ?? 'System Staff',
                $order->user?->role ?? null,
                "Order {$order->order_number} was deleted",
                [
                    'order_number' => $order->order_number,
                    'total_amount' => (float) ($order->total_amount ?? 0),
                ]
            );
        } catch (\Throwable $e) {
            Log::error('Failed to sync order delete to audit log', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}