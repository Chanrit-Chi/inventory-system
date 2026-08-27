<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'expenses';

    protected $fillable = [
        'payroll_id',
        'user_id',
        'created_by',
        'title',
        'amount',
        'category',
        'payment_method',
        'notes',
        'expense_date',
    ];

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

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'expense_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function payroll(): BelongsTo
    {
        return $this->belongsTo(Payroll::class, 'payroll_id');
    }

    public function scopeByCategory($query, string $category)
    {
        return $query->where('category', $category);
    }
}
