<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quotation extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'quotations';

    protected $fillable = [
        'quotation_number',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'status',
        'subtotal',
        'discount',
        'total_amount',
        'notes',
        'valid_until',
        'converted_order_id',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'valid_until' => 'date:Y-m-d',
        ];
    }

    public static function generateQuotationNumber(?string $year = null): string
    {
        $year = $year ?: date('Y');
        $prefix = "QT-{$year}-";

        $latest = self::withTrashed()
            ->where('quotation_number', 'like', "{$prefix}%")
            ->orderByRaw('LENGTH(quotation_number) DESC')
            ->orderByDesc('quotation_number')
            ->lockForUpdate()
            ->first();

        $nextSeq = 1;
        if ($latest && preg_match('/-(\d+)$/', $latest->quotation_number, $matches)) {
            $nextSeq = (int) $matches[1] + 1;
        }

        do {
            $candidate = sprintf('QT-%s-%05d', $year, $nextSeq);
            $nextSeq++;
        } while (self::withTrashed()->where('quotation_number', $candidate)->exists());

        return $candidate;
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function convertedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'converted_order_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class, 'quotation_id');
    }
}
