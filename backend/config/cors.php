<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_WEB_URL', 'http://localhost:5173'),
        env('FRONTEND_MOBILE_URL', 'http://localhost:8081'),
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://localhost:8081',
        '*',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['X-Client-Mutation-Id'],

    'max_age' => 0,

    'supports_credentials' => false,

];
