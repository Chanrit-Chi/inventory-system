<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    use HasUuids;

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
        if (!empty($this->metadata['ip'])) {
            return $this->metadata['ip'];
        }
        if (!empty($this->metadata['ip_address'])) {
            return $this->metadata['ip_address'];
        }
        if ($this->details && str_contains($this->details, 'IP: ')) {
            $parts = explode('IP: ', $this->details);
            if (isset($parts[1])) {
                return trim(explode(' ', $parts[1])[0]);
            }
        }
        return null;
    }

    public function getDeviceAttribute(): ?string
    {
        if (!empty($this->metadata['device'])) {
            return $this->metadata['device'];
        }
        if (!empty($this->metadata['user_agent'])) {
            return $this->metadata['user_agent'];
        }
        if ($this->details && str_contains($this->details, 'Device: ')) {
            $parts = explode('Device: ', $this->details);
            if (isset($parts[1])) {
                return trim(explode(' •', $parts[1])[0]);
            }
        }
        return null;
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