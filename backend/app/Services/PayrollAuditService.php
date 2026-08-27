<?php

namespace App\Services;

use App\Models\PayrollAuditLog;
use Illuminate\Support\Facades\Auth;

/**
 * Records an immutable audit trail for all payroll & compensation mutations
 * (salary changes, payroll edits, status transitions, 13th month payouts).
 */
class PayrollAuditService
{
    public const ACTION_SALARY_SET = 'SALARY_SET';
    public const ACTION_PAYROLL_GENERATED = 'PAYROLL_GENERATED';
    public const ACTION_PAYROLL_UPDATED = 'PAYROLL_UPDATED';
    public const ACTION_PAYROLL_STATUS_CHANGED = 'PAYROLL_STATUS_CHANGED';
    public const ACTION_PAYROLL_DELETED = 'PAYROLL_DELETED';
    public const ACTION_PAYOUT_RECORDED = 'THIRTEENTH_PAYOUT_RECORDED';

    /**
     * Persist an audit entry. Auditing failures must never break the
     * business operation, so any storage error is swallowed.
     */
    public function log(string $action, array $context = []): void
    {
        try {
            PayrollAuditLog::create([
                'actor_id' => Auth::id(),
                'staff_id' => $context['staff_id'] ?? null,
                'action' => $action,
                'subject' => $context['subject'] ?? null,
                'changes' => $context['changes'] ?? null,
            ]);
        } catch (\Throwable) {
            // Never let audit persistence break payroll operations.
        }
    }

    /**
     * Build a before/after diff payload for audited numeric fields.
     *
     * @param array<string, float|int> $before Field values prior to mutation.
     * @param array<string, mixed> $after Model (or array) holding new values.
     * @param array<int, string> $fields Fields to compare.
     */
    public static function diff(array $before, $after, array $fields): ?array
    {
        $changes = [];

        foreach ($fields as $field) {
            if (!array_key_exists($field, $before)) {
                continue;
            }

            $oldValue = is_array($after) ? ($after[$field] ?? null) : ($after->{$field} ?? null);

            if ((float) $before[$field] !== (float) $oldValue) {
                $changes[$field] = [
                    'from' => round((float) $before[$field], 2),
                    'to' => round((float) $oldValue, 2),
                ];
            }
        }

        return $changes === [] ? null : $changes;
    }
}
