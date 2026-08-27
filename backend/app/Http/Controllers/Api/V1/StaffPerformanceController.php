<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Order;
use App\Models\User;
use App\Services\PayrollCalculatorService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffPerformanceController extends BaseApiController
{
    public function myPerformance(Request $request, PayrollCalculatorService $calculator): JsonResponse
    {
        return $this->show($request, $request->user()->id, $calculator);
    }

    public function show(Request $request, string $userId, PayrollCalculatorService $calculator): JsonResponse
    {
        $user = User::findOrFail($userId);

        $period = $request->input('period', '30d');
        $dateFrom = null;
        $dateTo = null;

        $today = Carbon::today();

        switch ($period) {
            case 'today':
                $dateFrom = $today->toDateString();
                $dateTo = $today->toDateString();
                break;
            case '7d':
                $dateFrom = $today->copy()->subDays(6)->toDateString();
                $dateTo = $today->toDateString();
                break;
            case '30d':
                $dateFrom = $today->copy()->subDays(29)->toDateString();
                $dateTo = $today->toDateString();
                break;
            case 'month':
                $month = (int) $request->input('month', $today->month);
                $year = (int) $request->input('year', $today->year);
                $dateFrom = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
                $dateTo = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();
                break;
            case 'year':
                $year = (int) $request->input('year', $today->year);
                $dateFrom = Carbon::create($year, 1, 1)->startOfYear()->toDateString();
                $dateTo = Carbon::create($year, 12, 31)->endOfYear()->toDateString();
                break;
            case 'custom':
                $dateFrom = $request->input('date_from', $today->toDateString());
                $dateTo = $request->input('date_to', $today->toDateString());
                break;
            default:
                $dateFrom = $today->copy()->subDays(29)->toDateString();
                $dateTo = $today->toDateString();
                break;
        }

        $orders = Order::with('salesChannel')
            ->where(function ($q) use ($user) {
                $q->where('seller_id', $user->id)
                  ->orWhere(function ($q2) use ($user) {
                      $q2->where('user_id', $user->id)->whereNull('seller_id');
                  });
            })
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->where(function ($q) use ($dateFrom, $dateTo) {
                $q->where(function ($sub) use ($dateFrom, $dateTo) {
                    $sub->whereNotNull('completed_at')
                        ->whereDate('completed_at', '>=', $dateFrom)
                        ->whereDate('completed_at', '<=', $dateTo);
                })->orWhere(function ($sub) use ($dateFrom, $dateTo) {
                    $sub->whereNull('completed_at')
                        ->whereDate('created_at', '>=', $dateFrom)
                        ->whereDate('created_at', '<=', $dateTo);
                });
            })
            ->orderBy('completed_at', 'asc')
            ->orderBy('created_at', 'asc')
            ->get();

        $totalOrders = $orders->count();
        $totalRevenue = 0.0;
        $totalIncentive = 0.0;
        $dailyMap = [];
        $channelMap = [];

        foreach ($orders as $order) {
            $amt = (float) ($order->total_amount ?? $order->final_amount ?? 0);
            $incentive = $calculator->calculateIncentiveForAmount($amt);

            $totalRevenue += $amt;
            $totalIncentive += $incentive;

            $dateKey = $order->completed_at
                ? Carbon::parse($order->completed_at)->toDateString()
                : Carbon::parse($order->created_at)->toDateString();

            if (!isset($dailyMap[$dateKey])) {
                $dailyMap[$dateKey] = [
                    'date' => $dateKey,
                    'order_count' => 0,
                    'total_revenue' => 0.0,
                    'total_incentive' => 0.0,
                ];
            }
            $dailyMap[$dateKey]['order_count']++;
            $dailyMap[$dateKey]['total_revenue'] += $amt;
            $dailyMap[$dateKey]['total_incentive'] += $incentive;

            $channelName = $order->salesChannel?->name ?? 'Direct POS';
            if (!isset($channelMap[$channelName])) {
                $channelMap[$channelName] = [
                    'channel' => $channelName,
                    'order_count' => 0,
                    'total_revenue' => 0.0,
                ];
            }
            $channelMap[$channelName]['order_count']++;
            $channelMap[$channelName]['total_revenue'] += $amt;
        }

        $avgOrderValue = $totalOrders > 0 ? round($totalRevenue / $totalOrders, 2) : 0.0;

        $dailyTrends = array_values($dailyMap);
        usort($dailyTrends, fn ($a, $b) => strcmp($b['date'], $a['date']));
        foreach ($dailyTrends as &$day) {
            $day['total_revenue'] = round($day['total_revenue'], 2);
            $day['total_incentive'] = round($day['total_incentive'], 2);
        }

        $channels = array_values($channelMap);
        foreach ($channels as &$ch) {
            $ch['total_revenue'] = round($ch['total_revenue'], 2);
            $ch['percentage'] = $totalRevenue > 0 ? round(($ch['total_revenue'] / $totalRevenue) * 100, 1) : 0;
        }
        usort($channels, fn ($a, $b) => $b['total_revenue'] <=> $a['total_revenue']);

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'department' => $user->department,
                'hire_date' => $user->hire_date?->toDateString(),
            ],
            'period' => $period,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'summary' => [
                'total_orders' => $totalOrders,
                'total_revenue' => round($totalRevenue, 2),
                'avg_order_value' => $avgOrderValue,
                'total_incentive' => round($totalIncentive, 2),
            ],
            'total_orders' => $totalOrders,
            'total_revenue' => round($totalRevenue, 2),
            'total_incentive' => round($totalIncentive, 2),
            'avg_order_value' => $avgOrderValue,
            'channel_breakdown' => $channels,
            'daily_trends' => $dailyTrends,
        ]);
    }
}