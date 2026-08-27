<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BankAccount extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'bank_accounts';

    protected $fillable = [
        'bank_name',
        'account_name',
        'account_number',
        'qr_image_url',
        'currency',
        'is_default',
        'is_active',
        'color',
        'logo_icon',
    ];

    protected $appends = [
        'bankName',
        'accountName',
        'accountNumber',
        'qrImageUrl',
        'isDefault',
        'isActive',
        'logoIcon',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active'  => 'boolean',
        ];
    }

    public function getBankNameAttribute(): string
    {
        return $this->attributes['bank_name'] ?? '';
    }

    public function getAccountNameAttribute(): string
    {
        return $this->attributes['account_name'] ?? '';
    }

    public function getAccountNumberAttribute(): string
    {
        return $this->attributes['account_number'] ?? '';
    }

    public function getQrImageUrlAttribute(): ?string
    {
        return $this->attributes['qr_image_url'] ?? null;
    }

    public function getIsDefaultAttribute(): bool
    {
        return (bool) ($this->attributes['is_default'] ?? false);
    }

    public function getIsActiveAttribute(): bool
    {
        return (bool) ($this->attributes['is_active'] ?? true);
    }

    public function getLogoIconAttribute(): ?string
    {
        return $this->attributes['logo_icon'] ?? 'qr-code';
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
