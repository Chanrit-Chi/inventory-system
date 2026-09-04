<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushToken extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'push_tokens';

    protected $fillable = [
        'user_id',
        'token',
        'device_name',
        'device_type',
        'platform',
    ];

    /**
     * Get the user that owns the push token.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Mutator to keep platform and device_type synchronized.
     */
    public function setPlatformAttribute(?string $value): void
    {
        $this->attributes['platform'] = $value;
        if (empty($this->attributes['device_type']) && !empty($value)) {
            $this->attributes['device_type'] = $value;
        }
    }

    /**
     * Mutator to keep device_type and platform synchronized.
     */
    public function setDeviceTypeAttribute(?string $value): void
    {
        $this->attributes['device_type'] = $value;
        if (empty($this->attributes['platform']) && !empty($value)) {
            $this->attributes['platform'] = $value;
        }
    }
}
