<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PENDING = 'PENDING';
    case COMPLETED = 'COMPLETED';
    case CANCELLED = 'CANCELLED';
    case REFUNDED = 'REFUNDED';

    /**
     * Get all enum values as an array.
     *
     * @return array<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
