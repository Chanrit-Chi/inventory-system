<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\PayrollAuditLog;
use App\Models\User;
use App\Models\UserSalary;
use App\Services\PayrollCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollLifecycleAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());
    }

    private function makeSeller(string $name, float $salary): User
    {
        $seller = User::create([
            'name' => $name,
            'email' => strtolower(str_replace(' ', '_', $name)) . '@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'SELLER',
        ]);
        UserSalary::create(['user_id' => $seller->id, 'base_salary' => $salary]);

        return $seller;
    }

    public function test_draft_cannot_jump_directly_to_paid(): void
    {
        $seller = $this->makeSeller('Jump Seller', 600.00);
        $payroll = app(PayrollCalculatorService::class)->calculateForUser($seller, 5, 2026);

        $res = $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'PAID']);

        $res->assertStatus(422);
        $this->assertSame('DRAFT', $payroll->fresh()->status);
    }

    public function test_paid_payroll_is_immutable(): void
    {
        $seller = $this->makeSeller('Immutable Seller', 600.00);
        $service = app(PayrollCalculatorService::class);
        $payroll = $service->calculateForUser($seller, 5, 2026);

        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'FINALIZED'])->assertStatus(200);
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'PAID'])->assertStatus(200);

        // No further transitions out of PAID
        $res = $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'FINALIZED']);
        $res->assertStatus(422);

        // And no input edits either
        $res = $this->putJson("/api/v1/payrolls/{$payroll->id}", ['performance_benefit' => 99]);
        $res->assertStatus(422);

        $this->assertSame('PAID', $payroll->fresh()->status);
    }

    public function test_reopen_recalculates_with_currently_effective_salary(): void
    {
        $seller = $this->makeSeller('Reopen Seller', 600.00);
        $service = app(PayrollCalculatorService::class);

        $payroll = $service->calculateForUser($seller, 6, 2026);
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'FINALIZED'])->assertStatus(200);
        $this->assertEquals(600.00, (float) $payroll->fresh()->total_net_pay);

        // Raise effective mid-June while the payroll was finalized
        UserSalary::create(['user_id' => $seller->id, 'base_salary' => 900.00, 'effective_from' => '2026-06-15']);

        $res = $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'DRAFT']);
        $res->assertStatus(200);

        $fresh = $payroll->fresh();
        $this->assertSame('DRAFT', $fresh->status);
        // Totals were recalculated against the raise instead of staying stale
        $this->assertEquals(900.00, (float) $fresh->base_salary);
        $this->assertEquals(900.00, (float) $fresh->total_net_pay);
    }

    public function test_get_salary_does_not_create_rows(): void
    {
        $seller = $this->makeSeller('Readonly Salary Seller', 700.00);

        // Remove the seeded row so nothing exists yet
        UserSalary::where('user_id', $seller->id)->delete();

        $res = $this->getJson("/api/v1/users/{$seller->id}/salary");
        $res->assertStatus(200)->assertJsonPath('data.base_salary', 0);

        $this->assertSame(0, UserSalary::where('user_id', $seller->id)->count());

        // A second read stays side-effect free
        $this->getJson("/api/v1/users/{$seller->id}/salary")->assertStatus(200);
        $this->assertSame(0, UserSalary::where('user_id', $seller->id)->count());
    }

    public function test_payout_above_reserve_rejected_on_payroll_update(): void
    {
        $seller = $this->makeSeller('Cap Seller', 1200.00); // accrues $100/mo
        $service = app(PayrollCalculatorService::class);

        for ($m = 1; $m <= 3; $m++) {
            $service->calculateForUser($seller, $m, 2026);
        }

        $march = Payroll::where('user_id', $seller->id)->where('period_month', 3)->where('period_year', 2026)->first();

        // Over-payout attempt: only $300 accrued
        $res = $this->putJson("/api/v1/payrolls/{$march->id}", ['thirteenth_month_payout' => 400.00]);
        $res->assertStatus(422);
        $this->assertEquals(0.00, (float) $march->fresh()->thirteenth_month_payout);

        // Exact balance allowed
        $res = $this->putJson("/api/v1/payrolls/{$march->id}", ['thirteenth_month_payout' => 300.00]);
        $res->assertStatus(200);
        $this->assertEquals(0.00, $service->getThirteenthMonthSummary($seller->id)['available_balance']);
    }

    public function test_standalone_payout_above_reserve_or_future_date_rejected(): void
    {
        $seller = $this->makeSeller('Standalone Cap Seller', 1200.00);
        $service = app(PayrollCalculatorService::class);

        for ($m = 1; $m <= 3; $m++) {
            $service->calculateForUser($seller, $m, 2026);
        }

        // Over disbursement
        $res = $this->postJson("/api/v1/users/{$seller->id}/savings/payout", ['amount' => 300.01]);
        $res->assertStatus(422);

        // Future-dated payout
        $res = $this->postJson("/api/v1/users/{$seller->id}/savings/payout", [
            'amount' => 100,
            'payout_date' => now()->addDay()->toDateString(),
        ]);
        $res->assertStatus(422);

        // Valid payout within reserve
        $res = $this->postJson("/api/v1/users/{$seller->id}/savings/payout", ['amount' => 250.00]);
        $res->assertStatus(200);
        $this->assertEquals(50.00, $service->getThirteenthMonthSummary($seller->id)['available_balance']);
    }

    public function test_bulk_mark_paid_transitions_only_eligible_rows(): void
    {
        $sellerA = $this->makeSeller('Bulk Seller A', 600.00);
        $sellerB = $this->makeSeller('Bulk Seller B', 600.00);
        $sellerC = $this->makeSeller('Bulk Seller C', 600.00);
        $service = app(PayrollCalculatorService::class);

        $finalizedA = $service->calculateForUser($sellerA, 4, 2026);
        $finalizedB = $service->calculateForUser($sellerB, 4, 2026);
        $draftC = $service->calculateForUser($sellerC, 4, 2026);

        $finalizedA->status = 'FINALIZED';
        $finalizedA->save();
        $finalizedB->status = 'FINALIZED';
        $finalizedB->save();

        $res = $this->postJson('/api/v1/payrolls/bulk-status', [
            'ids' => [$finalizedA->id, $finalizedB->id, $draftC->id],
            'status' => 'PAID',
        ]);

        $res->assertStatus(200);
        $this->assertEquals(2, $res->json('data.updated'));
        $this->assertCount(1, $res->json('data.failed'));
        $this->assertEquals($draftC->id, $res->json('data.failed.0.id'));

        $this->assertSame('PAID', $finalizedA->fresh()->status);
        $this->assertSame('PAID', $finalizedB->fresh()->status);
        $this->assertSame('DRAFT', $draftC->fresh()->status);
    }

    public function test_audit_trail_records_key_events(): void
    {
        $seller = $this->makeSeller('Audit Seller', 800.00);
        $service = app(PayrollCalculatorService::class);

        // Salary set
        $this->postJson("/api/v1/users/{$seller->id}/salary", ['base_salary' => 850.00])->assertStatus(200);
        $this->assertDatabaseHas('payroll_audit_logs', ['action' => 'SALARY_SET']);

        // Generated (via API — audit logging happens in the controller layer)
        $res = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $seller->id,
            'month' => 7,
            'year' => 2026,
        ]);
        $res->assertStatus(200);
        $payroll = Payroll::where('user_id', $seller->id)->where('period_month', 7)->where('period_year', 2026)->first();
        $this->assertDatabaseHas('payroll_audit_logs', ['action' => 'PAYROLL_GENERATED']);

        // Input edit
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['performance_benefit' => 50])
            ->assertStatus(200);
        $this->assertDatabaseHas('payroll_audit_logs', ['action' => 'PAYROLL_UPDATED']);

        // Status transitions
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'FINALIZED'])->assertStatus(200);
        $this->assertDatabaseHas('payroll_audit_logs', ['action' => 'PAYROLL_STATUS_CHANGED']);

        // Standalone payout
        $this->postJson("/api/v1/users/{$seller->id}/savings/payout", ['amount' => 10.00])->assertStatus(200);
        $this->assertDatabaseHas('payroll_audit_logs', ['action' => 'THIRTEENTH_PAYOUT_RECORDED']);

        // Delete draft releases the payout hold but PAID rows can't be deleted,
        // so delete a fresh draft instead
        $other = $service->calculateForUser($seller, 8, 2026);
        $this->deleteJson("/api/v1/payrolls/{$other->id}")->assertStatus(200);
        $this->assertDatabaseHas('payroll_audit_logs', ['action' => 'PAYROLL_DELETED']);

        $expectedActions = [
            'SALARY_SET',
            'PAYROLL_GENERATED',
            'PAYROLL_UPDATED',
            'PAYROLL_STATUS_CHANGED',
            'THIRTEENTH_PAYOUT_RECORDED',
            'PAYROLL_DELETED',
        ];
        foreach ($expectedActions as $action) {
            $this->assertTrue(
                PayrollAuditLog::where('staff_id', $seller->id)->where('action', $action)->exists(),
                "Expected audit log for {$action}"
            );
        }
    }
}
