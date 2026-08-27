<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\User;
use App\Models\UserSalary;
use App\Services\PayrollCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollUpdateApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function makeSellerWithSalary(float $base): User
    {
        $user = User::create([
            'name' => 'Update Test Seller ' . uniqid(),
            'email' => 'update_test_' . uniqid() . '@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'SELLER',
        ]);
        UserSalary::create(['user_id' => $user->id, 'base_salary' => $base]);

        return $user;
    }

    public function test_updates_payroll_inputs_including_working_days_and_recalculates(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $user = $this->makeSellerWithSalary(520.00);
        $payroll = app(PayrollCalculatorService::class)->calculateForUser($user, 8, 2026);

        $response = $this->putJson("/api/v1/payrolls/{$payroll->id}", [
            'working_days' => 22,
            'overtime_days' => 2,
            'unpaid_leave_days' => 1,
            'performance_benefit' => 50,
            'delivery_benefit' => 30,
            'collective_benefit' => 15,
            'other_benefits' => 10,
        ]);

        $response->assertStatus(200)->assertJson(['success' => true]);

        $fresh = $payroll->fresh();
        $this->assertSame(22, (int) $fresh->working_days);
        $this->assertEquals(round(2 * (520.0 / 22), 2), (float) $fresh->overtime_amount);
        $this->assertEquals(round(1 * (520.0 / 22), 2), (float) $fresh->unpaid_leave_deduction);

        // net = 520 + perf 50 + deliv 30 + OT + collec 15 + other 10 - unpaid deduction
        $ot = round(2 * (520.0 / 22), 2);
        $ded = round(1 * (520.0 / 22), 2);
        $this->assertEquals(round(520 + 50 + 30 + $ot + 15 + 10 - $ded, 2), (float) $fresh->total_net_pay);
    }

    public function test_finalize_status_applies_after_recalculation_in_same_request(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $user = $this->makeSellerWithSalary(260.00);
        $payroll = app(PayrollCalculatorService::class)->calculateForUser($user, 9, 2026);

        // Edit benefit AND finalize in one request — totals must still update
        $response = $this->putJson("/api/v1/payrolls/{$payroll->id}", [
            'performance_benefit' => 100,
            'status' => 'FINALIZED',
        ]);

        $response->assertStatus(200);
        $fresh = $payroll->fresh();
        $this->assertSame('FINALIZED', $fresh->status);
        $this->assertEquals(100.0, (float) $fresh->performance_benefit);
        $this->assertEquals(360.0, (float) $fresh->total_net_pay); // 260 base + 100 perf
    }

    public function test_rejects_negative_overtime_and_unpaid_leave_days(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $user = $this->makeSellerWithSalary(520.00);
        $payroll = app(PayrollCalculatorService::class)->calculateForUser($user, 7, 2026);

        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['unpaid_leave_days' => -3])
            ->assertStatus(422);

        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['overtime_days' => -1])
            ->assertStatus(422);
    }

    public function test_manual_incentive_override_wins_over_auto_calculation(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $user = $this->makeSellerWithSalary(520.00);
        $payroll = app(PayrollCalculatorService::class)->calculateForUser($user, 8, 2026);

        // Switch to manual with a fixed amount
        $response = $this->putJson("/api/v1/payrolls/{$payroll->id}", [
            'incentive_override' => 12.50,
        ]);
        $response->assertStatus(200);
        $this->assertEquals(12.50, (float) $payroll->fresh()->incentive_amount);
        $this->assertEquals(532.50, (float) $payroll->fresh()->total_net_pay); // 520 + 12.50

        // Switch back to auto (null override) — recalculates from orders (none = 0)
        $response = $this->putJson("/api/v1/payrolls/{$payroll->id}", [
            'incentive_override' => null,
        ]);
        $response->assertStatus(200);
        $fresh = $payroll->fresh();
        $this->assertNull($fresh->incentive_override);
        $this->assertEquals(0.0, (float) $fresh->incentive_amount);
        $this->assertEquals(520.00, (float) $fresh->total_net_pay);
    }

    public function test_finalized_payroll_rejects_input_edits_but_allows_reopen(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $user = $this->makeSellerWithSalary(260.00);
        $payroll = app(PayrollCalculatorService::class)->calculateForUser($user, 9, 2026);
        $payroll->status = 'FINALIZED';
        $payroll->save();

        // Editing inputs on FINALIZED must be rejected
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['performance_benefit' => 99])
            ->assertStatus(422);

        // Status-only transition back to DRAFT is allowed...
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['status' => 'DRAFT'])
            ->assertStatus(200);
        $this->assertSame('DRAFT', $payroll->fresh()->status);

        // ...and now inputs can be edited again
        $this->putJson("/api/v1/payrolls/{$payroll->id}", ['performance_benefit' => 100])
            ->assertStatus(200);
        $this->assertEquals(360.0, (float) $payroll->fresh()->total_net_pay); // 260 + 100
    }

    public function test_salary_raise_does_not_repopulate_historical_periods(): void
    {
        $service = app(PayrollCalculatorService::class);
        $user = $this->makeSellerWithSalary(520.00);

        // Give the raise an effective date in a later year
        UserSalary::create([
            'user_id' => $user->id,
            'base_salary' => 780.00,
            'effective_from' => '2027-01-01',
        ]);

        // 2026 payroll must still use the OLD salary
        $old = $service->calculateForUser($user, 6, 2026);
        $this->assertEquals(520.00, (float) $old->base_salary);

        // 2027 payroll uses the NEW salary
        $new = $service->calculateForUser($user, 2, 2027);
        $this->assertEquals(780.00, (float) $new->base_salary);

        // Regenerating the old draft again must STILL use the old salary
        $regenerated = $service->calculateForUser($user, 6, 2026);
        $this->assertEquals(520.00, (float) $regenerated->base_salary);
    }

    public function test_draft_can_be_deleted_but_finalized_cannot(): void
    {
        Sanctum::actingAs(User::where('role', 'SUPER_ADMIN')->first());

        $user = $this->makeSellerWithSalary(520.00);
        $draft = app(PayrollCalculatorService::class)->calculateForUser($user, 5, 2026);

        $this->deleteJson("/api/v1/payrolls/{$draft->id}")
            ->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertDatabaseMissing('payrolls', ['id' => $draft->id]);

        $finalized = app(PayrollCalculatorService::class)->calculateForUser($user, 6, 2026);
        $finalized->update(['status' => 'FINALIZED']);

        $this->deleteJson("/api/v1/payrolls/{$finalized->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('payrolls', ['id' => $finalized->id]);
    }
}
