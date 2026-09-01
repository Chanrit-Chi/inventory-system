<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\Quotation;
use App\Models\RestockSession;
use App\Models\UserNotificationState;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends BaseApiController
{
    /**
     * Helper to compute a human-friendly relative time string.
     */
    private function formatRelativeTime(?Carbon $date): string
    {
        if (!$date) {
            return 'Just now';
        }

        $now = Carbon::now();
        $diffSeconds = $now->diffInSeconds($date, false);
        $absDiff = abs($diffSeconds);

        if ($absDiff < 60) {
            return 'Just now';
        }

        $diffMinutes = (int) floor($absDiff / 60);
        if ($diffMinutes < 60) {
            return $diffMinutes . 'm ago';
        }

        $diffHours = (int) floor($diffMinutes / 60);
        if ($diffHours < 24) {
            return $diffHours . 'h ago';
        }

        $diffDays = (int) floor($diffHours / 24);
        if ($diffDays < 7) {
            return $diffDays . 'd ago';
        }

        return $date->format('M j');
    }

    /**
     * Collect all raw active notifications.
     */
    private function collectSystemNotifications(): array
    {
        $notifications = [];

        // 1. Low Stock Alerts (reorder_level fallback <= 5)
        try {
            $lowStockVariants = ProductVariant::with('product')
                ->where(function ($q) {
                    $q->whereRaw('quantity_on_hand <= COALESCE(reorder_level, 5)');
                })
                ->orderBy('quantity_on_hand', 'asc')
                ->limit(10)
                ->get();

            foreach ($lowStockVariants as $variant) {
                $pName = $variant->product?->name ?? 'Product Item';
                $sku = $variant->sku ? " ({$variant->sku})" : '';
                $qty = (int) $variant->quantity_on_hand;
                $threshold = (int) ($variant->reorder_level ?? 5);
                $date = $variant->updated_at ? Carbon::parse($variant->updated_at) : Carbon::now();

                $notifications[] = [
                    'id'         => 'low_stock_' . $variant->id,
                    'title'      => 'Low Stock Alert: ' . $pName . $sku,
                    'desc'       => "Stock is down to {$qty} " . ($qty === 1 ? 'unit' : 'units') . " (Threshold: {$threshold}).",
                    'variant'    => 'warning',
                    'to'         => '/inventory',
                    'type'       => 'low_stock',
                    'created_at' => $date->toIso8601String(),
                    '_carbon'    => $date,
                ];
            }
        } catch (\Throwable $e) {
            // Graceful degrade if table structure is being migrated
        }

        // 2. Recent Restock Sessions
        try {
            $recentRestocks = RestockSession::with('user')
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get();

            foreach ($recentRestocks as $session) {
                $code = $session->session_code ?? substr($session->id, 0, 8);
                $status = ucfirst(strtolower($session->status ?? 'pending'));
                $cost = number_format((float) ($session->total_cost ?? 0), 2);
                $date = $session->created_at ? Carbon::parse($session->created_at) : Carbon::now();

                $notifications[] = [
                    'id'         => 'restock_' . $session->id,
                    'title'      => "Restock Batch #{$code} ({$status})",
                    'desc'       => "Inbound inventory session recorded. Total value: \${$cost}.",
                    'variant'    => 'info',
                    'to'         => '/restock',
                    'type'       => 'restock',
                    'created_at' => $date->toIso8601String(),
                    '_carbon'    => $date,
                ];
            }
        } catch (\Throwable $e) {
        }

        // 3. Recent Completed Orders
        try {
            $recentOrders = Order::whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
                ->orderBy('created_at', 'desc')
                ->limit(6)
                ->get();

            foreach ($recentOrders as $order) {
                $num = $order->order_number ?? substr($order->id, 0, 8);
                $total = number_format((float) ($order->total_amount ?? 0), 2);
                $channel = $order->channel_type ?? 'POS';
                $date = $order->created_at ? Carbon::parse($order->created_at) : Carbon::now();

                $notifications[] = [
                    'id'         => 'order_' . $order->id,
                    'title'      => "Order #{$num} Completed",
                    'desc'       => "Checkout sale of \${$total} successfully settled via {$channel}.",
                    'variant'    => 'success',
                    'to'         => '/orders',
                    'type'       => 'order',
                    'created_at' => $date->toIso8601String(),
                    '_carbon'    => $date,
                ];
            }
        } catch (\Throwable $e) {
        }

        // 4. Pending / Overdue Invoices
        try {
            $pendingInvoices = Invoice::whereIn('status', ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'])
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get();

            foreach ($pendingInvoices as $invoice) {
                $num = $invoice->invoice_number ?? substr($invoice->id, 0, 8);
                $bal = number_format((float) ($invoice->balance_due ?? $invoice->total_amount ?? 0), 2);
                $cust = $invoice->customer_name ? " for {$invoice->customer_name}" : '';
                $status = ucfirst(strtolower($invoice->status));
                $date = $invoice->created_at ? Carbon::parse($invoice->created_at) : Carbon::now();

                $notifications[] = [
                    'id'         => 'invoice_' . $invoice->id,
                    'title'      => "Invoice #{$num} ({$status})",
                    'desc'       => "Outstanding balance of \${$bal}{$cust}.",
                    'variant'    => 'warning',
                    'to'         => '/invoices',
                    'type'       => 'invoice',
                    'created_at' => $date->toIso8601String(),
                    '_carbon'    => $date,
                ];
            }
        } catch (\Throwable $e) {
        }

        // 5. Open Quotations
        try {
            $openQuotations = Quotation::whereIn('status', ['PENDING', 'DRAFT'])
                ->orderBy('created_at', 'desc')
                ->limit(4)
                ->get();

            foreach ($openQuotations as $quotation) {
                $num = $quotation->quotation_number ?? substr($quotation->id, 0, 8);
                $total = number_format((float) ($quotation->total_amount ?? 0), 2);
                $cust = $quotation->customer_name ? " for {$quotation->customer_name}" : '';
                $date = $quotation->created_at ? Carbon::parse($quotation->created_at) : Carbon::now();

                $notifications[] = [
                    'id'         => 'quotation_' . $quotation->id,
                    'title'      => "Quotation #{$num} Open",
                    'desc'       => "Proposal of \${$total}{$cust} pending customer approval.",
                    'variant'    => 'info',
                    'to'         => '/quotations',
                    'type'       => 'quotation',
                    'created_at' => $date->toIso8601String(),
                    '_carbon'    => $date,
                ];
            }
        } catch (\Throwable $e) {
        }

        // 6. Security Audit Events
        try {
            $recentAudits = AuditLog::orderBy('occurred_at', 'desc')
                ->limit(4)
                ->get();

            foreach ($recentAudits as $log) {
                $action = ucwords(str_replace(['.', '_', '-'], ' ', $log->action ?? 'Action'));
                $actor = $log->actor_name ?? 'System';
                $target = $log->target ? " on {$log->target}" : '';
                $date = $log->occurred_at ? Carbon::parse($log->occurred_at) : ($log->created_at ? Carbon::parse($log->created_at) : Carbon::now());

                $notifications[] = [
                    'id'         => 'audit_' . $log->id,
                    'title'      => "Security Log: {$action}",
                    'desc'       => "{$actor} performed {$action}{$target}.",
                    'variant'    => 'info',
                    'to'         => '/audit-logs',
                    'type'       => 'audit',
                    'created_at' => $date->toIso8601String(),
                    '_carbon'    => $date,
                ];
            }
        } catch (\Throwable $e) {
        }

        // Sort descending by _carbon date
        usort($notifications, function ($a, $b) {
            return $b['_carbon']->getTimestamp() <=> $a['_carbon']->getTimestamp();
        });

        return $notifications;
    }

    /**
     * GET /api/v1/notifications
     *
     * List all dynamic notifications with user read/dismiss states applied.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rawNotifications = $this->collectSystemNotifications();

        $userStates = UserNotificationState::where('user_id', $user->id)
            ->get()
            ->keyBy('notification_key');

        $result = [];
        foreach ($rawNotifications as $item) {
            $key = $item['id'];
            $state = $userStates->get($key);

            // Skip dismissed notifications
            if ($state && $state->is_dismissed) {
                continue;
            }

            $unread = $state ? !$state->is_read : true;
            $carbonDate = $item['_carbon'];

            unset($item['_carbon']);
            $item['unread'] = $unread;
            $item['time'] = $this->formatRelativeTime($carbonDate);

            $result[] = $item;
        }

        return $this->successResponse($result);
    }

    /**
     * GET /api/v1/notifications/unread-count
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $rawNotifications = $this->collectSystemNotifications();

        $userStates = UserNotificationState::where('user_id', $user->id)
            ->get()
            ->keyBy('notification_key');

        $unreadCount = 0;
        foreach ($rawNotifications as $item) {
            $key = $item['id'];
            $state = $userStates->get($key);

            if ($state && $state->is_dismissed) {
                continue;
            }

            if (!$state || !$state->is_read) {
                $unreadCount++;
            }
        }

        return $this->successResponse([
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * PATCH /api/v1/notifications/{id}/read
     */
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        UserNotificationState::updateOrCreate(
            [
                'user_id'          => $user->id,
                'notification_key' => $id,
            ],
            [
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]
        );

        return $this->successResponse(null, 'Notification marked as read.');
    }

    /**
     * POST /api/v1/notifications/mark-all-read
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $rawNotifications = $this->collectSystemNotifications();

        foreach ($rawNotifications as $item) {
            $key = $item['id'];
            UserNotificationState::updateOrCreate(
                [
                    'user_id'          => $user->id,
                    'notification_key' => $key,
                ],
                [
                    'is_read' => true,
                    'read_at' => Carbon::now(),
                ]
            );
        }

        return $this->successResponse(null, 'All notifications marked as read.');
    }

    /**
     * DELETE /api/v1/notifications/{id}
     * (or POST /api/v1/notifications/{id}/dismiss)
     */
    public function dismiss(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        UserNotificationState::updateOrCreate(
            [
                'user_id'          => $user->id,
                'notification_key' => $id,
            ],
            [
                'is_dismissed' => true,
                'dismissed_at' => Carbon::now(),
            ]
        );

        return $this->successResponse(null, 'Notification dismissed.');
    }
}
