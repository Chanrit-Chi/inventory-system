<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class VerifyTelegramWebhook
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        $secretToken = Config::get('services.telegram.webhook_secret');

        // If no secret is configured, skip verification (for development)
        if (empty($secretToken)) {
            return $next($request);
        }

        // Get the secret token from the header
        $incomingSecret = $request->header('X-Telegram-Bot-Api-Secret-Token');

        // Verify the secret token using hash_equals for timing attack prevention
        if (!$incomingSecret || !hash_equals($secretToken, (string) $incomingSecret)) {
            Log::warning('Invalid Telegram webhook secret token');
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        return $next($request);
    }
}