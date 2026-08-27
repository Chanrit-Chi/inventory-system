<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Order;
use App\Models\User;
use App\Services\PayrollCalculatorService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffIncentiveController extends BaseApiController
{
    public function myIncentives(Request $request, PayrollCalculatorService $calculator): JsonResponse
    {
        return $this->show($request, $request->user()->id, $calculator);
    }

    public function show(Request $request, string $userId, PayrollCalculatorService $calculator): JsonResponse
    {
        $user = User::findOrFail($userId);

        $month = (int) $request->input('month', Carbon::now()->month);
        $year = (int) $request->input('year', Carbon::now()->year);

        $startDate = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
        $endDate = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

        $orders = Order::with('salesChannel')
            ->where(function ($q) use ($user) {
                $q->where('seller_id', $user->id)
                  ->orWhere(function ($q2) use ($user) {
                      $q2->where('user_id', $user->id)->whereNull('seller_id');
                  });
            })
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
            ->where(function ($q) use ($month, $year) {
                $q->where(function ($sub) use ($month, $year) {
                    $sub->whereNotNull('completed_at')
                        ->whereMonth('completed_at', $month)
                        ->whereYear('completed_at', $year);
                })->orWhere(function ($sub) use ($month, $year) {
                    $sub->whereNull('completed_at')
                        ->whereMonth('created_at', $month)
                        ->whereYear('created_at', $year);
                });
            })
            ->orderBy('completed_at', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        $totalOrders = $orders->count();
        $totalSales = 0.0;
        $totalIncentive = 0.0;
        $dailyMap = [];

        foreach ($orders as $order) {
            $amt = (float) ($order->total_amount ?? $order->final_amount ?? 0);
            $incentive = $calculator->calculateIncentiveForAmount($amt);

            $totalSales += $amt;
            $totalIncentive += $incentive;

            $dateKey = $order->completed_at
                ? Carbon::parse($order->completed_at)->toDateString()
                : Carbon::parse($order->created_at)->toDateString();

            if (!isset($dailyMap[$dateKey])) {
                $dailyMap[$dateKey] = [
                    'date' => $dateKey,
                    'order_count' => 0,
                    'total_sales' => 0.0,
                    'total_incentive' => 0.0,
                    'orders' => [],
                ];
            }

            $dailyMap[$dateKey]['order_count']++;
            $dailyMap[$dateKey]['total_sales'] += $amt;
            $dailyMap[$dateKey]['total_incentive'] += $incentive;

            $dailyMap[$dateKey]['orders'][] = [
                'id' => $order->id,
                'order_number' => $order->order_number ?? substr($order->id, 0, 8),
                'total_amount' => round($amt, 2),
                'incentive' => round($incentive, 2),
                'completed_at' => $order->completed_at?->toDateTimeString() ?? $order->created_at?->toDateTimeString(),
                'channel_name' => $order->salesChannel?->name ?? 'Direct POS',
                'customer_name' => $order->customer_name ?? 'Walk-in Customer',
            ];
        }

        $dailyList = array_values($dailyMap);
        usort($dailyList, fn ($a, $b) => strcmp($b['date'], $a['date']));

        foreach ($dailyList as &$d) {
            $d['total_sales'] = round($d['total_sales'], 2);
            $d['total_incentive'] = round($d['total_incentive'], 2);
        }

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ],
            'period' => [
                'month' => $month,
                'year' => $year,
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'summary' => [
                'total_orders' => $totalOrders,
                'total_sales' => round($totalSales, 2),
                'total_incentive' => round($totalIncentive, 2),
            ],
            'tiers' => [
                ['label' => '$1.00 – $30.00', 'rate' => 0.25],
                ['label' => '>$30.00 – $50.00', 'rate' => 0.50],
                ['label' => '>$50.00 – $60.00', 'rate' => 0.75],
                ['label' => '>$60.00 – $80.00', 'rate' => 1.00],
                ['label' => '>$80.00', 'rate' => 2.00],
            ],
            'daily_breakdown' => $dailyList,
        ]);
    }
}