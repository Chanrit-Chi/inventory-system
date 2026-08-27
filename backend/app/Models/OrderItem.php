<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'order_items';

    protected $fillable = [
        'order_id',
        'product_id',
        'variant_id',
        'quantity',
        'unit_price',
        'total_price',
        'subtotal',
        'discount_amount',
        'final_amount',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'total_price' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'final_amount' => 'decimal:2',
        ];
    }

    public function setTotalPriceAttribute($value): void
    {
        $this->attributes['total_price'] = $value;
        if (!isset($this->attributes['final_amount'])) {
            $this->attributes['final_amount'] = $value;
        }
        if (!isset($this->attributes['subtotal'])) {
            $this->attributes['subtotal'] = $value;
        }
    }

    public function setFinalAmountAttribute($value): void
    {
        $this->attributes['final_amount'] = $value;
        if (!isset($this->attributes['total_price'])) {
            $this->attributes['total_price'] = $value;
        }
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id')->withTrashed();
    }
}
