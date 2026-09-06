<?php

use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'success' => true,
        'message' => 'KC Shop POS and Inventory Management System API',
    ]);
});

Route::get('/health', [HealthController::class, 'check']);

Route::get('/telegram/app', function () {
    return view('telegram.miniapp');
});

