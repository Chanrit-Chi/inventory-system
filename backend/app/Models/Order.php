<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'orders';

    protected $fillable = [
        'order_number',
        'client_mutation_id',
        'customer_id',
        'channel_id',
        'sales_channel_id',
        'user_id',
        'seller_id',
        'created_by',
        'status',
        'completed_at',
        'payment_status',
        'subtotal',
        'tax_rate',
        'tax_amount',
        'discount',
        'discount_amount',
        'delivery_cost',
        'total_amount',
        'final_amount',
        'delivery_address',
        'region',
        'note',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'discount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'delivery_cost' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'final_amount' => 'decimal:2',
        ];
    }

    public static function generateOrderNumber(?string $year = null): string
    {
        $year = $year ?: date('Y');
        $prefix = "ORD-{$year}-";

        $latest = self::withTrashed()
            ->where('order_number', 'like', "{$prefix}%")
            ->orderByRaw('LENGTH(order_number) DESC')
            ->orderByDesc('order_number')
            ->lockForUpdate()
            ->first();

        $nextSeq = 1;
        if ($latest && preg_match('/-(\d+)$/', $latest->order_number, $matches)) {
            $nextSeq = (int) $matches[1] + 1;
        }

        do {
            $candidate = sprintf('ORD-%s-%05d', $year, $nextSeq);
            $nextSeq++;
        } while (self::withTrashed()->where('order_number', $candidate)->exists());

        return $candidate;
    }

    public function setStatusAttribute($value): void
    {
        if ($value instanceof \App\Enums\OrderStatus) {
            $this->attributes['status'] = $value->value;
        } elseif (is_string($value)) {
            $this->attributes['status'] = strtoupper($value);
        } else {
            $this->attributes['status'] = $value;
        }
    }

    public function setChannelIdAttribute($value): void
    {
        $this->attributes['channel_id'] = $value;
        if (!isset($this->attributes['sales_channel_id'])) {
            $this->attributes['sales_channel_id'] = $value;
        }
    }

    public function setSalesChannelIdAttribute($value): void
    {
        $this->attributes['sales_channel_id'] = $value;
        if (!isset($this->attributes['channel_id'])) {
            $this->attributes['channel_id'] = $value;
        }
    }

    public function setCreatedByAttribute($value): void
    {
        $this->attributes['created_by'] = $value;
        if (!isset($this->attributes['user_id'])) {
            $this->attributes['user_id'] = $value;
        }
    }

    public function setUserIdAttribute($value): void
    {
        $this->attributes['user_id'] = $value;
        if (!isset($this->attributes['created_by'])) {
            $this->attributes['created_by'] = $value;
        }
    }

    public function setNoteAttribute($value): void
    {
        $this->attributes['note'] = $value;
        if (!isset($this->attributes['notes'])) {
            $this->attributes['notes'] = $value;
        }
    }

    public function setNotesAttribute($value): void
    {
        $this->attributes['notes'] = $value;
        if (!isset($this->attributes['note'])) {
            $this->attributes['note'] = $value;
        }
    }

    public function salesChannel(): BelongsTo
    {
        return $this->belongsTo(SalesChannel::class, 'channel_id')
            ->withDefault(function ($instance, $parent) {
                return SalesChannel::find($parent->sales_channel_id);
            });
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(SalesChannel::class, 'channel_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'order_id');
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByPaymentStatus($query, string $paymentStatus)
    {
        return $query->where('payment_status', $paymentStatus);
    }
}
