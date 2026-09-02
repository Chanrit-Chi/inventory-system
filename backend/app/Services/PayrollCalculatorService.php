<?php

namespace App\Services;

use App\Models\User;
use App\Models\Order;
use App\Models\Payroll;
use App\Models\ThirteenthMonthPayout;
use App\Models\UserSalary;
use Carbon\Carbon;

class PayrollCalculatorService
{
    /**
     * Standard number of working days in a month.
     * Can be fetched from settings in the future.
     */
    const STANDARD_WORKING_DAYS = 26;

    /**
     * Resolve the base salary that was in effect for the given payroll period.
     * Picks the latest raise whose effective_from falls within or before the
     * period's last day, so historical payrolls are never repopulated with a
     * future raise amount.
     */
    public function resolveBaseSalary(string $userId, int $month, int $year): float
    {
        $periodEnd = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

        // Latest salary effective on/before the period end (covers raises mid-year)
        $salary = UserSalary::where('user_id', $userId)
            ->where(function ($q) use ($periodEnd) {
                $q->whereNull('effective_from')
                  ->orWhere('effective_from', '<=', $periodEnd);
            })
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->first();

        // Fallback: only future-dated rows exist — use the earliest one
        if (!$salary) {
            $salary = UserSalary::where('user_id', $userId)
                ->orderBy('effective_from')
                ->orderBy('created_at')
                ->first();
        }

        return $salary ? (float) $salary->base_salary : 0;
    }

    /**
     * Generate or update a draft payroll for a given user and period.
     */
    public function calculateForUser(User $user, int $month, int $year): Payroll
    {
        $baseSalary = $this->resolveBaseSalary($user->id, $month, $year);

        // Find existing draft or create new
        $payroll = Payroll::firstOrNew([
            'user_id' => $user->id,
            'period_month' => $month,
            'period_year' => $year,
        ]);

        // If it's already finalized or paid, don't auto-update core fields unless forced
        if ($payroll->exists && $payroll->status !== 'DRAFT') {
            return $payroll;
        }

        if (!$payroll->exists) {
            $payroll->working_days = self::STANDARD_WORKING_DAYS; // Default 26
        }

        // Calculate Incentive: manual override wins; otherwise auto-calc from completed orders
        $incentiveOverride = $payroll->incentive_override;
        if ($incentiveOverride !== null) {
            $incentiveAmount = round((float) $incentiveOverride, 2);
        } else {
            // Incentive window: matches sales completed in this period (completed_at with created_at fallback)
            $orders = Order::where(function ($q) use ($user) {
                    $q->where('seller_id', $user->id)
                      ->orWhere(function ($q2) use ($user) {
                          $q2->where('user_id', $user->id)->whereNull('seller_id');
                      });
                })
                ->where(function ($q) use ($month, $year) {
                    $q->where(function ($sub) use ($month, $year) {
                        $sub->whereNotNull('completed_at')
                            ->whereMonth('completed_at', $month)
                            ->whereYear('completed_at', $year);
                    })->orWhere(function ($sub) use ($month, $year) {
                        $sub->whereNull('completed_at')
                            ->whereMonth('created_at', $month)
                            ->whereYear('created_at', $year);
                    });
                })
                ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
                ->get();

            $incentiveAmount = $this->calculateIncentiveForOrders($orders);
        }

        // Calculate 13th month monthly accrual
        $thirteenthMonth = round($baseSalary / 12, 2);

        // Daily Rate based on configurable working days
        $workingDays = max((int) $payroll->working_days, 1);
        $dailyRate = $baseSalary / $workingDays;

        // Overtime
        $overtimeAmount = round(((float) $payroll->overtime_days) * $dailyRate, 2);

        // Unpaid leave
        $unpaidLeaveDeduction = round(((float) $payroll->unpaid_leave_days) * $dailyRate, 2);

        $thirteenthPayout = (float) ($payroll->thirteenth_month_payout ?? 0);

        // Populate fields
        $payroll->base_salary = $baseSalary;
        $payroll->incentive_amount = $incentiveAmount;
        $payroll->thirteenth_month_contribution = $thirteenthMonth;
        $payroll->thirteenth_month_payout = $thirteenthPayout;
        $payroll->overtime_amount = $overtimeAmount;
        $payroll->unpaid_leave_deduction = $unpaidLeaveDeduction;

        // Sum net pay (including 13th month payout when chosen for this period)
        $payroll->total_net_pay = round(
            $baseSalary +
            $incentiveAmount +
            (float) $payroll->performance_benefit +
            (float) $payroll->delivery_benefit +
            $overtimeAmount +
            (float) $payroll->collective_benefit +
            (float) $payroll->other_benefits +
            $thirteenthPayout -
            $unpaidLeaveDeduction,
            2
        );

        $payroll->save();

        // Synchronize 13th month payout record.
        // NOTE: the linked payout counts against the reserve as soon as this
        // draft is saved ("reserve held"); deleting the draft releases it.
        if ($thirteenthPayout > 0) {
            ThirteenthMonthPayout::updateOrCreate(
                ['payroll_id' => $payroll->id],
                [
                    'user_id' => $user->id,
                    'amount' => $thirteenthPayout,
                    'payout_date' => Carbon::create($year, $month, 1)->endOfMonth()->toDateString(),
                    'payment_method' => 'Payroll',
                    'notes' => "13th Month / Seniority Payout via Payroll {$month}/{$year}",
                ]
            );
        } else {
            ThirteenthMonthPayout::where('payroll_id', $payroll->id)->delete();
        }

        return $payroll;
    }

    /**
     * Calculate total incentive for a collection of orders based on each order's total amount.
     */
    public function calculateIncentiveForOrders($orders): float
    {
        $total = 0.0;
        foreach ($orders as $order) {
            $amount = (float) ($order->total_amount ?? $order->final_amount ?? 0);
            $total += $this->calculateIncentiveForAmount($amount);
        }
        return $total;
    }

    /**
     * Calculate incentive amount for a single order based on its total dollar amount.
     * Tiers:
     *   $1 - $30:   $0.25
     *   >$30 - $50: $0.50
     *   >$50 - $60: $0.75
     *   >$60 - $80: $1.00
     *   >$80:       $2.00
     */
    public function calculateIncentiveForAmount(float $amount): float
    {
        if ($amount < 1.0) {
            return 0.0;
        }

        if ($amount <= 30.0) {
            return 0.25;
        } elseif ($amount <= 50.0) {
            return 0.50;
        } elseif ($amount <= 60.0) {
            return 0.75;
        } elseif ($amount <= 80.0) {
            return 1.00;
        } else {
            return 2.00;
        }
    }

    /**
     * Get the full 13th month / seniority reserve summary for a staff member.
     * Accrued Balance = Total Accrued - Total Disbursed.
     * The balance is reported as-is (it may be negative if payouts ever
     * exceeded accruals, e.g. from legacy data) so over-disbursement stays visible.
     */
    public function getThirteenthMonthSummary(string $userId, ?int $year = null): array
    {
        $accrualQuery = Payroll::where('user_id', $userId);
        $payoutQuery = ThirteenthMonthPayout::where('user_id', $userId);

        if ($year !== null) {
            $accrualQuery->where('period_year', $year);
            $payoutQuery->whereYear('payout_date', $year);
        }

        $totalAccrued = (float) $accrualQuery->sum('thirteenth_month_contribution');
        $totalDisbursed = (float) $payoutQuery->sum('amount');
        $availableBalance = round($totalAccrued - $totalDisbursed, 2);

        $payouts = $payoutQuery->orderByDesc('payout_date')->get();

        return [
            'user_id' => $userId,
            'year' => $year,
            'total_accrued' => round($totalAccrued, 2),
            'total_disbursed' => round($totalDisbursed, 2),
            'available_balance' => $availableBalance,
            'payouts' => $payouts,
        ];
    }

    /**
     * Get the company-wide 13th month / seniority reserves overview for all active operational staff.
     */
    public function getCompanyThirteenthMonthReserves(?int $year = null, ?int $month = null): array
    {
        $users = \App\Models\User::where('is_active', true)
            ->where(function ($q) {
                if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'is_test_account')) {
                    $q->whereNull('is_test_account')->orWhere('is_test_account', false);
                }
            })
            ->where(function ($q) {
                $q->whereNull('role')
                  ->orWhereRaw("UPPER(TRIM(role)) NOT IN ('SUPER_ADMIN', 'SUPERADMIN')");
            })
            ->orderBy('name')
            ->get();

        $staffReserves = [];
        $companyTotalAccrued = 0.0;
        $companyTotalDisbursed = 0.0;
        $companyTotalAvailable = 0.0;

        foreach ($users as $user) {
            $salary = UserSalary::where('user_id', $user->id)
                ->where('effective_from', '<=', now()->toDateString())
                ->orderByDesc('effective_from')
                ->orderByDesc('id')
                ->first()
                ?? UserSalary::where('user_id', $user->id)
                    ->orderByDesc('effective_from')
                    ->first();

            $baseSalary = $salary ? (float) $salary->base_salary : 0.0;
            $monthlyAccrual = round($baseSalary / 12, 2);

            $accrualQuery = Payroll::where('user_id', $user->id);
            $payoutQuery = ThirteenthMonthPayout::where('user_id', $user->id);

            if ($year !== null) {
                $accrualQuery->where('period_year', $year);
                $payoutQuery->where(function ($q) use ($year) {
                    $q->whereYear('payout_date', $year)
                      ->orWhere('payout_date', 'like', "{$year}-%");
                });
            }

            $allPayrolls = $accrualQuery->orderBy('period_month')->get([
                'id',
                'period_month',
                'period_year',
                'thirteenth_month_contribution',
                'thirteenth_month_accrual',
                'status',
                'total_net_pay',
                'created_at'
            ]);

            $accruedMonths = [];
            $monthlyBreakdown = [];

            foreach ($allPayrolls as $p) {
                $contrib = (float) ($p->thirteenth_month_contribution ?? $p->thirteenth_month_accrual ?? 0);
                if ($contrib > 0) {
                    $accruedMonths[] = (int) $p->period_month;
                }
                $monthlyBreakdown[] = [
                    'payroll_id' => $p->id,
                    'month' => (int) $p->period_month,
                    'year' => (int) $p->period_year,
                    'amount' => round($contrib, 2),
                    'status' => $p->status,
                ];
            }

            $totalAccrued = (float) $allPayrolls->sum(function ($p) {
                return (float) ($p->thirteenth_month_contribution ?? $p->thirteenth_month_accrual ?? 0);
            });
            $monthsAccrued = count($accruedMonths);
            $totalDisbursed = (float) $payoutQuery->sum('amount');
            $availableBalance = round($totalAccrued - $totalDisbursed, 2);
            $payouts = $payoutQuery->orderByDesc('payout_date')->get();

            // If filtered by specific month, calculate month specific accrual
            $monthSpecificAccrual = null;
            if ($month !== null) {
                $match = $allPayrolls->firstWhere('period_month', $month);
                $monthSpecificAccrual = $match ? (float) ($match->thirteenth_month_contribution ?? $match->thirteenth_month_accrual ?? 0) : 0.0;
            }

            $companyTotalAccrued += ($month !== null ? $monthSpecificAccrual : $totalAccrued);
            $companyTotalDisbursed += $totalDisbursed;
            $companyTotalAvailable += $availableBalance;

            $staffReserves[] = [
                'user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'department' => $user->department ?? 'General Operations',
                'base_salary' => $baseSalary,
                'monthly_accrual' => $monthlyAccrual,
                'months_accrued' => $monthsAccrued,
                'accrued_months' => array_values(array_unique($accruedMonths)),
                'monthly_breakdown' => $monthlyBreakdown,
                'month_specific_accrual' => $monthSpecificAccrual,
                'total_accrued' => round($totalAccrued, 2),
                'total_disbursed' => round($totalDisbursed, 2),
                'available_balance' => $availableBalance,
                'payouts' => $payouts,
            ];
        }

        return [
            'year' => $year,
            'month' => $month,
            'kpi' => [
                'company_total_accrued' => round($companyTotalAccrued, 2),
                'company_total_disbursed' => round($companyTotalDisbursed, 2),
                'company_total_available_balance' => round($companyTotalAvailable, 2),
                'eligible_staff_count' => count($staffReserves),
            ],
            'staff' => $staffReserves,
        ];
    }
}
