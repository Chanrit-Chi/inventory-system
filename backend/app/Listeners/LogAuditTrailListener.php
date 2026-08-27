<?php

namespace App\Listeners;

use App\Events\InvoicePaymentRecorded;
use App\Events\OrderPlaced;
use App\Events\OrderStatusChanged;
use App\Events\StockAdjusted;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

class LogAuditTrailListener
{
    /**
     * Handle the event.
     */
    public function handle(object $event): void
    {
        try {
            $userId = Auth::id();

            if ($event instanceof OrderPlaced) {
                AuditLog::create([
                    'action'        => 'ORDER_CHECKOUT',
                    'module'        => 'orders',
                    'record_id'     => (string) $event->order->id,
                    'user_id'       => $userId ?: $event->order->user_id,
                    'payload_after' => [
                        'order_number' => $event->order->order_number,
                        'total_amount' => $event->order->total_amount,
                        'status'       => $event->order->status,
                    ],
                ]);
            } elseif ($event instanceof OrderStatusChanged) {
                AuditLog::create([
                    'action'         => 'ORDER_STATUS_CHANGED',
                    'module'         => 'orders',
                    'record_id'      => (string) $event->order->id,
                    'user_id'        => $userId ?: $event->order->user_id,
                    'payload_before' => ['status' => $event->oldStatus],
                    'payload_after'  => ['status' => $event->newStatus],
                ]);
            } elseif ($event instanceof StockAdjusted) {
                AuditLog::create([
                    'action'        => 'STOCK_ADJUSTED',
                    'module'        => 'inventory',
                    'record_id'     => (string) $event->variant->id,
                    'user_id'       => $userId,
                    'payload_after' => [
                        'sku'          => $event->variant->sku,
                        'new_quantity' => $event->variant->quantity_on_hand,
                    ],
                ]);
            } elseif ($event instanceof InvoicePaymentRecorded) {
                AuditLog::create([
                    'action'        => 'INVOICE_PAYMENT_RECORDED',
                    'module'        => 'invoices',
                    'record_id'     => (string) $event->invoice->id,
                    'user_id'       => $userId,
                    'payload_after' => [
                        'invoice_number' => $event->invoice->invoice_number,
                        'amount'         => $event->payment->amount,
                        'payment_method' => $event->payment->payment_method,
                    ],
                ]);
            }
        } catch (\Throwable $e) {
            // Audit logging should never break critical transactional flow
        }
    }
}
