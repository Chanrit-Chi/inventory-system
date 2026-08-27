<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttributeValue extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'attribute_values';

    protected $fillable = [
        'attribute_id',
        'value_name',
        'value',
        'code',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function setValueAttribute($value): void
    {
        $this->attributes['value'] = $value;
        if (empty($this->attributes['value_name'])) {
            $this->attributes['value_name'] = $value;
        }
    }

    public function setValueNameAttribute($value): void
    {
        $this->attributes['value_name'] = $value;
        if (empty($this->attributes['value'])) {
            $this->attributes['value'] = $value;
        }
    }

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class, 'attribute_id');
    }

    public function variantAttributeValues(): HasMany
    {
        return $this->hasMany(VariantAttributeValue::class, 'attribute_value_id');
    }

    public function variants(): BelongsToMany
    {
        return $this->belongsToMany(ProductVariant::class, 'variant_attribute_values', 'attribute_value_id', 'variant_id');
    }
}
