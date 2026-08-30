<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerDailySettlement extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'seller_daily_settlements';

    protected $fillable = [
        'seller_id',
        'confirmed_date',
        'total_orders_count',
        'total_sales_amount',
        'total_incentive_amount',
        'status',
        'confirmed_at',
        'confirmed_by',
        'order_ids',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'confirmed_date'         => 'date:Y-m-d',
            'confirmed_at'           => 'datetime',
            'total_orders_count'     => 'integer',
            'total_sales_amount'     => 'decimal:2',
            'total_incentive_amount' => 'decimal:2',
            'order_ids'              => 'array',
        ];
    }

    public function setConfirmedDateAttribute($value): void
    {
        $this->attributes['confirmed_date'] = \Carbon\Carbon::parse($value)->toDateString();
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
