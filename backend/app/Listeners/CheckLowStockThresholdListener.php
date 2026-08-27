<?php

namespace App\Listeners;

use App\Events\LowStockDetected;
use App\Events\OrderPlaced;
use App\Events\StockAdjusted;

class CheckLowStockThresholdListener
{
    /**
     * Handle the event.
     */
    public function handle(object $event): void
    {
        if ($event instanceof StockAdjusted) {
            $variant = $event->variant;
            if ($variant && $variant->quantity_on_hand <= ($variant->reorder_level ?? 5)) {
                LowStockDetected::dispatch($variant, (int) $variant->quantity_on_hand, (int) ($variant->reorder_level ?? 5));
            }
        } elseif ($event instanceof OrderPlaced) {
            $order = $event->order;
            if ($order && $order->relationLoaded('items')) {
                foreach ($order->items as $item) {
                    $variant = $item->variant;
                    if ($variant && $variant->quantity_on_hand <= ($variant->reorder_level ?? 5)) {
                        LowStockDetected::dispatch($variant, (int) $variant->quantity_on_hand, (int) ($variant->reorder_level ?? 5));
                    }
                }
            }
        }
    }
}
