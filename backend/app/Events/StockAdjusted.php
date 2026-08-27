<?php

namespace App\Events;

use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StockAdjusted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public ProductVariant $variant,
        public ?StockMovement $movement = null
    ) {}
}
