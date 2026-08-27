<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesChannel extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'sales_channels';

    protected $fillable = [
        'name',
        'platform',
        'code',
        'type',
        'image_url',
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

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'channel_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
