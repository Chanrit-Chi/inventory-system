<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payroll extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'period_month',
        'period_year',
        'working_days',
        'base_salary',
        'incentive_amount',
        'incentive_override',
        'thirteenth_month_contribution',
        'thirteenth_month_payout',
        'performance_benefit',
        'delivery_benefit',
        'overtime_days',
        'overtime_amount',
        'unpaid_leave_days',
        'unpaid_leave_deduction',
        'collective_benefit',
        'other_benefits',
        'total_net_pay',
        'status',
    ];

    protected $casts = [
        'base_salary' => 'float',
        'incentive_amount' => 'float',
        'incentive_override' => 'float',
        'thirteenth_month_contribution' => 'float',
        'thirteenth_month_payout' => 'float',
        'performance_benefit' => 'float',
        'delivery_benefit' => 'float',
        'overtime_days' => 'float',
        'overtime_amount' => 'float',
        'unpaid_leave_days' => 'float',
        'unpaid_leave_deduction' => 'float',
        'collective_benefit' => 'float',
        'other_benefits' => 'float',
        'total_net_pay' => 'float',
        'working_days' => 'integer',
        'period_month' => 'integer',
        'period_year' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(ThirteenthMonthPayout::class);
    }

    public function expense(): HasOne
    {
        return $this->hasOne(Expense::class, 'payroll_id');
    }
}
