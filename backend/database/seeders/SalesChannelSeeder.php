<?php

namespace Database\Seeders;

use App\Models\SalesChannel;
use Illuminate\Database\Seeder;

class SalesChannelSeeder extends Seeder
{
    public function run(): void
    {
        $channels = [
            [
                'name' => 'Main Physical Store POS',
                'code' => 'POS-MAIN',
                'type' => 'pos',
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'name' => 'Telegram - KC Shop',
                'code' => 'TG-KC-SHOP',
                'type' => 'social_media',
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'name' => 'Facebook - KC Shop',
                'code' => 'FB-KC-SHOP',
                'type' => 'social_media',
                'is_active' => true,
                'is_default' => true,
            ],
            [
                'name' => 'Facebook - KC Sport',
                'code' => 'FB-KC-SPORT',
                'type' => 'social_media',
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'name' => 'Instagram - KC Shop',
                'code' => 'IG-KC-SHOP',
                'type' => 'social_media',
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'name' => 'TikTok - KC Shop',
                'code' => 'TIKTOK-KC-SHOP',
                'type' => 'social_media',
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'name' => 'Official E-Commerce Web',
                'code' => 'WEB-DIRECT',
                'type' => 'online',
                'is_active' => true,
                'is_default' => false,
            ],
        ];

        foreach ($channels as $channel) {
            $sc = SalesChannel::firstOrNew(['code' => $channel['code']]);
            $sc->name = $channel['name'];
            $sc->type = $channel['type'];
            $sc->is_active = $channel['is_active'];
            $sc->is_default = $channel['is_default'];
            $sc->save();
        }

        // If no default exists, set Facebook - KC Shop or first one as default
        if (!SalesChannel::where('is_default', true)->exists()) {
            $default = SalesChannel::where('code', 'FB-KC-SHOP')->first() ?? SalesChannel::first();
            if ($default) {
                $default->update(['is_default' => true]);
            }
        }
    }
}
