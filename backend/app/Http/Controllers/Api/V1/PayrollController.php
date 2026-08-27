<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use App\Models\Expense;
use App\Models\Payroll;
use App\Models\ThirteenthMonthPayout;
use App\Models\User;
use App\Models\UserSalary;
use App\Services\PayrollAuditService;
use App\Services\PayrollCalculatorService;
use Carbon\Carbon;

class PayrollController extends BaseApiController
{
    /**
     * Allowed payroll status lifecycle:
     *   DRAFT → FINALIZED → PAID, with FINALIZED → DRAFT reopen.
     * Same-status requests are treated as no-ops; PAID is immutable.
     */
    private const STATUS_TRANSITIONS = [
        'DRAFT' => ['FINALIZED'],
        'FINALIZED' => ['DRAFT', 'PAID'],
        'PAID' => [],
    ];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'month' => 'nullable|integer|between:1,12',
            'year' => 'nullable|integer',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = Payroll::with('user')
            ->orderByDesc('period_year')
            ->orderByDesc('period_month');

        if ($request->has('month')) {
            $query->where('period_month', $request->month);
        }
        if ($request->has('year')) {
            $query->where('period_year', $request->year);
        }

        // Pagination is opt-in (per_page present) so existing clients that
        // expect the full list keep working.
        if ($request->filled('per_page')) {
            $perPage = min(max((int) $request->per_page, 1), 100);

            return $this->paginatedResponse($query->paginate($perPage));
        }

        return $this->successResponse($query->get());
    }

    public function generate(Request $request, PayrollCalculatorService $service, PayrollAuditService $audit): JsonResponse
    {
        $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'exists:users,id',
            'all_staff' => 'nullable|boolean',
            'batch' => 'nullable|boolean',
            'month' => 'required|integer|between:1,12',
            'year' => 'required|integer|min:2000|max:2100',
        ]);

        $month = (int) $request->month;
        $year = (int) $request->year;

        // Determine target users
        if ($request->boolean('all_staff') || $request->boolean('batch')) {
            $users = User::all();
        } elseif ($request->has('user_ids') && is_array($request->user_ids) && count($request->user_ids) > 0) {
            $users = User::whereIn('id', $request->user_ids)->get();
        } elseif ($request->filled('user_id')) {
            $users = User::where('id', $request->user_id)->get();
        } else {
            return $this->errorResponse('Please specify user_id, user_ids, or all_staff.', null, 422);
        }

        if ($users->isEmpty()) {
            return $this->errorResponse('No eligible staff members found.', null, 404);
        }

        // If single user specified directly, preserve strict duplicate error
        $isSingle = !$request->boolean('all_staff') && !$request->boolean('batch') && (!$request->has('user_ids') || count($request->user_ids) === 1);

        if ($isSingle && $users->count() === 1) {
            $targetUser = $users->first();
            $existing = Payroll::where('user_id', $targetUser->id)
                ->where('period_month', $month)
                ->where('period_year', $year)
                ->first();

            if ($existing) {
                return $this->errorResponse(
                    "Payroll for {$targetUser->name} for {$month}/{$year} has already been generated (Status: {$existing->status}).",
                    $existing,
                    422
                );
            }

            try {
                $payroll = $service->calculateForUser($targetUser, $month, $year);
                $payroll->load('user');

                $audit->log(PayrollAuditService::ACTION_PAYROLL_GENERATED, [
                    'staff_id' => $targetUser->id,
                    'subject' => "Payroll {$month}/{$year} for {$targetUser->name}",
                    'changes' => [
                        'base_salary' => (float) $payroll->base_salary,
                        'total_net_pay' => (float) $payroll->total_net_pay,
                    ],
                ]);

                return $this->successResponse($payroll, 'Payroll generated successfully.');
            } catch (\Exception $e) {
                return $this->errorResponse($e->getMessage(), null, 500);
            }
        }

        // Batch / Multi generation
        $generated = [];
        $skipped = [];

        foreach ($users as $user) {
            $existing = Payroll::where('user_id', $user->id)
                ->where('period_month', $month)
                ->where('period_year', $year)
                ->first();

            if ($existing) {
                $skipped[] = [
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'reason' => "Already generated ({$existing->status})",
                ];
                continue;
            }

            try {
                $payroll = $service->calculateForUser($user, $month, $year);
                $payroll->load('user');

                $audit->log(PayrollAuditService::ACTION_PAYROLL_GENERATED, [
                    'staff_id' => $user->id,
                    'subject' => "Payroll {$month}/{$year} for {$user->name}",
                    'changes' => [
                        'base_salary' => (float) $payroll->base_salary,
                        'total_net_pay' => (float) $payroll->total_net_pay,
                    ],
                ]);

                $generated[] = $payroll;
            } catch (\Exception $e) {
                $skipped[] = [
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'reason' => $e->getMessage(),
                ];
            }
        }

        $count = count($generated);
        $skippedCount = count($skipped);
        $message = "Generated {$count} payroll(s)." . ($skippedCount > 0 ? " ({$skippedCount} skipped/already existing)" : '');

        return $this->successResponse([
            'generated' => $generated,
            'generated_count' => $count,
            'skipped' => $skipped,
            'skipped_count' => $skippedCount,
        ], $message);
    }

    public function update(Request $request, string $id, PayrollCalculatorService $service, PayrollAuditService $audit): JsonResponse
    {
        $payroll = Payroll::findOrFail($id);
        $originalStatus = $payroll->status;

        $request->validate([
            'working_days' => 'nullable|integer|min:1|max:31',
            'performance_benefit' => 'nullable|numeric|min:0',
            'delivery_benefit' => 'nullable|numeric|min:0',
            'overtime_days' => 'nullable|numeric|min:0|max:62',
            'unpaid_leave_days' => 'nullable|numeric|min:0|max:31',
            'collective_benefit' => 'nullable|numeric|min:0',
            'other_benefits' => 'nullable|numeric|min:0',
            'incentive_override' => 'nullable|numeric|min:0',
            'thirteenth_month_payout' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:DRAFT,FINALIZED,PAID'
        ]);

        // Lifecycle rule: same-status requests are no-ops; anything else must
        // follow DRAFT → FINALIZED → PAID (with FINALIZED → DRAFT reopen).
        $requestedStatus = $request->input('status');
        if ($requestedStatus && $requestedStatus !== $originalStatus) {
            if (!in_array($requestedStatus, self::STATUS_TRANSITIONS[$originalStatus] ?? [], true)) {
                return $this->errorResponse(
                    "Invalid status transition {$originalStatus} → {$requestedStatus}. Allowed flow is DRAFT → FINALIZED → PAID.",
                    null,
                    422
                );
            }
        }

        // Lifecycle rule: only DRAFT payrolls allow editing calculation inputs.
        // FINALIZED/PAID rows only permit status transitions (e.g. reopen as DRAFT).
        $inputFields = [
            'working_days',
            'performance_benefit',
            'delivery_benefit',
            'overtime_days',
            'unpaid_leave_days',
            'collective_benefit',
            'other_benefits',
            'incentive_override',
            'thirteenth_month_payout',
        ];
        if ($originalStatus !== 'DRAFT' && $request->hasAny($inputFields)) {
            return $this->errorResponse(
                "This payroll is {$originalStatus} and can no longer be edited. Reopen it as a draft first.",
                null,
                422
            );
        }

        // Reserve guard: a 13th month payout cannot exceed the accrued balance.
        // This payroll's current hold is added back because it is being replaced.
        // Note: draft payrolls hold their payout against the reserve immediately
        // (deleting the draft releases it) — see calculateForUser().
        if ($request->has('thirteenth_month_payout')) {
            $requestedPayout = (float) $request->input('thirteenth_month_payout', 0);
            $summary = $service->getThirteenthMonthSummary($payroll->user_id);
            $reservePool = round($summary['available_balance'] + (float) $payroll->thirteenth_month_payout, 2);

            if ($requestedPayout > $reservePool) {
                return $this->errorResponse(
                    sprintf(
                        '13th month payout of %.2f exceeds the available reserve balance of %.2f.',
                        $requestedPayout,
                        $reservePool
                    ),
                    null,
                    422
                );
            }
        }

        $before = $payroll->only($inputFields);

        $payroll->fill($request->only($inputFields));

        $payroll->save();

        // Recalculate FIRST while still DRAFT so totals always reflect the new inputs.
        // (calculateForUser early-returns for FINALIZED/PAID rows.)
        $user = $payroll->user;
        $periodMonth = (int) $payroll->period_month;
        $periodYear = (int) $payroll->period_year;
        $updatedPayroll = $service->calculateForUser($user, $periodMonth, $periodYear);

        // Apply status transition only after recalculation so totals are never stale
        if ($requestedStatus && $requestedStatus !== $updatedPayroll->status) {
            $updatedPayroll->status = $requestedStatus;
            $updatedPayroll->save();

            // Reopening re-enters the editable state: recalculate now that the row
            // is DRAFT so totals reflect the currently-effective salary and inputs,
            // which may have drifted while the row was locked.
            if ($requestedStatus === 'DRAFT') {
                $updatedPayroll = $service->calculateForUser($user, $periodMonth, $periodYear);
            }
        }

        // Auto-log or remove expense depending on final status
        if ($updatedPayroll->status === 'PAID') {
            $this->syncPayrollExpense($updatedPayroll);
        } elseif ($originalStatus === 'PAID' && $updatedPayroll->status !== 'PAID') {
            $this->removePayrollExpense($updatedPayroll->id);
        }

        // Audit trail: input diffs and/or status transition
        $staffName = $user?->name ?? 'Staff';
        if ($changes = PayrollAuditService::diff($before, $updatedPayroll, $inputFields)) {
            $audit->log(PayrollAuditService::ACTION_PAYROLL_UPDATED, [
                'staff_id' => $payroll->user_id,
                'subject' => "Payroll {$periodMonth}/{$periodYear} for {$staffName}",
                'changes' => $changes,
            ]);
        }
        if ($requestedStatus && $requestedStatus !== $originalStatus) {
            $audit->log(PayrollAuditService::ACTION_PAYROLL_STATUS_CHANGED, [
                'staff_id' => $payroll->user_id,
                'subject' => "Payroll {$periodMonth}/{$periodYear} for {$staffName}",
                'changes' => ['status' => ['from' => $originalStatus, 'to' => $requestedStatus]],
            ]);
        }

        $updatedPayroll->load('user');

        return $this->successResponse($updatedPayroll, 'Payroll updated successfully.');
    }

    public function getSalary(Request $request, string $userId): JsonResponse
    {
        $user = User::findOrFail($userId);

        // Currently-effective salary (latest effective_from <= today), fallback to latest row
        $salary = UserSalary::where('user_id', $user->id)
            ->where(function ($q) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', now()->toDateString());
            })
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->first()
            ?? UserSalary::where('user_id', $user->id)
                ->orderBy('effective_from', 'asc')
                ->orderBy('created_at')
                ->first();

        if (!$salary) {
            // Read-only endpoint: never persist a default row as a side effect.
            // Report an unsaved default so clients can display a starting value.
            return $this->successResponse([
                'user_id' => $user->id,
                'base_salary' => 0,
                'effective_from' => now()->toDateString(),
                'is_default' => true,
            ]);
        }

        return $this->successResponse($salary);
    }

    public function mySalaryHistory(Request $request): JsonResponse
    {
        return $this->getSalaryHistory($request, $request->user()->id);
    }

    public function mySavings(Request $request, PayrollCalculatorService $service): JsonResponse
    {
        return $this->getThirteenthMonthSavings($request, $request->user()->id, $service);
    }

    public function getSalaryHistory(Request $request, string $userId): JsonResponse
    {
        $user = User::findOrFail($userId);

        $history = UserSalary::with('creator')
            ->where('user_id', $user->id)
            ->orderBy('effective_from', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        $formatted = [];
        $previousSalary = null;

        // Calculate delta for each raise in ascending order then reverse
        $rows = $history->reverse()->values();
        foreach ($rows as $index => $item) {
            $currentSalary = (float) $item->base_salary;
            $prev = $index > 0 ? (float) $rows[$index - 1]->base_salary : null;
            $diffAmount = $prev !== null ? round($currentSalary - $prev, 2) : 0.0;
            $diffPercent = ($prev !== null && $prev > 0) ? round((($currentSalary - $prev) / $prev) * 100, 1) : 0.0;

            $formatted[] = [
                'id'              => $item->id,
                'base_salary'     => $currentSalary,
                'effective_from'  => $item->effective_from?->toDateString(),
                'previous_salary' => $prev,
                'diff_amount'     => $diffAmount,
                'diff_percent'    => $diffPercent,
                'reason'          => $item->reason ?? ($index === 0 ? 'Initial Base Salary' : 'Salary Adjustment / Raise'),
                'created_at'      => $item->created_at?->toDateTimeString(),
                'created_by'      => $item->creator?->name ?? 'Admin',
            ];
        }

        // Return latest first
        usort($formatted, fn ($a, $b) => strcmp($b['effective_from'] ?? $b['created_at'], $a['effective_from'] ?? $a['created_at']));

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ],
            'current_salary' => $history->first() ? (float) $history->first()->base_salary : 0.0,
            'history' => $formatted,
        ]);
    }

    public function setSalary(Request $request, string $userId, PayrollCalculatorService $service, PayrollAuditService $audit): JsonResponse
    {
        $request->validate([
            'base_salary'    => 'required|numeric|min:0',
            'effective_from' => 'nullable|date',
            'reason'         => 'nullable|string|max:255',
        ]);

        $user = User::findOrFail($userId);
        $effectiveFrom = $request->input('effective_from', now()->toDateString());
        $reason = $request->input('reason', 'Salary adjustment');

        // Each raise is a new history row; re-saving the same effective date updates it
        $previous = UserSalary::where('user_id', $user->id)
            ->where('effective_from', $effectiveFrom)
            ->first();

        $salary = UserSalary::updateOrCreate(
            ['user_id' => $user->id, 'effective_from' => $effectiveFrom],
            [
                'base_salary' => $request->base_salary,
                'reason'      => $reason,
                'created_by'  => auth()->id(),
            ]
        );

        // Auto-recalculate any active DRAFT payrolls for this user so they immediately inherit the new salary
        $draftPayrolls = Payroll::where('user_id', $user->id)->where('status', 'DRAFT')->get();
        foreach ($draftPayrolls as $draft) {
            $service->calculateForUser($user, (int) $draft->period_month, (int) $draft->period_year);
        }

        $audit->log(PayrollAuditService::ACTION_SALARY_SET, [
            'staff_id' => $user->id,
            'subject' => "Base salary for {$user->name}",
            'changes' => [
                'base_salary' => [
                    'from' => $previous ? (float) $previous->base_salary : null,
                    'to' => (float) $salary->base_salary,
                ],
                'effective_from' => $effectiveFrom,
                'reason' => $reason,
            ],
        ]);

        return $this->successResponse($salary, 'Salary configuration updated successfully.');
    }

    /**
     * Delete a DRAFT payroll. FINALIZED/PAID records are permanent.
     */
    public function destroy(string $id, PayrollAuditService $audit): JsonResponse
    {
        $payroll = Payroll::findOrFail($id);

        if ($payroll->status !== 'DRAFT') {
            return $this->errorResponse(
                'Only DRAFT payrolls can be deleted. FINALIZED and PAID records are permanent.',
                null,
                422
            );
        }

        // Clean up any linked 13th month payout (releases its reserve hold)
        ThirteenthMonthPayout::where('payroll_id', $payroll->id)->delete();

        // Clean up any auto-logged expense
        $this->removePayrollExpense($payroll->id);

        $audit->log(PayrollAuditService::ACTION_PAYROLL_DELETED, [
            'staff_id' => $payroll->user_id,
            'subject' => "Payroll {$payroll->period_month}/{$payroll->period_year} for {$payroll->user?->name}",
            'changes' => ['total_net_pay' => (float) $payroll->total_net_pay],
        ]);

        $payroll->delete();

        return $this->successResponse(null, 'Draft payroll deleted successfully.');
    }

    /**
     * Get 13th month / seniority reserve summary (accruals, payouts, available balance).
     */
    public function getThirteenthMonthSavings(Request $request, string $userId, PayrollCalculatorService $service): JsonResponse
    {
        $year = $request->has('year') ? (int) $request->input('year') : null;
        $summary = $service->getThirteenthMonthSummary($userId, $year);

        return $this->successResponse($summary);
    }

    /**
     * Record a standalone 13th month / seniority bonus disbursement outside of monthly payroll.
     */
    public function recordStandalonePayout(Request $request, string $userId, PayrollCalculatorService $service, PayrollAuditService $audit): JsonResponse
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payout_date' => 'nullable|date|before_or_equal:today',
            'payment_method' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:255',
        ]);

        $user = User::findOrFail($userId);

        // Reserve guard: cannot disburse more than has been accrued
        $available = (float) $service->getThirteenthMonthSummary($userId)['available_balance'];
        $amount = round((float) $request->amount, 2);

        if ($amount > $available) {
            return $this->errorResponse(
                sprintf(
                    'Payout of %.2f exceeds the available 13th month reserve balance of %.2f.',
                    $amount,
                    $available
                ),
                null,
                422
            );
        }

        $payoutDate = $request->input('payout_date', now()->toDateString());
        $paymentMethod = $request->input('payment_method', 'Cash');
        $notes = $request->input('notes', 'Direct 13th Month / Seniority Payout');

        $payout = ThirteenthMonthPayout::create([
            'user_id' => $user->id,
            'amount' => $amount,
            'payout_date' => $payoutDate,
            'payment_method' => $paymentMethod,
            'notes' => $notes,
            'created_by' => auth()->id(),
        ]);

        // Auto-log standalone 13th-month bonus as a Salary Expense
        Expense::create([
            'user_id' => $user->id,
            'created_by' => auth()->id() ?? $user->id,
            'expense_date' => $payoutDate,
            'category' => 'Salary',
            'amount' => $amount,
            'payment_method' => $paymentMethod,
            'title' => "13th Month / Seniority Payout - {$user->name}",
            'notes' => "Standalone 13th-month bonus payout: {$notes}",
        ]);

        $audit->log(PayrollAuditService::ACTION_PAYOUT_RECORDED, [
            'staff_id' => $user->id,
            'subject' => "13th month payout for {$user->name}",
            'changes' => [
                'amount' => ['from' => null, 'to' => $amount],
                'payout_date' => $payoutDate,
                'payment_method' => $payout->payment_method,
            ],
        ]);

        $summary = $service->getThirteenthMonthSummary($userId);

        return $this->successResponse([
            'payout' => $payout,
            'summary' => $summary,
        ], '13th month payout recorded successfully.');
    }

    /**
     * Transition many payrolls to a new status in one atomic operation.
     * Each row is validated against the status lifecycle independently;
     * ineligible rows are reported per-id instead of failing the batch.
     */
    public function bulkUpdateStatus(Request $request, PayrollAuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'uuid',
            'status' => 'required|in:DRAFT,FINALIZED,PAID',
        ]);

        $updated = 0;
        $failed = [];

        DB::transaction(function () use ($data, &$updated, &$failed, $audit) {
            $payrolls = Payroll::with('user')->whereIn('id', $data['ids'])->lockForUpdate()->get();

            foreach ($payrolls as $payroll) {
                if (!in_array($data['status'], self::STATUS_TRANSITIONS[$payroll->status] ?? [], true)) {
                    $failed[] = [
                        'id' => $payroll->id,
                        'reason' => "Cannot transition {$payroll->status} → {$data['status']}. Allowed flow is DRAFT → FINALIZED → PAID.",
                    ];
                    continue;
                }

                $originalStatus = $payroll->status;
                $payroll->status = $data['status'];
                $payroll->save();

                // Auto-sync expense for bulk status change
                if ($data['status'] === 'PAID') {
                    $this->syncPayrollExpense($payroll);
                } elseif ($originalStatus === 'PAID' && $data['status'] !== 'PAID') {
                    $this->removePayrollExpense($payroll->id);
                }

                $audit->log(PayrollAuditService::ACTION_PAYROLL_STATUS_CHANGED, [
                    'staff_id' => $payroll->user_id,
                    'subject' => "Payroll {$payroll->period_month}/{$payroll->period_year} for {$payroll->user?->name}",
                    'changes' => ['status' => ['from' => $originalStatus, 'to' => $data['status']]],
                ]);

                $updated++;
            }

            // Report requested ids that no longer exist
            foreach (array_diff($data['ids'], $payrolls->pluck('id')->all()) as $missingId) {
                $failed[] = ['id' => $missingId, 'reason' => 'Payroll not found.'];
            }
        });

        return $this->successResponse(
            ['updated' => $updated, 'failed' => $failed],
            "{$updated} payroll(s) marked as {$data['status']}."
        );
    }

    /**
     * Synchronize / auto-log an Expense record for a PAID payroll.
     */
    private function syncPayrollExpense(Payroll $payroll): ?Expense
    {
        if ($payroll->status !== 'PAID') {
            $this->removePayrollExpense($payroll->id);
            return null;
        }

        $user = $payroll->user ?? User::find($payroll->user_id);
        $staffName = $user?->name ?? 'Staff';
        $monthName = Carbon::create()->month((int) $payroll->period_month)->format('F');
        $expenseDate = now()->toDateString();

        return Expense::updateOrCreate(
            ['payroll_id' => $payroll->id],
            [
                'user_id' => $payroll->user_id,
                'created_by' => auth()->id() ?? $payroll->user_id,
                'expense_date' => $expenseDate,
                'category' => 'Salary',
                'amount' => (float) $payroll->total_net_pay,
                'payment_method' => 'Bank Transfer',
                'title' => "Salary Payout - {$staffName} ({$monthName} {$payroll->period_year})",
                'notes' => "Auto-logged salary payment from Staff Payroll #{$payroll->id}",
            ]
        );
    }

    /**
     * Remove auto-logged Expense if payroll is reopened from PAID to DRAFT/FINALIZED or deleted.
     */
    private function removePayrollExpense(string $payrollId): void
    {
        Expense::where('payroll_id', $payrollId)->delete();
    }
}
