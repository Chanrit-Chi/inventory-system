<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'product_variants';

    protected $fillable = [
        'product_id',
        'name',
        'sku',
        'barcode',
        'cost_price_override',
        'selling_price_override',
        'cost_price',
        'selling_price',
        'quantity_on_hand',
        'quantity_reserved',
        'reorder_level',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'cost_price_override' => 'decimal:2',
            'selling_price_override' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'quantity_on_hand' => 'integer',
            'quantity_reserved' => 'integer',
            'reorder_level' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function variantAttributeValues(): HasMany
    {
        return $this->hasMany(VariantAttributeValue::class, 'variant_id');
    }

    public function attributeValues(): BelongsToMany
    {
        return $this->belongsToMany(AttributeValue::class, 'variant_attribute_values', 'variant_id', 'attribute_value_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'variant_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'variant_id');
    }

    public function restockDetails(): HasMany
    {
        return $this->hasMany(RestockDetail::class, 'variant_id');
    }

    public function getEffectiveSellingPriceAttribute(): float
    {
        return (float) ($this->selling_price_override ?? $this->selling_price ?? $this->product?->selling_price ?? 0.00);
    }

    public function getEffectiveCostPriceAttribute(): float
    {
        return (float) ($this->cost_price_override ?? $this->cost_price ?? $this->product?->cost_price ?? $this->product?->purchase_price ?? 0.00);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to eager load product with category.
     */
    public function scopeWithProduct($query)
    {
        return $query->with(['product.category']);
    }

    /**
     * Scope to eager load attribute values with attributes.
     */
    public function scopeWithAttributeValues($query)
    {
        return $query->with(['attributeValues.attribute']);
    }

    /**
     * Scope for variant listing with common relations.
     */
    public function scopeForListing($query)
    {
        return $query->with(['product.category', 'attributeValues.attribute']);
    }
}
