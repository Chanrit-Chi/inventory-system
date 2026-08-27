<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'invoices';

    protected $fillable = [
        'invoice_number',
        'order_id',
        'order_number',
        'customer_id',
        'customer_name',
        'customer_phone',
        'status',
        'total_amount',
        'amount_paid',
        'balance_due',
        'due_date',
        'notes',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'balance_due' => 'decimal:2',
            'due_date' => 'date:Y-m-d',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Invoice $invoice) {
            $invoice->items()->delete();
            $invoice->payments()->delete();
        });

        static::restoring(function (Invoice $invoice) {
            $invoice->items()->withTrashed()->restore();
            $invoice->payments()->withTrashed()->restore();
        });
    }

    public static function generateInvoiceNumber(): string
    {
        $year = date('Y');
        $count = self::whereYear('created_at', $year)->count() + 1;
        return sprintf('INV-%s-%04d', $year, $count);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class, 'invoice_id')->orderBy('paid_at', 'desc');
    }

    /**
     * Record payment transaction and automatically recalculate amounts and status.
     */
    public function recordPayment(
        float $amount,
        string $paymentMethod = 'Cash',
        ?string $transactionRef = null,
        ?string $recordedBy = null,
        ?string $notes = null
    ): InvoicePayment {
        $payment = $this->payments()->create([
            'amount' => $amount,
            'payment_method' => $paymentMethod,
            'transaction_ref' => $transactionRef,
            'paid_at' => now(),
            'recorded_by' => $recordedBy,
            'notes' => $notes,
        ]);

        $this->amount_paid = (float) $this->payments()->sum('amount');
        $this->balance_due = max(0, (float) $this->total_amount - $this->amount_paid);

        if ($this->balance_due <= 0) {
            $this->status = 'PAID';
        } elseif ($this->amount_paid > 0) {
            $this->status = 'PARTIAL';
        }

        $this->save();

        return $payment;
    }
}
