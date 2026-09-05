<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends BaseApiController
{
    /**
     * Return application health and live system diagnostics.
     */
    public function check(): JsonResponse
    {
        $dbStart = microtime(true);
        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');
            $dbDurationMs = round((microtime(true) - $dbStart) * 1000, 2);

            return $this->successResponse([
                'status'              => 'healthy',
                'version'             => 'v1',
                'app'                 => config('app.name'),
                'timestamp'           => now()->toIso8601String(),
                'server_time'         => now()->format('Y-m-d H:i:s T'),
                'database'            => config('database.default'),
                'database_driver'     => DB::connection()->getDriverName(),
                'database_status'     => 'connected',
                'database_latency_ms' => $dbDurationMs,
                'queue_driver'        => config('queue.default', 'sync'),
                'cache_driver'        => config('cache.default', 'file'),
                'environment'         => app()->environment(),
                'php_version'         => PHP_VERSION,
                'laravel_version'     => app()->version(),
                'timezone'            => config('app.timezone', 'UTC'),
                'debug_mode'          => config('app.debug', false),
            ], 'System is healthy.');
        } catch (\Throwable $e) {
            $dbDurationMs = round((microtime(true) - $dbStart) * 1000, 2);

            return response()->json([
                'success' => false,
                'data'    => [
                    'status'              => 'unhealthy',
                    'version'             => 'v1',
                    'error'               => $e->getMessage(),
                    'app'                 => config('app.name'),
                    'timestamp'           => now()->toIso8601String(),
                    'server_time'         => now()->format('Y-m-d H:i:s T'),
                    'database'            => config('database.default'),
                    'database_status'     => 'disconnected',
                    'database_latency_ms' => $dbDurationMs,
                    'queue_driver'        => config('queue.default', 'sync'),
                    'cache_driver'        => config('cache.default', 'file'),
                    'environment'         => app()->environment(),
                    'php_version'         => PHP_VERSION,
                    'laravel_version'     => app()->version(),
                ],
                'message' => 'Database connection failed: ' . $e->getMessage(),
            ], 503);
        }
    }
}
