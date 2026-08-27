<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends BaseApiController
{
    /**
     * Return application health status.
     */
    public function check(): JsonResponse
    {
        try {
            DB::connection()->getPdo();

            return $this->successResponse([
                'status'    => 'healthy',
                'version'   => 'v1',
                'app'       => config('app.name'),
                'timestamp' => now()->toIso8601String(),
                'database'  => config('database.default'),
            ], 'System is healthy.');
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'data'    => [
                    'status'    => 'unhealthy',
                    'error'     => $e->getMessage(),
                    'app'       => config('app.name'),
                    'timestamp' => now()->toIso8601String(),
                    'database'  => config('database.default'),
                ],
                'message' => 'Database connection failed: ' . $e->getMessage(),
            ], 503);
        }
    }
}
