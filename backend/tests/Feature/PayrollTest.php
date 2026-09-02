<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payroll;
use App\Models\User;
use App\Models\UserSalary;
use App\Services\PayrollCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_incentive_calculation_based_on_order_total_amount(): void
    {
        $service = new PayrollCalculatorService();

        // < 1 -> 0
        $this->assertEquals(0.0, $service->calculateIncentiveForAmount(0.50));
        
        // 1 - 30 -> 0.25
        $this->assertEquals(0.25, $service->calculateIncentiveForAmount(1.00));
        $this->assertEquals(0.25, $service->calculateIncentiveForAmount(15.00));
        $this->assertEquals(0.25, $service->calculateIncentiveForAmount(30.00));

        // >30 - 50 -> 0.50
        $this->assertEquals(0.50, $service->calculateIncentiveForAmount(30.01));
        $this->assertEquals(0.50, $service->calculateIncentiveForAmount(45.00));
        $this->assertEquals(0.50, $service->calculateIncentiveForAmount(50.00));

        // >50 - 60 -> 0.75
        $this->assertEquals(0.75, $service->calculateIncentiveForAmount(50.01));
        $this->assertEquals(0.75, $service->calculateIncentiveForAmount(60.00));

        // >60 - 80 -> 1.00
        $this->assertEquals(1.00, $service->calculateIncentiveForAmount(60.01));
        $this->assertEquals(1.00, $service->calculateIncentiveForAmount(80.00));

        // >80 -> 2.00
        $this->assertEquals(2.00, $service->calculateIncentiveForAmount(80.01));
        $this->assertEquals(2.00, $service->calculateIncentiveForAmount(150.00));
    }

    public function test_full_payroll_calculation_with_all_benefits_and_leave(): void
    {
        $user = User::create([
            'name' => 'Payroll Dedicated User',
            'email' => 'payroll_dedicated_test@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'SELLER',
        ]);

        UserSalary::create([
            'user_id' => $user->id,
            'base_salary' => 520.00,
        ]);

        // Create 3 orders with amounts: $20 ($0.25), $40 ($0.50), $100 ($2.00) -> Incentive = $2.75
        Order::create([
            'order_number' => 'ORD-TEST-001',
            'client_mutation_id' => 'MUT-TEST-001',
            'seller_id' => $user->id,
            'status' => 'COMPLETED',
            'subtotal' => 20.00,
            'total_amount' => 20.00,
        ]);
        Order::create([
            'order_number' => 'ORD-TEST-002',
            'client_mutation_id' => 'MUT-TEST-002',
            'seller_id' => $user->id,
            'status' => 'COMPLETED',
            'subtotal' => 40.00,
            'total_amount' => 40.00,
        ]);
        Order::create([
            'order_number' => 'ORD-TEST-003',
            'client_mutation_id' => 'MUT-TEST-003',
            'seller_id' => $user->id,
            'status' => 'COMPLETED',
            'subtotal' => 100.00,
            'total_amount' => 100.00,
        ]);

        $service = new PayrollCalculatorService();
        $month = (int) now()->format('n');
        $year = (int) now()->format('Y');

        $payroll = $service->calculateForUser($user, $month, $year);

        // Working days default = 26. Daily rate = 520 / 26 = 20.00
        $this->assertEquals(520.00, $payroll->base_salary);
        $this->assertEquals(2.75, $payroll->incentive_amount);
        $this->assertEquals(round(520.00 / 12, 2), round($payroll->thirteenth_month_contribution, 2));

        // Initial net pay without adjustments: 520 + 2.75 = 522.75
        $this->assertEquals(522.75, $payroll->total_net_pay);

        // Update with custom inputs: OT 2 days ($40), unpaid leave 1 day (-$20), benefits
        $payroll->overtime_days = 2; // +40
        $payroll->unpaid_leave_days = 1; // -20
        $payroll->performance_benefit = 50.00;
        $payroll->delivery_benefit = 30.00;
        $payroll->collective_benefit = 15.00;
        $payroll->other_benefits = 10.00;
        $payroll->save();

        $updated = $service->calculateForUser($user, $month, $year);

        // Total = 520 (base) + 2.75 (incentive) + 50 (perf) + 30 (deliv) + 40 (OT) + 15 (collec) + 10 (other) - 20 (unpaid leave)
        // = 647.75
        $this->assertEquals(647.75, $updated->total_net_pay);
    }

    public function test_generate_payroll_api_endpoint_structure(): void
    {
        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $targetUser = User::where('role', 'SELLER')->first();

        $response = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $targetUser->id,
            'month' => 8,
            'year' => 2026,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id',
                    'user_id',
                    'period_month',
                    'period_year',
                    'base_salary',
                    'incentive_amount',
                    'total_net_pay',
                ],
            ]);
    }

    public function test_cannot_generate_duplicate_payroll_for_same_user_and_period(): void
    {
        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $targetUser = User::where('role', 'SELLER')->first();

        // 1. First generation succeeds
        $res1 = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $targetUser->id,
            'month' => 9,
            'year' => 2026,
        ]);
        $res1->assertStatus(200);

        // 2. Second generation attempt for same user/month/year must be rejected with 422
        $res2 = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $targetUser->id,
            'month' => 9,
            'year' => 2026,
        ]);
        $res2->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_marking_payroll_as_paid_automatically_logs_salary_expense(): void
    {
        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $targetUser = User::where('role', 'SELLER')->first();

        // 1. Generate a payroll (status starts as DRAFT)
        $res = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $targetUser->id,
            'month' => 10,
            'year' => 2026,
        ]);
        $res->assertStatus(200);
        $payrollId = $res->json('data.id');
        $netPay = (float) $res->json('data.total_net_pay');

        // No expense logged yet while DRAFT
        $this->assertDatabaseMissing('expenses', ['payroll_id' => $payrollId]);

        // 2. Transition DRAFT -> FINALIZED
        $this->putJson("/api/v1/payrolls/{$payrollId}", ['status' => 'FINALIZED'])->assertStatus(200);
        $this->assertDatabaseMissing('expenses', ['payroll_id' => $payrollId]);

        // 3. Transition FINALIZED -> PAID
        $this->putJson("/api/v1/payrolls/{$payrollId}", ['status' => 'PAID'])->assertStatus(200);

        // Expense must now be present with category 'Salary' and matching net pay
        $this->assertDatabaseHas('expenses', [
            'payroll_id' => $payrollId,
            'category' => 'Salary',
            'amount' => $netPay,
        ]);
    }

    public function test_draft_payroll_does_not_create_expense_until_paid(): void
    {
        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $targetUser = User::where('role', 'SELLER')->first();

        // Generate -> DRAFT
        $res = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $targetUser->id,
            'month' => 11,
            'year' => 2026,
        ]);
        $payrollId = $res->json('data.id');
        $this->assertDatabaseMissing('expenses', ['payroll_id' => $payrollId]);

        // Delete draft payroll
        $this->deleteJson("/api/v1/payrolls/{$payrollId}")->assertStatus(200);
        $this->assertDatabaseMissing('expenses', ['payroll_id' => $payrollId]);
    }

    public function test_standalone_thirteenth_month_payout_automatically_logs_salary_expense(): void
    {
        $admin = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($admin);

        $targetUser = User::where('role', 'SELLER')->first();

        // Configure base salary for user
        $this->postJson("/api/v1/users/{$targetUser->id}/salary", ['base_salary' => 600.00])->assertStatus(200);

        // Generate and finalize payroll with 13th month contribution so reserve balance > 0
        $pRes = $this->postJson('/api/v1/payrolls/generate', [
            'user_id' => $targetUser->id,
            'month' => 1,
            'year' => 2026,
        ]);
        $pRes->assertStatus(200);
        $pId = $pRes->json('data.id');
        $this->putJson("/api/v1/payrolls/{$pId}", ['status' => 'FINALIZED'])->assertStatus(200);

        // Disburse standalone payout
        $res = $this->postJson("/api/v1/users/{$targetUser->id}/savings/payout", [
            'amount' => 10.00,
            'payout_date' => '2026-06-15',
            'payment_method' => 'Bank Transfer',
            'notes' => 'Mid-year Seniority Bonus',
        ]);
        $res->assertStatus(200);

        // Check auto-logged Expense
        $this->assertDatabaseHas('expenses', [
            'user_id' => $targetUser->id,
            'category' => 'Salary',
            'amount' => 10.00,
        ]);
    }

    public function test_company_thirteenth_month_reserves_overview(): void
    {
        $admin = User::create([
            'name' => 'Admin Payroll Tester',
            'email' => 'admin_payroll_res_test@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'ADMIN',
            'is_active' => true,
        ]);
        $staff = User::create([
            'name' => 'Staff 13th Tester',
            'email' => 'staff_13th_res_test@pos.local',
            'password' => bcrypt('Password123!'),
            'role' => 'SELLER',
            'is_active' => true,
        ]);

        // Give staff a base salary of 600
        \App\Models\UserSalary::create([
            'user_id' => $staff->id,
            'base_salary' => 600.00,
            'effective_from' => now()->startOfYear()->toDateString(),
            'created_by' => $admin->id,
        ]);

        // Create a payroll with 13th month contribution
        $this->actingAs($admin)->postJson('/api/v1/payrolls/generate', [
            'period_month' => 1,
            'period_year' => (int) now()->format('Y'),
            'user_ids' => [$staff->id],
        ]);

        $response = $this->actingAs($admin)->getJson('/api/v1/payrolls/13th-month-reserves?year=' . now()->format('Y'));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'year',
                    'kpi' => [
                        'company_total_accrued',
                        'company_total_disbursed',
                        'company_total_available_balance',
                        'eligible_staff_count',
                    ],
                    'staff' => [
                        '*' => [
                            'user_id',
                            'name',
                            'email',
                            'role',
                            'department',
                            'base_salary',
                            'monthly_accrual',
                            'months_accrued',
                            'total_accrued',
                            'total_disbursed',
                            'available_balance',
                            'payouts',
                        ]
                    ]
                ]
            ]);

        $this->assertGreaterThan(0, $response->json('data.kpi.eligible_staff_count'));
    }
}