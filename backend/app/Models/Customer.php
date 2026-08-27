<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'customers';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'phone_normalized',
        'address',
        'total_purchased',
        'total_spent',
        'last_purchase_at',
    ];

    protected function casts(): array
    {
        return [
            'total_purchased' => 'integer',
            'total_spent'     => 'decimal:2',
            'last_purchase_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Customer $customer) {
            if ($customer->phone) {
                $customer->phone_normalized = preg_replace('/\D/', '', $customer->phone);
            }
        });
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'customer_id');
    }
}
