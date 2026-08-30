<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Order;
use App\Models\SellerDailySettlement;
use App\Models\User;
use App\Services\PayrollCalculatorService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SellerDailySettlementController extends BaseApiController
{
    public function __construct(
        private readonly PayrollCalculatorService $calculator
    ) {}

    /**
     * GET /api/v1/seller-settlements/summary
     * Retrieve itemized daily sales, colleague-assisted sales, incentive, and confirmation proof for a seller.
     */
    public function summary(Request $request): JsonResponse
    {
        $actor = $request->user();
        $targetDate = $request->input('date', Carbon::today()->toDateString());
        $sellerId = $request->input('seller_id', $actor?->id);

        $seller = User::findOrFail($sellerId);

        // Retrieve orders credited to this seller for the target date
        $orders = Order::with(['salesChannel', 'customer:id,name,phone', 'user:id,name,role', 'items'])
            ->where(function ($q) use ($seller) {
                $q->where('seller_id', $seller->id)
                  ->orWhere(function ($q2) use ($seller) {
                      $q2->where('user_id', $seller->id)->whereNull('seller_id');
                  });
            })
            ->whereRaw("UPPER(TRIM(status)) != 'CANCELLED'")
            ->where(function ($q) use ($targetDate) {
                $q->whereDate('completed_at', $targetDate)
                  ->orWhere(function ($sub) use ($targetDate) {
                      $sub->whereNull('completed_at')
                          ->whereDate('created_at', $targetDate);
                  });
            })
            ->orderBy('created_at', 'desc')
            ->get();

        $directOrders = [];
        $assistedOrders = [];
        $totalSales = 0.0;
        $totalIncentive = 0.0;
        $orderIds = [];

        foreach ($orders as $order) {
            $amt = (float) ($order->total_amount ?? $order->final_amount ?? 0);
            $inc = $this->calculator->calculateIncentiveForAmount($amt);

            $totalSales += $amt;
            $totalIncentive += $inc;
            $orderIds[] = $order->id;

            $isDirect = empty($order->seller_id) || $order->seller_id === $order->user_id;

            $orderPayload = [
                'id'             => $order->id,
                'order_number'   => $order->order_number,
                'status'         => $order->status,
                'total_amount'   => $amt,
                'incentive'      => $inc,
                'items_count'    => $order->items->sum('quantity') ?: $order->items->count(),
                'customer_name'  => $order->customer?->name ?? 'Walk-in Customer',
                'channel_name'   => $order->salesChannel?->name ?? 'Store POS',
                'created_at'     => $order->created_at?->toDateTimeString(),
                'input_by_user'  => $order->user ? ['id' => $order->user->id, 'name' => $order->user->name, 'role' => $order->user->role] : null,
                'is_assisted'    => !$isDirect,
            ];

            if ($isDirect) {
                $directOrders[] = $orderPayload;
            } else {
                $assistedOrders[] = $orderPayload;
            }
        }

        // Check if an existing settlement proof exists
        $normalizedDate = Carbon::parse($targetDate)->toDateString();
        $existingSettlement = SellerDailySettlement::with('confirmer:id,name')
            ->where('seller_id', $seller->id)
            ->where(function ($q) use ($normalizedDate) {
                $q->where('confirmed_date', $normalizedDate)
                  ->orWhereDate('confirmed_date', $normalizedDate);
            })
            ->first();

        return $this->successResponse([
            'seller'                 => ['id' => $seller->id, 'name' => $seller->name, 'role' => $seller->role],
            'date'                   => $normalizedDate,
            'is_today'               => $normalizedDate === Carbon::today()->toDateString(),
            'total_orders_count'     => $orders->count(),
            'direct_orders_count'    => count($directOrders),
            'assisted_orders_count'  => count($assistedOrders),
            'total_sales_amount'     => round($totalSales, 2),
            'total_incentive_amount' => round($totalIncentive, 2),
            'direct_orders'          => $directOrders,
            'assisted_orders'        => $assistedOrders,
            'settlement'             => $existingSettlement,
            'is_confirmed'           => $existingSettlement !== null && $existingSettlement->status === 'CONFIRMED',
        ]);
    }

    /**
     * POST /api/v1/seller-settlements/confirm
     * Confirm / sign off on daily sales and create an immutable proof record.
     */
    public function confirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seller_id'      => ['nullable', 'uuid', 'exists:users,id'],
            'confirmed_date' => ['required', 'string'],
            'notes'          => ['nullable', 'string', 'max:500'],
        ]);

        $actor = $request->user();
        $sellerId = $validated['seller_id'] ?? $actor->id;
        $targetDate = Carbon::parse($validated['confirmed_date'])->toDateString();

        $seller = User::findOrFail($sellerId);

        return DB::transaction(function () use ($seller, $targetDate, $actor, $validated) {
            // Re-calculate the exact live snapshot
            $orders = Order::where(function ($q) use ($seller) {
                    $q->where('seller_id', $seller->id)
                      ->orWhere(function ($q2) use ($seller) {
                          $q2->where('user_id', $seller->id)->whereNull('seller_id');
                      });
                })
                ->whereRaw("UPPER(TRIM(status)) != 'CANCELLED'")
                ->where(function ($q) use ($targetDate) {
                    $q->whereDate('completed_at', $targetDate)
                      ->orWhere(function ($sub) use ($targetDate) {
                          $sub->whereNull('completed_at')
                              ->whereDate('created_at', $targetDate);
                      });
                })
                ->get();

            $totalSales = 0.0;
            $totalIncentive = 0.0;
            $orderIds = [];

            foreach ($orders as $order) {
                $amt = (float) ($order->total_amount ?? $order->final_amount ?? 0);
                $inc = $this->calculator->calculateIncentiveForAmount($amt);
                $totalSales += $amt;
                $totalIncentive += $inc;
                $orderIds[] = $order->id;
            }

            if (count($orderIds) === 0) {
                return $this->errorResponse('Cannot sign off: No orders or sales recorded for this staff member on this date.', 422);
            }

            $settlement = SellerDailySettlement::where('seller_id', $seller->id)
                ->where(function ($q) use ($targetDate) {
                    $q->where('confirmed_date', $targetDate)
                      ->orWhereDate('confirmed_date', $targetDate);
                })
                ->first();

            if (!$settlement) {
                $settlement = new SellerDailySettlement();
                $settlement->seller_id = $seller->id;
                $settlement->confirmed_date = $targetDate;
            }

            $settlement->total_orders_count     = count($orderIds);
            $settlement->total_sales_amount     = round($totalSales, 2);
            $settlement->total_incentive_amount = round($totalIncentive, 2);
            $settlement->status                 = 'CONFIRMED';
            $settlement->confirmed_at           = now();
            $settlement->confirmed_by           = $actor->id;
            $settlement->order_ids              = $orderIds;
            $settlement->notes                  = $validated['notes'] ?? null;
            $settlement->save();

            return $this->successResponse(
                $settlement->load(['seller:id,name', 'confirmer:id,name']),
                'Daily sales successfully confirmed and signed off.'
            );
        });
    }

    /**
     * POST /api/v1/seller-settlements/reassign-order
     * Reassign an order to a seller if missed during checkout.
     */
    public function reassignOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id'      => ['required', 'uuid', 'exists:orders,id'],
            'new_seller_id' => ['required', 'uuid', 'exists:users,id'],
            'reason'        => ['nullable', 'string', 'max:255'],
        ]);

        $order = Order::findOrFail($validated['order_id']);
        $newSeller = User::findOrFail($validated['new_seller_id']);

        $previousSellerId = $order->seller_id;
        $order->seller_id = $newSeller->id;
        if ($request->filled('reason')) {
            $order->notes = ($order->notes ? $order->notes . ' • ' : '') . "Reassigned seller to {$newSeller->name} ({$validated['reason']})";
        }
        $order->save();

        // If there were existing settlements for this date for previous or new seller, mark them as REVISED
        $orderDate = $order->completed_at ? Carbon::parse($order->completed_at)->toDateString() : Carbon::parse($order->created_at)->toDateString();

        SellerDailySettlement::whereIn('seller_id', array_filter([$previousSellerId, $newSeller->id]))
            ->where('confirmed_date', $orderDate)
            ->update(['status' => 'REVISED']);

        return $this->successResponse(
            $order->load(['seller:id,name', 'user:id,name']),
            "Order #{$order->order_number} successfully credited to {$newSeller->name}."
        );
    }

    /**
     * GET /api/v1/seller-settlements/team-daily
     * Manager reconciliation: retrieve all eligible sellers and their daily confirmation status for a given date.
     */
    public function teamDailySummary(Request $request): JsonResponse
    {
        $targetDate = $request->input('date', Carbon::today()->toDateString());
        $normalizedDate = Carbon::parse($targetDate)->toDateString();

        // 1. Get all active non-superadmin staff members
        $sellers = User::whereNull('deleted_at')
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('role')
                  ->orWhereRaw("UPPER(TRIM(role)) NOT IN ('SUPER_ADMIN', 'SUPERADMIN')");
            })
            ->orderBy('name')
            ->get();

        // 2. Fetch all orders for this date
        $orders = Order::with(['seller:id,name', 'user:id,name'])
            ->whereRaw("UPPER(TRIM(status)) != 'CANCELLED'")
            ->where(function ($q) use ($normalizedDate) {
                $q->whereDate('completed_at', $normalizedDate)
                  ->orWhere(function ($sub) use ($normalizedDate) {
                      $sub->whereNull('completed_at')
                          ->whereDate('created_at', $normalizedDate);
                  });
            })
            ->get();

        // 3. Fetch all settlement records for this date
        $settlements = SellerDailySettlement::with('confirmer:id,name')
            ->where(function ($q) use ($normalizedDate) {
                $q->where('confirmed_date', $normalizedDate)
                  ->orWhereDate('confirmed_date', $normalizedDate);
            })
            ->get()
            ->keyBy('seller_id');

        $sellerSummaries = [];
        $totalTeamSales = 0.0;
        $totalTeamIncentives = 0.0;
        $totalOrdersCount = 0;
        $totalConfirmedSellers = 0;
        $totalActiveSellersWithSales = 0;

        foreach ($sellers as $seller) {
            // Find orders credited to this seller
            $sellerOrders = $orders->filter(function ($ord) use ($seller) {
                if (!empty($ord->seller_id)) {
                    return $ord->seller_id === $seller->id;
                }
                return $ord->user_id === $seller->id;
            });

            $salesSum = 0.0;
            $incentiveSum = 0.0;
            $directCount = 0;
            $assistedCount = 0;

            foreach ($sellerOrders as $ord) {
                $amt = (float) ($ord->total_amount ?? $ord->final_amount ?? 0);
                $inc = $this->calculator->calculateIncentiveForAmount($amt);
                $salesSum += $amt;
                $incentiveSum += $inc;

                $isDirect = empty($ord->seller_id) || $ord->seller_id === $ord->user_id;
                if ($isDirect) {
                    $directCount++;
                } else {
                    $assistedCount++;
                }
            }

            $settlement = $settlements->get($seller->id);
            $isConfirmed = $settlement !== null && $settlement->status === 'CONFIRMED';
            $status = $settlement ? $settlement->status : ($sellerOrders->count() > 0 ? 'PENDING' : 'NO_SALES');

            if ($isConfirmed) {
                $totalConfirmedSellers++;
            }
            if ($sellerOrders->count() > 0) {
                $totalActiveSellersWithSales++;
            }

            $totalTeamSales += $salesSum;
            $totalTeamIncentives += $incentiveSum;
            $totalOrdersCount += $sellerOrders->count();

            $sellerSummaries[] = [
                'seller'                 => [
                    'id'         => $seller->id,
                    'name'       => $seller->name,
                    'role'       => $seller->role,
                    'email'      => $seller->email,
                    'department' => $seller->department,
                ],
                'total_orders_count'     => $sellerOrders->count(),
                'direct_orders_count'    => $directCount,
                'assisted_orders_count'  => $assistedCount,
                'total_sales_amount'     => round($salesSum, 2),
                'total_incentive_amount' => round($incentiveSum, 2),
                'is_confirmed'           => $isConfirmed,
                'status'                 => $status,
                'settlement'             => $settlement ? [
                    'id'           => $settlement->id,
                    'status'       => $settlement->status,
                    'confirmed_at' => $settlement->confirmed_at?->toDateTimeString(),
                    'confirmed_by' => $settlement->confirmer ? ['id' => $settlement->confirmer->id, 'name' => $settlement->confirmer->name] : null,
                    'notes'        => $settlement->notes,
                ] : null,
            ];
        }

        return $this->successResponse([
            'date'                        => $normalizedDate,
            'is_today'                    => $normalizedDate === Carbon::today()->toDateString(),
            'total_sellers_count'         => count($sellers),
            'active_sellers_with_sales'   => $totalActiveSellersWithSales,
            'confirmed_sellers_count'     => $totalConfirmedSellers,
            'total_team_sales_amount'     => round($totalTeamSales, 2),
            'total_team_incentive_amount' => round($totalTeamIncentives, 2),
            'total_team_orders_count'     => $totalOrdersCount,
            'sellers'                     => $sellerSummaries,
        ]);
    }
}
