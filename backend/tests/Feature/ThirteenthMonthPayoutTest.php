<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\ThirteenthMonthPayout;
use App\Models\User;
use App\Models\UserSalary;
use App\Services\PayrollCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ThirteenthMonthPayoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_accrues_monthly_and_deducts_payout_correctly(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $seller = User::create([
            'name' => 'Accrual Seller',
            'email' => 'accrual_seller@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'SELLER',
        ]);
        UserSalary::create(['user_id' => $seller->id, 'base_salary' => 600.00]);

        $service = app(PayrollCalculatorService::class);

        // Generate 6 months of payrolls (Jan to Jun 2026): each accrues $50 -> Total $300
        for ($m = 1; $m <= 6; $m++) {
            $service->calculateForUser($seller, $m, 2026);
        }

        // Summary before payout
        $summary = $service->getThirteenthMonthSummary($seller->id);
        $this->assertEquals(300.00, $summary['total_accrued']);
        $this->assertEquals(0.00, $summary['total_disbursed']);
        $this->assertEquals(300.00, $summary['available_balance']);

        // Month 6 (June) payroll: include 13th month payout of $300 (e.g. Khmer New Year / Mid-year bonus)
        $junePayroll = Payroll::where('user_id', $seller->id)
            ->where('period_month', 6)
            ->where('period_year', 2026)
            ->first();

        $response = $this->putJson("/api/v1/payrolls/{$junePayroll->id}", [
            'thirteenth_month_payout' => 300.00,
        ]);

        $response->assertStatus(200);

        $freshJune = $junePayroll->fresh();
        $this->assertEquals(300.00, (float) $freshJune->thirteenth_month_payout);
        // Net pay for June: 600 (base) + 300 (13th payout) = 900
        $this->assertEquals(900.00, (float) $freshJune->total_net_pay);

        // Check summary after payout: Available balance should now be $0.00
        $summaryAfter = $service->getThirteenthMonthSummary($seller->id);
        $this->assertEquals(300.00, $summaryAfter['total_accrued']);
        $this->assertEquals(300.00, $summaryAfter['total_disbursed']);
        $this->assertEquals(0.00, $summaryAfter['available_balance']);

        // Generate Month 7 (July) payroll: accrues another $50
        $service->calculateForUser($seller, 7, 2026);

        $summaryJuly = $service->getThirteenthMonthSummary($seller->id);
        $this->assertEquals(350.00, $summaryJuly['total_accrued']);
        $this->assertEquals(300.00, $summaryJuly['total_disbursed']);
        $this->assertEquals(50.00, $summaryJuly['available_balance']); // New cycle started!
    }

    public function test_standalone_payout_endpoint(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $seller = User::create([
            'name' => 'Standalone Seller',
            'email' => 'standalone_seller@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'SELLER',
        ]);
        UserSalary::create(['user_id' => $seller->id, 'base_salary' => 1200.00]);

        $service = app(PayrollCalculatorService::class);
        // Accrue 3 months -> $100/mo = $300
        for ($m = 1; $m <= 3; $m++) {
            $service->calculateForUser($seller, $m, 2026);
        }

        // Make standalone payout of $200
        $res = $this->postJson("/api/v1/users/{$seller->id}/savings/payout", [
            'amount' => 200.00,
            'payout_date' => '2026-04-14',
            'notes' => 'Khmer New Year Bonus',
        ]);

        $res->assertStatus(200)->assertJson(['success' => true]);

        $summary = $service->getThirteenthMonthSummary($seller->id);
        $this->assertEquals(300.00, $summary['total_accrued']);
        $this->assertEquals(200.00, $summary['total_disbursed']);
        $this->assertEquals(100.00, $summary['available_balance']);
    }
}
