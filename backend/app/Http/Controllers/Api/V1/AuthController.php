<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends BaseApiController
{
    /**
     * POST /api/v1/auth/login
     * Authenticate user credentials, verify active account status, and issue a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'       => ['required', 'string', 'email'],
            'password'    => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $email = strtolower(trim($credentials['email']));
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            return $this->errorResponse(
                'Your account has been deactivated. Contact an administrator.',
                null,
                403
            );
        }

        // Determine device/client token name and IP
        $rawDevice = trim((string) $request->input('device_name', ''));
        $deviceName = $rawDevice !== '' ? $rawDevice : 'mobile';
        $ip = $request->ip() ?: '127.0.0.1';

        // Clean up previous tokens for this specific device name to prevent token bloat
        $user->tokens()->where('name', $deviceName)->delete();

        // Create new Bearer token with full access abilities and client IP recorded
        $token = $user->createToken($deviceName, ['*', 'ip:' . $ip])->plainTextToken;

        return $this->successResponse([
            'token' => $token,
            'user'  => $this->formatUser($user),
        ], 'Login successful.');
    }

    /**
     * POST /api/v1/auth/logout
     * Revoke the current access token (or all tokens if all_devices=true).
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            if ($request->boolean('all_devices')) {
                $user->tokens()->delete();
            } else {
                $token = $user->currentAccessToken();
                if ($token && method_exists($token, 'delete')) {
                    $token->delete();
                }
            }
        }

        if (app()->bound('auth')) {
            auth()->forgetGuards();
        }

        return $this->successResponse(null, 'Logged out successfully.');
    }

    /**
     * PATCH /api/v1/auth/password
     * Change the authenticated user's password and invalidate tokens on other devices.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password'     => ['required', 'string', 'min:8'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update([
            'password'             => Hash::make($data['new_password']),
            'must_change_password' => false,
        ]);

        // Revoke all other tokens so other devices are forced to re-authenticate
        $currentTokenId = $user->currentAccessToken()?->id;
        if ($currentTokenId) {
            $user->tokens()->where('id', '!=', $currentTokenId)->delete();
        }

        return $this->successResponse($this->formatUser($user->fresh()), 'Password updated successfully.');
    }

    /**
     * GET /api/v1/auth/me
     * Return current authenticated user profile with active status verification.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->is_active) {
            if (method_exists($user, 'tokens')) {
                $user->tokens()->delete();
            }
            return $this->errorResponse(
                'Your account has been deactivated. Contact an administrator.',
                null,
                403
            );
        }

        return $this->successResponse($this->formatUser($user));
    }

    /**
     * Format a User model into the shape the mobile app and frontend clients expect.
     */
    private function formatUser(User $user): array
    {
        $attrs = $user->getAttributes();
        $isActive = array_key_exists('is_active', $attrs) ? (bool) $attrs['is_active'] : true;
        $mustChange = array_key_exists('must_change_password', $attrs) ? (bool) $attrs['must_change_password'] : false;

        return [
            'id'                   => $user->id,
            'name'                 => $user->name,
            'email'                => $user->email,
            'phone'                => array_key_exists('phone', $attrs) ? $attrs['phone'] : null,
            'role'                 => $user->role,
            'isActive'             => $isActive,
            'must_change_password' => $mustChange,
            'mustChangePassword'   => $mustChange,
            'permissionGroup'      => array_key_exists('permission_group', $attrs) ? $attrs['permission_group'] : null,
            'permissions'          => $user->getPermissionsArray(),
            'lastActive'           => $user->updated_at?->toDateTimeString(),
        ];
    }
}
