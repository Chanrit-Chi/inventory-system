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
        $period = $request->input('period', '30d');
        $dateFrom = $request->input('date_from') ?: $request->input('from');
        $dateTo = $request->input('date_to') ?: $request->input('to');

        if (!empty($dateFrom)) {
            $startDate = Carbon::parse($dateFrom)->startOfDay();
            $endDate = !empty($dateTo) ? Carbon::parse($dateTo)->endOfDay() : Carbon::now()->endOfDay();
        } else {
            [$startDate, $endDate] = match ($period) {
                'today' => [Carbon::today()->startOfDay(), Carbon::tomorrow()->startOfDay()],
                'week', '7d' => [Carbon::now()->subDays(6)->startOfDay(), Carbon::now()->endOfDay()],
                'year' => [Carbon::now()->startOfYear(), Carbon::now()->endOfDay()],
                'month', '30d' => [Carbon::now()->subDays(29)->startOfDay(), Carbon::now()->endOfDay()],
                default => [Carbon::now()->subDays(29)->startOfDay(), Carbon::now()->endOfDay()],
            };
        }

        // Fetch all active staff users
        $allUsers = \App\Models\User::whereNull('deleted_at')
            ->where('is_active', true)
            ->get();

        // Aggregate orders per staff member in the date range
        $orderAggregates = Order::query()
            ->where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->select([
                \DB::raw('COALESCE(seller_id, user_id, created_by) as staff_id'),
                \DB::raw('COUNT(id) as orders_count'),
                \DB::raw('SUM(total_amount) as total_revenue'),
                \DB::raw('AVG(total_amount) as avg_basket'),
                \DB::raw('SUM((SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.order_id = orders.id)) as units_sold'),
            ])
            ->whereRaw('COALESCE(seller_id, user_id, created_by) IS NOT NULL')
            ->groupBy(\DB::raw('COALESCE(seller_id, user_id, created_by)'))
            ->get()
            ->keyBy('staff_id');

        $leaderboardList = [];

        foreach ($allUsers as $user) {
            $agg = $orderAggregates->get($user->id);
            $ordersCount = $agg ? (int) $agg->orders_count : 0;
            $revenue = $agg ? (float) round($agg->total_revenue, 2) : 0.0;
            $avgBasket = $agg && $ordersCount > 0 ? (float) round($agg->avg_basket, 2) : 0.0;
            $unitsSold = $agg ? (int) $agg->units_sold : 0;

            $leaderboardList[] = [
                'user_id'         => $user->id,
                'staff_name'      => $user->name,
                'staff_role'      => $user->role ?? 'Staff',
                'orders_count'    => $ordersCount,
                'total_orders'    => $ordersCount,
                'total_revenue'   => $revenue,
                'total_sales'     => $revenue,
                'avg_basket'      => $avgBasket,
                'avg_order_value' => $avgBasket,
                'units_sold'      => $unitsSold,
            ];
        }

        // Also check if there are orders attributed to IDs not in allUsers
        foreach ($orderAggregates as $staffId => $agg) {
            if (!$allUsers->contains('id', $staffId)) {
                $user = \App\Models\User::find($staffId);
                $ordersCount = (int) $agg->orders_count;
                $revenue = (float) round($agg->total_revenue, 2);
                $avgBasket = $ordersCount > 0 ? (float) round($agg->avg_basket, 2) : 0.0;
                $unitsSold = (int) $agg->units_sold;

                $leaderboardList[] = [
                    'user_id'         => $staffId,
                    'staff_name'      => $user?->name ?? 'Staff Member',
                    'staff_role'      => $user?->role ?? 'Staff',
                    'orders_count'    => $ordersCount,
                    'total_orders'    => $ordersCount,
                    'total_revenue'   => $revenue,
                    'total_sales'     => $revenue,
                    'avg_basket'      => $avgBasket,
                    'avg_order_value' => $avgBasket,
                    'units_sold'      => $unitsSold,
                ];
            }
        }

        // Sort by total_revenue desc, then orders_count desc
        usort($leaderboardList, function ($a, $b) {
            if ($b['total_revenue'] !== $a['total_revenue']) {
                return $b['total_revenue'] <=> $a['total_revenue'];
            }
            return $b['orders_count'] <=> $a['orders_count'];
        });

        // Assign ranks
        $leaderboard = array_map(function ($item, $idx) {
            $item['rank'] = $idx + 1;
            return $item;
        }, $leaderboardList, array_keys($leaderboardList));

        return $this->successResponse([
            'period'      => $period,
            'leaderboard' => $leaderboard,
        ]);
    }
}
