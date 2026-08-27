<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestockSession extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'restock_sessions';

    protected $fillable = [
        'session_code',
        'session_date',
        'user_id',
        'created_by',
        'status',
        'total_cost',
        'notes',
        'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'datetime',
            'total_cost' => 'decimal:2',
            'confirmed_at' => 'datetime',
        ];
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(RestockDetail::class, 'restock_session_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeConfirmed($query)
    {
        return $query->where('status', 'confirmed');
    }
}
