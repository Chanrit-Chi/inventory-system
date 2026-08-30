<?php

namespace App\Observers;

use Laravel\Sanctum\PersonalAccessToken;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\Log;

class PersonalAccessTokenObserver
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function created(PersonalAccessToken $token): void
    {
        try {
            $this->auditLogService->syncPersonalAccessToken($token);
        } catch (\Throwable $e) {
            Log::error('Failed to sync personal access token to audit log', [
                'token_id' => $token->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}