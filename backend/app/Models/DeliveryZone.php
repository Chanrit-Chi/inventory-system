<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryZone extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'delivery_zones';

    protected $fillable = [
        'name',
        'cost',
        'is_active',
        'is_default',
    ];

    protected $appends = [
        'isActive',
        'isDefault',
    ];

    protected function casts(): array
    {
        return [
            'cost'       => 'float',
            'is_active'  => 'boolean',
            'is_default' => 'boolean',
        ];
    }

    public function getIsActiveAttribute(): bool
    {
        return (bool) ($this->attributes['is_active'] ?? true);
    }

    public function getIsDefaultAttribute(): bool
    {
        return (bool) ($this->attributes['is_default'] ?? false);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
