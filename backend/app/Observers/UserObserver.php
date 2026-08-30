<?php

namespace App\Observers;

use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\Log;

class UserObserver
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function created(User $user): void
    {
        try {
            $this->auditLogService->syncUser($user);
        } catch (\Throwable $e) {
            Log::error('Failed to sync user create to audit log', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function updated(User $user): void
    {
        try {
            $this->auditLogService->syncUser($user);
        } catch (\Throwable $e) {
            Log::error('Failed to sync user update to audit log', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function deleted(User $user): void
    {
        try {
            $this->auditLogService->log(
                'USER',
                'user-del-' . $user->id,
                'USER_DELETED',
                'STAFF',
                "{$user->name} ({$user->role}) - Deleted",
                'System Admin',
                'ADMIN',
                "Staff account deleted: {$user->email}",
                [
                    'email' => $user->email,
                    'role' => $user->role,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('Failed to sync user delete to audit log', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}