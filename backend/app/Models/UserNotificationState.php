<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotificationState extends Model
{
    use HasFactory;

    protected $table = 'user_notification_states';

    protected $fillable = [
        'user_id',
        'notification_key',
        'is_read',
        'is_dismissed',
        'read_at',
        'dismissed_at',
    ];

    protected $casts = [
        'is_read'      => 'boolean',
        'is_dismissed' => 'boolean',
        'read_at'      => 'datetime',
        'dismissed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
