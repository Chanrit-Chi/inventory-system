<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'products';

    protected $fillable = [
        'category_id',
        'name',
        'sku',
        'barcode',
        'description',
        'purchase_price',
        'cost_price',
        'selling_price',
        'default_reorder_level',
        'image_url',
        'is_active',
        'is_composite',
    ];

    protected function casts(): array
    {
        return [
            'purchase_price' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'default_reorder_level' => 'integer',
            'is_active' => 'boolean',
            'is_composite' => 'boolean',
        ];
    }

    public function setPurchasePriceAttribute($value): void
    {
        $this->attributes['purchase_price'] = $value;
        if (!isset($this->attributes['cost_price'])) {
            $this->attributes['cost_price'] = $value;
        }
    }

    public function setCostPriceAttribute($value): void
    {
        $this->attributes['cost_price'] = $value;
        if (!isset($this->attributes['purchase_price'])) {
            $this->attributes['purchase_price'] = $value;
        }
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function productAttributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class, 'product_id');
    }

    public function attributes(): BelongsToMany
    {
        return $this->belongsToMany(Attribute::class, 'product_attributes', 'product_id', 'attribute_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class, 'product_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'product_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'product_id');
    }

    public function restockDetails(): HasMany
    {
        return $this->hasMany(RestockDetail::class, 'product_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeComposite($query)
    {
        return $query->where('is_composite', true);
    }

    /**
     * Scope to eager load variants with attribute values.
     */
    public function scopeWithVariants($query)
    {
        return $query->with(['variants.attributeValues.attribute']);
    }

    /**
     * Scope to eager load category.
     */
    public function scopeWithCategory($query)
    {
        return $query->with('category');
    }

    /**
     * Scope for product listing with common relations.
     */
    public function scopeForListing($query)
    {
        return $query->with(['variants.attributeValues.attribute', 'category'])
            ->whereNull('deleted_at');
    }

    /**
     * Scope for product detail with full relations.
     */
    public function scopeForDetail($query)
    {
        return $query->with([
            'variants.attributeValues.attribute',
            'category',
            'productAttributes.attribute',
        ])->whereNull('deleted_at');
    }
}
