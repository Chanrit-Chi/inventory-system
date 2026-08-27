<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\DeliveryCompany;
use App\Models\DeliveryZone;
use Illuminate\Database\Seeder;

class DeliveryAndBankSeeder extends Seeder
{
    public function run(): void
    {
        if (DeliveryCompany::count() === 0) {
            DeliveryCompany::create([
                'name'       => 'J&T Express',
                'phone'      => '+855 23 999 123',
                'logo_icon'  => 'car',
                'color'      => '#DC2626',
                'is_active'  => true,
                'is_default' => true,
                'notes'      => 'Next day express delivery nationwide',
            ]);

            DeliveryCompany::create([
                'name'       => 'VET Express (Vireak Buntham)',
                'phone'      => '+855 23 888 456',
                'logo_icon'  => 'bus',
                'color'      => '#0284C7',
                'is_active'  => true,
                'is_default' => false,
                'notes'      => 'Bus cargo and parcel delivery across provinces',
            ]);

            DeliveryCompany::create([
                'name'       => 'Grab Express',
                'phone'      => '+855 23 777 888',
                'logo_icon'  => 'bicycle',
                'color'      => '#16A34A',
                'is_active'  => true,
                'is_default' => false,
                'notes'      => 'Instant on-demand motorbike delivery',
            ]);
        }

        if (DeliveryZone::count() === 0) {
            DeliveryZone::create([
                'name'       => 'Phnom Penh (Urban / Central)',
                'cost'       => 1.50,
                'is_active'  => true,
                'is_default' => true,
            ]);

            DeliveryZone::create([
                'name'       => 'Phnom Penh (Suburbs / Outskirts)',
                'cost'       => 2.00,
                'is_active'  => true,
                'is_default' => false,
            ]);

            DeliveryZone::create([
                'name'       => 'Provinces (Standard Cargo)',
                'cost'       => 2.50,
                'is_active'  => true,
                'is_default' => false,
            ]);
        }

        if (BankAccount::count() === 0) {
            BankAccount::create([
                'bank_name'      => 'ABA Bank',
                'account_name'   => 'KC INVENTORY STORE',
                'account_number' => '000 123 456',
                'currency'       => 'USD',
                'qr_image_url'   => 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ABA%3A000123456%3AKC%20INVENTORY%20STORE',
                'is_default'     => true,
                'is_active'      => true,
                'color'          => '#005F83',
                'logo_icon'      => 'qr-code',
            ]);

            BankAccount::create([
                'bank_name'      => 'ACLEDA Bank',
                'account_name'   => 'KC INVENTORY STORE',
                'account_number' => '1122 3344 5566',
                'currency'       => 'Dual',
                'qr_image_url'   => 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ACLEDA%3A112233445566%3AKC%20INVENTORY%20STORE',
                'is_default'     => false,
                'is_active'      => true,
                'color'          => '#0D3880',
                'logo_icon'      => 'business',
            ]);
        }
    }
}
