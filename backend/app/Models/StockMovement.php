<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory, HasUuids;

    // Disabling UPDATED_AT ensures immutable append-only audit logging
    const UPDATED_AT = null;

    protected $table = 'stock_movements';

    protected $fillable = [
        'product_id',
        'variant_id',
        'movement_type',
        'type',
        'quantity_change',
        'quantity_before',
        'quantity_after',
        'reference_id',
        'notes',
        'user_id',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity_change' => 'integer',
            'quantity_before' => 'integer',
            'quantity_after' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function setMovementTypeAttribute($value): void
    {
        $this->attributes['movement_type'] = $value;
        if (!isset($this->attributes['type'])) {
            $this->attributes['type'] = strtolower($value);
        }
    }

    public function setTypeAttribute($value): void
    {
        $this->attributes['type'] = $value;
        if (!isset($this->attributes['movement_type'])) {
            $this->attributes['movement_type'] = strtoupper($value);
        }
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id')->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByProduct($query, string $productId)
    {
        return $query->where('product_id', $productId);
    }

    public function scopeByVariant($query, string $variantId)
    {
        return $query->where('variant_id', $variantId);
    }
}
