<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_reports_analytics_unauthenticated_returns_401(): void
    {
        $response = $this->getJson('/api/v1/reports/analytics');
        $response->assertStatus(401);
    }

    public function test_reports_analytics_presets(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN'])->first();
        $token = $admin->createToken('test')->plainTextToken;

        foreach (['today', '7d', '30d', 'year'] as $period) {
            $response = $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson("/api/v1/reports/analytics?period={$period}");

            $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'period',
                        'date_from',
                        'date_to',
                        'revenue',
                        'ordersCount',
                        'avgTicket',
                        'profit',
                        'expenses',
                        'netProfit',
                        'topProducts',
                        'chartBars',
                    ],
                ]);
        }
    }

    public function test_reports_analytics_single_date_selection(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN'])->first();
        $token = $admin->createToken('test')->plainTextToken;

        $targetDate = Carbon::today()->format('Y-m-d');
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/reports/analytics?period=single&date={$targetDate}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.period', 'single');
    }

    public function test_reports_analytics_custom_date_range(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN'])->first();
        $token = $admin->createToken('test')->plainTextToken;

        $dateFrom = Carbon::now()->subDays(10)->format('Y-m-d');
        $dateTo = Carbon::now()->format('Y-m-d');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/reports/analytics?period=custom&date_from={$dateFrom}&date_to={$dateTo}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.period', 'custom');
    }

    public function test_reports_inventory_analytics(): void
    {
        $admin = User::whereIn('role', ['ADMIN', 'SUPER_ADMIN'])->first();
        $token = $admin->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/reports/inventory');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'total_skus',
                    'total_products',
                    'total_units',
                    'cost_value',
                    'retail_value',
                    'potential_profit',
                    'potential_margin_pct',
                    'healthy_count',
                    'low_stock_count',
                    'out_of_stock_count',
                    'categories_breakdown',
                    'dead_stock_items',
                ],
            ]);
    }
}