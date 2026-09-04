<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PushTokenController extends BaseApiController
{
    /**
     * POST /api/v1/push-tokens
     *
     * Register or update a push notification token for the authenticated user.
     * Automatically handles token reassignment if the device was previously
     * registered to a different user.
     */
    public function store(Request $request): JsonResponse
    {
        // Normalize platform casing if provided
        if ($request->has('platform') && is_string($request->input('platform'))) {
            $request->merge([
                'platform' => strtolower(trim($request->input('platform'))),
            ]);
        }

        // Trim token if provided
        if ($request->has('token') && is_string($request->input('token'))) {
            $request->merge([
                'token' => trim($request->input('token')),
            ]);
        }

        $validated = $request->validate([
            'token'       => ['required', 'string', 'min:10', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'device_type' => ['nullable', 'string', 'max:255'],
            'platform'    => ['nullable', 'string', Rule::in(['android', 'ios', 'web', 'unknown'])],
        ]);

        $user = $request->user();
        $deviceName = $validated['device_name'] ?? $validated['device_type'] ?? null;

        $pushToken = PushToken::updateOrCreate(
            ['token' => $validated['token']],
            [
                'user_id'     => $user->id,
                'device_name' => $deviceName,
                'platform'    => $validated['platform'] ?? null,
            ]
        );

        return $this->successResponse(
            $pushToken,
            'Push token registered successfully.',
            200
        );
    }

    /**
     * DELETE /api/v1/push-tokens/{token}
     *
     * Deregister a push notification token on device logout or cleanup.
     * Handles raw or URL-encoded token strings idempotently.
     */
    public function destroy(Request $request, string $token): JsonResponse
    {
        $decodedToken = trim(urldecode($token));

        if ($decodedToken === '') {
            return $this->errorResponse('Push token is required.', null, 422);
        }

        $user = $request->user();

        $query = PushToken::where(function ($q) use ($token, $decodedToken) {
            $q->where('token', $decodedToken)
              ->orWhere('token', $token);
        });

        if ($user) {
            $query->where('user_id', $user->id);
        }

        $query->delete();

        return $this->successResponse(null, 'Push token deregistered successfully.');
    }
}
