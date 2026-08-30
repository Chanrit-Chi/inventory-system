<?php

namespace App\Enums;

enum MovementType: string
{
    case SALE = 'SALE';
    case RESTOCK = 'RESTOCK';
    case PURCHASE_RECEIPT = 'PURCHASE_RECEIPT';
    case ADJUSTMENT = 'ADJUSTMENT';
    case RETURN = 'RETURN';
    case DAMAGE = 'DAMAGE';

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
