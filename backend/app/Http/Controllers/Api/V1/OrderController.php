<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\CheckoutRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Services\CheckoutService;
use App\Models\StockMovement;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends BaseApiController
{
    public function __construct(
        private readonly CheckoutService $checkoutService
    ) {}

    /**
     * GET /api/v1/orders
     */
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'channel', 'items.product', 'items.variant.attributeValues.attribute', 'user:id,name', 'seller:id,name'])
            ->whereNull('deleted_at');

        if ($request->filled('status')) {
            $query->where('status', strtoupper($request->input('status')));
        }

        if ($request->filled('channel_id')) {
            $query->where('channel_id', $request->input('channel_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        if ($request->filled('search')) {
            $search = '%' . trim($request->input('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', $search)
                  ->orWhere('delivery_address', 'like', $search)
                  ->orWhere('note', 'like', $search)
                  ->orWhere('notes', 'like', $search)
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', $search)
                         ->orWhere('phone', 'like', $search)
                         ->orWhere('email', 'like', $search);
                  })
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', $search);
                  })
                  ->orWhereHas('seller', function ($sq) use ($search) {
                      $sq->where('name', 'like', $search);
                  })
                  ->orWhereHas('channel', function ($chq) use ($search) {
                      $chq->where('name', 'like', $search);
                  })
                  ->orWhereHas('items', function ($iq) use ($search) {
                      $iq->where('product_name', 'like', $search)
                         ->orWhere('sku', 'like', $search)
                         ->orWhereHas('variant', function ($vq) use ($search) {
                             $vq->where('sku', 'like', $search)
                                ->orWhereHas('product', function ($pq) use ($search) {
                                    $pq->where('name', 'like', $search);
                                });
                         });
                  });
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $orders = $query->latest()->paginate($perPage > 0 ? $perPage : 15);

        return $this->paginatedResponse($orders);
    }

    /**
     * POST /api/v1/orders/checkout
     */
    public function checkout(CheckoutRequest $request): JsonResponse
    {
        try {
            $order = $this->checkoutService->checkout(
                $request->validated(),
                $request->user()
            );
            return $this->createdResponse($order, 'Order placed successfully.');
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        }
    }

    /**
     * GET /api/v1/orders/{id}
     */
    public function show(string $id): JsonResponse
    {
        $order = Order::with([
            'customer',
            'channel',
            'items.variant.attributeValues.attribute',
            'payments',
            'user:id,name',
        ])->findOrFail($id);

        return $this->successResponse($order);
    }

    /**
     * PATCH /api/v1/orders/{id}/status
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:COMPLETED,PENDING,CANCELLED,completed,pending,cancelled'],
            'payment_method' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($request, $id) {
            $order = Order::where('id', $id)->lockForUpdate()->with(['payments', 'customer'])->findOrFail($id);
            $newStatus = strtolower($request->input('status'));
            $currentStatus = strtolower($order->status);

            // Idempotency: if already in target status, return cleanly without duplicating actions
            if ($currentStatus === $newStatus) {
                return $this->successResponse(
                    $order->loadMissing(['customer', 'channel', 'items.variant.attributeValues.attribute', 'payments', 'user:id,name']),
                    'Order status is already ' . $newStatus . '.'
                );
            }

            // --- Status transition guard ---
            $allowedTransitions = [
                'pending'   => ['completed', 'cancelled'],
                'completed' => ['cancelled'],
                'cancelled' => [],  // terminal state
            ];
            if (!in_array($newStatus, $allowedTransitions[$currentStatus] ?? [], true)) {
                return $this->errorResponse(
                    "Cannot transition from '{$currentStatus}' to '{$newStatus}'.",
                    null,
                    422
                );
            }

            // --- RBAC Cancellation Guard ---
            if ($newStatus === 'cancelled') {
                $user = $request->user();
                $userRole = strtoupper((string) ($user?->role ?? ''));
                $canCancel = $user && (
                    in_array($userRole, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'], true)
                    || (method_exists($user, 'hasPermission') && ($user->hasPermission('orders:cancel') || $user->hasPermission('orders:*') || $user->hasPermission('*')))
                );

                if (!$canCancel) {
                    return $this->errorResponse('Unauthorized to cancel orders. Manager or orders:cancel permission required.', null, 403);
                }
            }

            $order->status = $newStatus;
            if ($request->filled('notes')) {
                $order->notes = $request->input('notes');
            }

            if ($newStatus === 'completed') {
                $order->payment_status = 'PAID';
                $order->completed_at = now();
                $method = $request->input('payment_method') ?? ($order->payments->first()?->payment_method ?? 'Cash');
                if ($order->payments->isEmpty()) {
                    $order->payments()->create([
                        'payment_method' => $method,
                        'amount' => $order->total_amount ?? $order->final_amount ?? 0,
                        'status' => 'completed',
                    ]);
                } else {
                    $order->payments()->update([
                        'payment_method' => $method,
                        'status' => 'completed',
                    ]);
                }
            } elseif ($newStatus === 'cancelled') {
                $order->payment_status = 'CANCELLED';

                // Restore stock for each order item (only executed once because of the currentStatus !== newStatus guard)
                $order->loadMissing('items.variant');
                foreach ($order->items as $orderItem) {
                    $variant = $orderItem->variant;
                    if (!$variant) continue;

                    $qtyBefore = $variant->quantity_on_hand;
                    $qtyAfter  = $qtyBefore + $orderItem->quantity;
                    $variant->increment('quantity_on_hand', $orderItem->quantity);

                    StockMovement::create([
                        'variant_id'      => $variant->id,
                        'product_id'      => $variant->product_id,
                        'movement_type'   => 'CANCELLATION_REVERSAL',
                        'quantity_change'  => +$orderItem->quantity,
                        'quantity_before' => $qtyBefore,
                        'quantity_after'  => $qtyAfter,
                        'reference_id'    => $order->order_number,
                        'notes'           => "Stock restored — order {$order->order_number} cancelled",
                        'user_id'         => $request->user()?->id,
                    ]);
                }

                // Reverse customer spend
                if ($order->customer_id && $order->total_amount > 0) {
                    $customer = Customer::find($order->customer_id);
                    if ($customer) {
                        $newPurchased = max(0, (int) $customer->total_purchased - 1);
                        $newSpent = max(0.0, round((float) $customer->total_spent - (float) $order->total_amount, 2));
                        $customer->update([
                            'total_purchased' => $newPurchased,
                            'total_spent'     => $newSpent,
                        ]);
                    }
                }
            } elseif ($newStatus === 'pending') {
                $order->payment_status = 'PENDING';
            }

            $order->save();

            \App\Events\OrderStatusChanged::dispatch($order, $currentStatus, $newStatus);

            return $this->successResponse(
                $order->loadMissing(['customer', 'channel', 'items.variant.attributeValues.attribute', 'payments', 'user:id,name']),
                'Order status updated successfully.'
            );
        });
    }

    /**
     * PATCH/PUT /api/v1/orders/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $order = Order::with(['payments', 'customer'])->findOrFail($id);

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:COMPLETED,PENDING,CANCELLED,completed,pending,cancelled'],
            'payment_method' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'delivery_address' => ['nullable', 'string'],
            'region' => ['nullable', 'string'],
        ]);

        if (isset($validated['status'])) {
            $newStatus = strtolower($validated['status']);

            // --- Status transition guard ---
            $currentStatus = strtolower($order->status);
            $allowedTransitions = [
                'pending'   => ['completed', 'cancelled'],
                'completed' => ['cancelled'],
                'cancelled' => [],  // terminal state
            ];
            if (!in_array($newStatus, $allowedTransitions[$currentStatus] ?? [], true)) {
                return $this->errorResponse(
                    "Cannot transition from '{$currentStatus}' to '{$newStatus}'.",
                    null,
                    422
                );
            }

            // --- RBAC Cancellation Guard ---
            if ($newStatus === 'cancelled') {
                $user = $request->user();
                $userRole = strtoupper((string) ($user?->role ?? ''));
                $canCancel = $user && (
                    in_array($userRole, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'], true)
                    || (method_exists($user, 'hasPermission') && ($user->hasPermission('orders:cancel') || $user->hasPermission('orders:*') || $user->hasPermission('*')))
                );

                if (!$canCancel) {
                    return $this->errorResponse('Unauthorized to cancel orders. Manager or orders:cancel permission required.', null, 403);
                }
            }

            $order->status = $newStatus;
            if ($newStatus === 'completed') {
                $order->payment_status = 'PAID';
            } elseif ($newStatus === 'cancelled') {
                $order->payment_status = 'CANCELLED';
            } elseif ($newStatus === 'pending') {
                $order->payment_status = 'PENDING';
            }
        }

        if (array_key_exists('notes', $validated)) {
            $order->notes = $validated['notes'];
        }
        if (array_key_exists('delivery_address', $validated)) {
            $order->delivery_address = $validated['delivery_address'];
        }
        if (array_key_exists('region', $validated)) {
            $order->region = $validated['region'];
        }

        if (!empty($validated['payment_method']) && $order->payments->isNotEmpty()) {
            $firstPayment = $order->payments->first();
            if ($firstPayment instanceof Payment) {
                $firstPayment->update([
                    'payment_method' => $validated['payment_method'],
                ]);
            }
        }

        $order->save();

        return $this->successResponse(
            $order->loadMissing(['customer', 'channel', 'items.variant.attributeValues.attribute', 'payments', 'user:id,name']),
            'Order updated successfully.'
        );
    }
}

