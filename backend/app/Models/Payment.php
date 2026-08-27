<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'payments';

    protected $fillable = [
        'order_id',
        'payment_method',
        'amount',
        'transaction_ref',
        'reference_number',
        'proof_image_url',
        'status',
        'created_at',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function setTransactionRefAttribute($value): void
    {
        $this->attributes['transaction_ref'] = $value;
        if (!isset($this->attributes['reference_number'])) {
            $this->attributes['reference_number'] = $value;
        }
    }

    public function setReferenceNumberAttribute($value): void
    {
        $this->attributes['reference_number'] = $value;
        if (!isset($this->attributes['transaction_ref'])) {
            $this->attributes['transaction_ref'] = $value;
        }
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function scopeByMethod($query, string $method)
    {
        return $query->where('payment_method', $method);
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }
}
