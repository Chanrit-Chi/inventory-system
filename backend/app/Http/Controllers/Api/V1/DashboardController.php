<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\ProductVariant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends BaseApiController
{
    /**
     * GET /api/v1/dashboard/summary
     *
     * Returns today's key dashboard KPIs and performance metrics.
     */
    public function summary(Request $request): JsonResponse
    {
        $todayStart = Carbon::today()->startOfDay();
        $todayEnd = Carbon::tomorrow()->startOfDay();
        $yesterdayStart = Carbon::yesterday()->startOfDay();
        $yesterdayEnd = Carbon::today()->startOfDay();

        // 1. Net Revenue: Sum of total_amount for completed orders today
        $netRevenue = (float) Order::where('created_at', '>=', $todayStart)
            ->where('created_at', '<', $todayEnd)
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->sum('total_amount');

        // 2. Orders Count: Count of completed orders today
        $ordersCount = (int) Order::where('created_at', '>=', $todayStart)
            ->where('created_at', '<', $todayEnd)
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->count();

        // 3. Average Basket Value: net_revenue / orders_count
        $avgBasketValue = $ordersCount > 0 ? (float) round($netRevenue / $ordersCount, 2) : 0.0;

        // 4. Digital Payment Percentage: % of today's payments that are not 'Cash'
        $todayPaymentsQuery = Payment::where('created_at', '>=', $todayStart)
            ->where('created_at', '<', $todayEnd)
            ->whereHas('order');

        $totalPaymentsCount = (clone $todayPaymentsQuery)->count();

        if ($totalPaymentsCount > 0) {
            $digitalPaymentsCount = (clone $todayPaymentsQuery)
                ->whereRaw("(payment_method IS NULL OR LOWER(TRIM(payment_method)) != 'cash')")
                ->count();
            $digitalPaymentPercentage = (float) round(($digitalPaymentsCount / $totalPaymentsCount) * 100, 2);
        } else {
            $digitalPaymentPercentage = 0.0;
        }

        // 5. Units Sold: Sum of quantity across all items in today's completed orders
        $unitsSold = (int) OrderItem::whereHas('order', function ($query) use ($todayStart, $todayEnd) {
            $query->where('created_at', '>=', $todayStart)
                ->where('created_at', '<', $todayEnd)
                ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'");
        })->sum('quantity');

        // 6. Low Stock SKUs: Count of variants where quantity_on_hand <= 5
        $lowStockSkus = (int) ProductVariant::where('quantity_on_hand', '<=', 5)->count();

        // 7. Revenue Trend: Compare today's revenue to yesterday's revenue and return % difference
        $yesterdayRevenue = (float) Order::where('created_at', '>=', $yesterdayStart)
            ->where('created_at', '<', $yesterdayEnd)
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->sum('total_amount');

        if ($yesterdayRevenue > 0) {
            $revenueTrend = (float) round((($netRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100, 2);
        } else {
            $revenueTrend = $netRevenue > 0 ? 100.0 : 0.0;
        }

        // 8. Daily Target Progress: Daily target of $10,000 and return % achieved
        $dailyTarget = 10000.0;
        $dailyTargetProgress = (float) round(($netRevenue / $dailyTarget) * 100, 2);

        return $this->successResponse([
            'net_revenue'                => (float) round($netRevenue, 2),
            'orders_count'               => $ordersCount,
            'avg_basket_value'           => $avgBasketValue,
            'digital_payment_percentage' => $digitalPaymentPercentage,
            'units_sold'                 => $unitsSold,
            'low_stock_skus'             => $lowStockSkus,
            'revenue_trend'              => $revenueTrend,
            'daily_target_progress'      => $dailyTargetProgress,
        ]);
    }

    /**
     * GET /api/v1/dashboard/staff-performance
     *
     * Returns today's ranked staff performance leaderboard.
     * Optional query param: ?period=today|week|month (default: today)
     */
    public function staffPerformance(Request $request): JsonResponse
    {
        $period = $request->input('period', 'today');

        [$startDate, $endDate] = match ($period) {
            'week'  => [Carbon::now()->startOfWeek(), Carbon::now()->endOfDay()],
            'month' => [Carbon::now()->startOfMonth(), Carbon::now()->endOfDay()],
            default => [Carbon::today()->startOfDay(), Carbon::tomorrow()->startOfDay()],
        };

        $rows = Order::query()
            ->select([
                'user_id',
                \DB::raw('COUNT(*) as orders_count'),
                \DB::raw('SUM(total_amount) as total_revenue'),
                \DB::raw('AVG(total_amount) as avg_basket'),
                \DB::raw('SUM((SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.order_id = orders.id)) as units_sold'),
            ])
            ->whereNotNull('user_id')
            ->where('created_at', '>=', $startDate)
            ->where('created_at', '<', $endDate)
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->groupBy('user_id')
            ->with('user:id,name,role')
            ->orderByDesc('total_revenue')
            ->get();

        $leaderboard = $rows->map(function ($row, $rank) {
            return [
                'rank'          => $rank + 1,
                'user_id'       => $row->user_id,
                'staff_name'    => $row->user?->name ?? 'Unknown',
                'staff_role'    => $row->user?->role ?? '',
                'orders_count'  => (int) $row->orders_count,
                'total_revenue' => (float) round($row->total_revenue, 2),
                'avg_basket'    => (float) round($row->avg_basket, 2),
                'units_sold'    => (int) ($row->units_sold ?? 0),
            ];
        });

        return $this->successResponse([
            'period'      => $period,
            'leaderboard' => $leaderboard,
        ]);
    }
}
