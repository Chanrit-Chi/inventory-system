<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryCompany extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'delivery_companies';

    protected $fillable = [
        'name',
        'phone',
        'logo_icon',
        'color',
        'is_active',
        'is_default',
        'notes',
    ];

    protected $appends = [
        'logoIcon',
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

    public function getLogoIconAttribute(): ?string
    {
        return $this->attributes['logo_icon'] ?? 'car';
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
