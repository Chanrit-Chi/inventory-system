<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\UserSalary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffPerformanceAndIncentivesTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->admin = User::create([
            'name' => 'Admin Boss',
            'email' => 'admin_boss@pos.local',
            'password' => bcrypt('password123'),
            'role' => 'ADMIN',
            'is_active' => true,
        ]);

        $this->seller = User::create([
            'name' => 'Dara Seller',
            'email' => 'dara_seller@pos.local',
            'password' => bcrypt('password123'),
            'role' => 'SELLER',
            'is_active' => true,
            'department' => 'Sales POS',
            'hire_date' => '2026-01-15',
        ]);
    }

    public function test_staff_performance_endpoint_returns_correct_metrics(): void
    {
        Order::create([
            'order_number' => 'ORD-PERF-01',
            'client_mutation_id' => 'MUT-PERF-01',
            'seller_id' => $this->seller->id,
            'status' => 'COMPLETED',
            'subtotal' => 45.00,
            'total_amount' => 45.00,
            'completed_at' => now(),
        ]);

        Order::create([
            'order_number' => 'ORD-PERF-02',
            'client_mutation_id' => 'MUT-PERF-02',
            'seller_id' => $this->seller->id,
            'status' => 'COMPLETED',
            'subtotal' => 100.00,
            'total_amount' => 100.00,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)->getJson("/api/v1/users/{$this->seller->id}/performance?period=30d");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'summary' => [
                    'total_orders' => 2,
                    'total_revenue' => 145.00,
                    'avg_order_value' => 72.50,
                    'total_incentive' => 2.50,
                ],
            ],
        ]);
    }

    public function test_staff_incentives_endpoint_returns_daily_breakdown_and_orders(): void
    {
        Order::create([
            'order_number' => 'ORD-INC-01',
            'client_mutation_id' => 'MUT-INC-01',
            'seller_id' => $this->seller->id,
            'status' => 'COMPLETED',
            'subtotal' => 25.00,
            'total_amount' => 25.00,
            'completed_at' => now(),
        ]);

        $month = (int) now()->format('n');
        $year = (int) now()->format('Y');

        $response = $this->actingAs($this->admin)->getJson("/api/v1/users/{$this->seller->id}/incentives?month={$month}&year={$year}");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'user',
                'period',
                'summary' => ['total_orders', 'total_sales', 'total_incentive'],
                'tiers',
                'daily_breakdown',
            ],
        ]);
    }

    public function test_salary_history_tracks_raises_and_percentage_delta(): void
    {
        $this->actingAs($this->admin)->postJson("/api/v1/users/{$this->seller->id}/salary", [
            'base_salary' => 500.00,
            'effective_from' => '2026-01-01',
            'reason' => 'Initial Base Salary',
        ])->assertStatus(200);

        $this->actingAs($this->admin)->postJson("/api/v1/users/{$this->seller->id}/salary", [
            'base_salary' => 600.00,
            'effective_from' => '2026-06-01',
            'reason' => 'Mid-year performance raise',
        ])->assertStatus(200);

        $response = $this->actingAs($this->admin)->getJson("/api/v1/users/{$this->seller->id}/salary-history");

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertEquals(600.00, $data['current_salary']);
        $this->assertCount(2, $data['history']);
        $this->assertEquals(20.0, $data['history'][0]['diff_percent']);
        $this->assertEquals(100.0, $data['history'][0]['diff_amount']);
    }
}