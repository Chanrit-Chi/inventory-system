<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\UserSalary;
use App\Services\PayrollCalculatorService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffSeniorityAndProbationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $newProbationStaff;
    protected User $seniorStaff;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->admin = User::create([
            'name' => 'Admin Boss',
            'email' => 'boss@inventory.local',
            'password' => bcrypt('password123'),
            'role' => 'ADMIN',
            'is_active' => true,
        ]);

        // Hired 1 month ago -> Currently in 3-month probation period
        $this->newProbationStaff = User::create([
            'name' => 'New Probation Cashier',
            'email' => 'probation@inventory.local',
            'password' => bcrypt('password123'),
            'role' => 'SELLER',
            'is_active' => true,
            'hire_date' => Carbon::create(2026, 7, 1)->toDateString(),
        ]);

        UserSalary::create([
            'user_id' => $this->newProbationStaff->id,
            'base_salary' => 300.00,
            'effective_from' => '2026-07-01',
            'created_by' => $this->admin->id,
        ]);

        // Hired 6 months ago -> Passed 3-month probation
        $this->seniorStaff = User::create([
            'name' => 'Senior Seller',
            'email' => 'senior@inventory.local',
            'password' => bcrypt('password123'),
            'role' => 'SELLER',
            'is_active' => true,
            'hire_date' => Carbon::create(2026, 1, 1)->toDateString(),
        ]);

        UserSalary::create([
            'user_id' => $this->seniorStaff->id,
            'base_salary' => 400.00,
            'effective_from' => '2026-01-01',
            'created_by' => $this->admin->id,
        ]);
    }

    public function test_probation_staff_receives_only_base_salary_and_zero_benefits(): void
    {
        // Add completed sales orders for probation staff in Month 8 (August 2026)
        Order::create([
            'order_number' => 'ORD-PROB-01',
            'client_mutation_id' => 'MUT-PROB-01',
            'seller_id' => $this->newProbationStaff->id,
            'status' => 'COMPLETED',
            'subtotal' => 100.00,
            'total_amount' => 100.00,
            'completed_at' => Carbon::create(2026, 8, 15),
        ]);

        $service = new PayrollCalculatorService();
        $payroll = $service->calculateForUser($this->newProbationStaff, 8, 2026);

        // Base salary is preserved
        $this->assertEquals(300.00, $payroll->base_salary);
        // During 3-month probation: NO incentives/bonuses
        $this->assertEquals(0.00, $payroll->incentive_amount);
        // During 3-month probation: NO 13th month accrual
        $this->assertEquals(0.00, $payroll->thirteenth_month_contribution);
        // Net pay is strictly base salary (300.00)
        $this->assertEquals(300.00, $payroll->total_net_pay);
    }

    public function test_senior_staff_passed_probation_receives_incentives_and_13th_month_accruals(): void
    {
        // Add completed sales orders for senior staff in Month 8 (August 2026)
        Order::create([
            'order_number' => 'ORD-SEN-01',
            'client_mutation_id' => 'MUT-SEN-01',
            'seller_id' => $this->seniorStaff->id,
            'status' => 'COMPLETED',
            'subtotal' => 100.00,
            'total_amount' => 100.00,
            'completed_at' => Carbon::create(2026, 8, 15),
        ]);

        $service = new PayrollCalculatorService();
        $payroll = $service->calculateForUser($this->seniorStaff, 8, 2026);

        // Base salary
        $this->assertEquals(400.00, $payroll->base_salary);
        // Passed probation: Incentive calculated from sales ($100 * 2.5% = $2.50)
        $this->assertGreaterThan(0, $payroll->incentive_amount);
        // Passed probation: 13th month accrued ($400 / 12 = 33.33)
        $this->assertEquals(round(400.00 / 12, 2), round($payroll->thirteenth_month_contribution, 2));
    }

    public function test_reserves_overview_flags_probation_metadata(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/payrolls/13th-month-reserves?year=2026');

        $response->assertStatus(200);
        $staff = collect($response->json('data.staff'));

        $probationRecord = $staff->firstWhere('user_id', $this->newProbationStaff->id);
        $this->assertNotNull($probationRecord);
        $this->assertTrue($probationRecord['is_on_probation']);
        $this->assertFalse($probationRecord['benefits_eligible']);

        $seniorRecord = $staff->firstWhere('user_id', $this->seniorStaff->id);
        $this->assertNotNull($seniorRecord);
        $this->assertFalse($seniorRecord['is_on_probation']);
        $this->assertTrue($seniorRecord['benefits_eligible']);
    }

    public function test_probation_exempt_staff_receives_immediate_full_benefits(): void
    {
        // New hire (hired yesterday), but probation is waived (probation_exempt = true)
        $exemptStaff = User::create([
            'name' => 'Exempt Senior Transfer',
            'email' => 'exempt@inventory.local',
            'password' => bcrypt('password123'),
            'role' => 'SELLER',
            'is_active' => true,
            'hire_date' => Carbon::create(2026, 8, 1)->toDateString(),
            'probation_exempt' => true,
        ]);

        UserSalary::create([
            'user_id' => $exemptStaff->id,
            'base_salary' => 500.00,
            'effective_from' => '2026-08-01',
            'created_by' => $this->admin->id,
        ]);

        Order::create([
            'order_number' => 'ORD-EXEMPT-01',
            'client_mutation_id' => 'MUT-EXEMPT-01',
            'seller_id' => $exemptStaff->id,
            'status' => 'COMPLETED',
            'subtotal' => 100.00,
            'total_amount' => 100.00,
            'completed_at' => Carbon::create(2026, 8, 15),
        ]);

        $service = new PayrollCalculatorService();
        $payroll = $service->calculateForUser($exemptStaff, 8, 2026);

        // Even though hired in Month 8, probation_exempt grants full benefits from Day 1
        $this->assertFalse($exemptStaff->isOnProbation());
        $this->assertEquals(500.00, $payroll->base_salary);
        $this->assertGreaterThan(0, $payroll->incentive_amount);
        $this->assertEquals(round(500.00 / 12, 2), round($payroll->thirteenth_month_contribution, 2));
    }
}
