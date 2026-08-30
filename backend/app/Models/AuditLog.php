<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'source_type',
        'source_id',
        'action',
        'category',
        'target',
        'actor_name',
        'actor_role',
        'details',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'by',
        'time',
        'ip',
        'device',
    ];

    public function getByAttribute(): ?string
    {
        return $this->actor_name;
    }

    public function getTimeAttribute(): ?string
    {
        return $this->occurred_at?->toIso8601String() ?? $this->created_at?->toIso8601String();
    }

    public function getIpAttribute(): ?string
    {
        return $this->metadata['ip'] ?? null;
    }

    public function getDeviceAttribute(): ?string
    {
        return $this->metadata['device'] ?? null;
    }

    /**
     * Get the source model (polymorphic).
     */
    public function source(): MorphTo
    {
        return $this->morphTo('source', 'source_type', 'source_id');
    }

    /**
     * Scope for category filtering.
     */
    public function scopeCategory($query, string $category): void
    {
        if ($category !== 'ALL') {
            $query->where('category', $category);
        }
    }

    /**
     * Scope for date range filtering.
     */
    public function scopeDateRange($query, ?string $from, ?string $to): void
    {
        if ($from) {
            $query->whereDate('occurred_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('occurred_at', '<=', $to);
        }
    }

    /**
     * Scope for text search across multiple fields.
     */
    public function scopeSearch($query, string $search): void
    {
        $query->where(function ($q) use ($search) {
            $q->where('action', 'like', "%{$search}%")
                ->orWhere('target', 'like', "%{$search}%")
                ->orWhere('actor_name', 'like', "%{$search}%")
                ->orWhere('details', 'like', "%{$search}%");
        });
    }
}