<?php

namespace App\Listeners;

use App\Events\InvoicePaymentRecorded;
use App\Events\OrderCancelled;
use App\Events\OrderPlaced;
use App\Events\OrderStatusChanged;
use App\Events\StockAdjusted;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class LogAuditTrailListener
{
    /**
     * Handle the event.
     */
    public function handle(object $event): void
    {
        try {
            $user = Auth::user();
            $actorName = $user?->name ?? 'System';
            $actorRole = $user?->role ?? 'SYSTEM';

            if ($event instanceof OrderPlaced) {
                AuditLog::create([
                    'id'          => (string) Str::uuid(),
                    'source_type' => 'ORDER',
                    'source_id'   => (string) $event->order->id,
                    'action'      => 'ORDER_CHECKOUT',
                    'category'    => 'ORDERS',
                    'target'      => "Order #{$event->order->order_number}",
                    'actor_name'  => $actorName,
                    'actor_role'  => $actorRole,
                    'details'     => "Order #{$event->order->order_number} created with total \${$event->order->total_amount}",
                    'metadata'    => [
                        'order_number' => $event->order->order_number,
                        'total_amount' => $event->order->total_amount,
                        'status'       => $event->order->status,
                    ],
                    'occurred_at' => now(),
                ]);
            } elseif ($event instanceof OrderCancelled) {
                AuditLog::create([
                    'id'          => (string) Str::uuid(),
                    'source_type' => 'ORDER',
                    'source_id'   => (string) $event->order->id,
                    'action'      => 'ORDER_CANCELLED',
                    'category'    => 'ORDERS',
                    'target'      => "Order #{$event->order->order_number}",
                    'actor_name'  => $actorName,
                    'actor_role'  => $actorRole,
                    'details'     => "Order #{$event->order->order_number} cancelled: " . ($event->reason ?? 'No reason provided'),
                    'metadata'    => [
                        'order_number' => $event->order->order_number,
                        'reason'       => $event->reason,
                        'status'       => 'CANCELLED',
                    ],
                    'occurred_at' => now(),
                ]);
            } elseif ($event instanceof OrderStatusChanged) {
                AuditLog::create([
                    'id'          => (string) Str::uuid(),
                    'source_type' => 'ORDER',
                    'source_id'   => (string) $event->order->id,
                    'action'      => 'ORDER_STATUS_CHANGED',
                    'category'    => 'ORDERS',
                    'target'      => "Order #{$event->order->order_number}",
                    'actor_name'  => $actorName,
                    'actor_role'  => $actorRole,
                    'details'     => "Order status updated from {$event->oldStatus} to {$event->newStatus}",
                    'metadata'    => [
                        'old_status' => $event->oldStatus,
                        'new_status' => $event->newStatus,
                    ],
                    'occurred_at' => now(),
                ]);
            } elseif ($event instanceof StockAdjusted) {
                $variant = $event->variant;
                $prodName = $variant->product?->name ?? 'Product';
                $sku = $variant->sku ?? 'SKU';
                AuditLog::create([
                    'id'          => (string) Str::uuid(),
                    'source_type' => 'STOCK_MOVEMENT',
                    'source_id'   => (string) $variant->id,
                    'action'      => 'STOCK_ADJUSTMENT',
                    'category'    => 'INVENTORY',
                    'target'      => "{$prodName} ({$sku})",
                    'actor_name'  => $actorName,
                    'actor_role'  => $actorRole,
                    'details'     => "Adjusted stock for {$prodName} ({$sku}) to {$variant->quantity_on_hand} units",
                    'metadata'    => [
                        'variant_id'   => $variant->id,
                        'sku'          => $sku,
                        'new_quantity' => $variant->quantity_on_hand,
                    ],
                    'occurred_at' => now(),
                ]);
            } elseif ($event instanceof InvoicePaymentRecorded) {
                AuditLog::create([
                    'id'          => (string) Str::uuid(),
                    'source_type' => 'INVOICE',
                    'source_id'   => (string) $event->invoice->id,
                    'action'      => 'INVOICE_PAYMENT_RECORDED',
                    'category'    => 'BILLING',
                    'target'      => "Invoice #{$event->invoice->invoice_number}",
                    'actor_name'  => $actorName,
                    'actor_role'  => $actorRole,
                    'details'     => "Recorded payment of \${$event->payment->amount} for Invoice #{$event->invoice->invoice_number}",
                    'metadata'    => [
                        'invoice_number' => $event->invoice->invoice_number,
                        'amount'         => $event->payment->amount,
                        'payment_method' => $event->payment->payment_method,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            // Audit logging should never break critical transactional flow
        }
    }
}
