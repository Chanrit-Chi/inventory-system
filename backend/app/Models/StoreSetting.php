<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoreSetting extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'store_settings';

    protected $fillable = [
        'store_name',
        'tagline',
        'logo_url',
        'primary_color',
        'store_address',
        'store_phone',
        'receipt_header',
        'invoice_header',
        'quotation_header',
        'receipt_footer',
        'show_tax',
    ];

    protected $casts = [
        'show_tax' => 'boolean',
    ];

    /**
     * Get or create the global singleton store setting row
     */
    public static function current(): self
    {
        $setting = self::first();
        if (!$setting) {
            $setting = self::create([
                'store_name'       => 'KC Inventory',
                'tagline'          => '',
                'logo_url'         => null,
                'primary_color'    => '#FF8800',
                'store_address'    => 'Phnom Penh, Cambodia',
                'store_phone'      => '+855 12 345 678',
                'receipt_header'   => null,
                'invoice_header'   => null,
                'quotation_header' => null,
                'receipt_footer'   => 'Thank you for your business! Please visit again.',
                'show_tax'         => false,
            ]);
        }
        return $setting;
    }
}
