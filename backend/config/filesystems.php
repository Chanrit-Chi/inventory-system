<?php

return [

    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL') . '/storage',
            'visibility' => 'public',
            'throw' => false,
        ],

        'r2' => [
            'driver' => 's3',
            'key' => env('CLOUDFLARE_R2_ACCESS_KEY_ID'),
            'secret' => env('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
            'region' => 'auto',
            'bucket' => env('CLOUDFLARE_R2_BUCKET'),
            'url' => env('CLOUDFLARE_R2_URL'),
            'endpoint' => env('CLOUDFLARE_R2_ENDPOINT'),
            'use_path_style_endpoint' => env('CLOUDFLARE_R2_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],

        'supabase' => [
            'driver' => 's3',
            'key' => env('SUPABASE_STORAGE_ACCESS_KEY_ID'),
            'secret' => env('SUPABASE_STORAGE_SECRET_ACCESS_KEY'),
            'region' => env('SUPABASE_STORAGE_REGION', 'us-east-1'),
            'bucket' => env('SUPABASE_STORAGE_BUCKET', 'inventory-assets'),
            'url' => env('SUPABASE_STORAGE_PUBLIC_URL'),
            'endpoint' => env('SUPABASE_STORAGE_ENDPOINT'),
            'use_path_style_endpoint' => true,
            'throw' => false,
        ],

    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
