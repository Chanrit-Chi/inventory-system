<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class AuditLogController extends BaseApiController
{
    /**
     * GET /api/v1/audit-logs
     *
     * Returns paginated audit and security history events.
     * Supports search query, category filter, date bounds, and infinite scrolling.
     */
    public function index(Request $request): JsonResponse
    {
        $logs = [];

        $search = $request->filled('search') ? strtolower(trim($request->input('search'))) : null;
        $category = $request->filled('category') ? strtoupper(trim($request->input('category'))) : 'ALL';
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        // 1. Stock Movements (Inventory, adjustments, restocks)
        if ($category === 'ALL' || $category === 'INVENTORY' || $category === 'STOCK') {
            try {
                $movementQuery = \App\Models\StockMovement::with(['user', 'variant.product']);

                if ($dateFrom) {
                    $movementQuery->whereDate('created_at', '>=', $dateFrom);
                }
                if ($dateTo) {
                    $movementQuery->whereDate('created_at', '<=', $dateTo);
                }

                $movements = $movementQuery->latest('created_at')->limit(150)->get();

                foreach ($movements as $movement) {
                    $itemLabel = $movement->variant?->product?->name ?? ($movement->variant?->sku ?? ($movement->variant_id ?? 'Item'));
                    $change = (int) ($movement->quantity_change ?? 0);
                    $changeStr = ($change >= 0 ? '+' : '') . $change;
                    $actionType = strtoupper($movement->movement_type ?? ($movement->type ?? 'STOCK_MOVEMENT'));

                    $logs[] = [
                        'id'         => (string) $movement->id,
                        'action'     => $actionType,
                        'category'   => 'INVENTORY',
                        'target'     => "{$itemLabel} ({$changeStr})",
                        'by'         => $movement->user?->name ?? 'System Staff',
                        'time'       => $movement->created_at ? $movement->created_at->diffForHumans() : 'Recently',
                        'created_at' => $movement->created_at ? $movement->created_at->toIso8601String() : now()->toIso8601String(),
                        'details'    => $movement->notes ?? "Stock change of {$changeStr} units",
                    ];
                }
            } catch (\Throwable) {
                // Ignore if table unavailable
            }
        }

        // 2. Personal Access Tokens (User Logins & Security)
        if ($category === 'ALL' || $category === 'SECURITY' || $category === 'AUTH') {
            try {
                $tokenQuery = \Laravel\Sanctum\PersonalAccessToken::with('tokenable')
                    ->whereNotNull('last_used_at');

                if ($dateFrom) {
                    $tokenQuery->whereDate('last_used_at', '>=', $dateFrom);
                }
                if ($dateTo) {
                    $tokenQuery->whereDate('last_used_at', '<=', $dateTo);
                }

                $tokens = $tokenQuery->latest('last_used_at')->limit(100)->get();

                foreach ($tokens as $token) {
                    $userName = $token->tokenable?->name ?? ($token->tokenable?->email ?? 'Staff User');
                    $logs[] = [
                        'id'         => 'login-' . $token->id,
                        'action'     => 'USER_LOGIN',
                        'category'   => 'SECURITY',
                        'target'     => $token->tokenable?->email ?? 'POS App Session',
                        'by'         => $userName,
                        'time'       => $token->last_used_at->diffForHumans(),
                        'created_at' => $token->last_used_at->toIso8601String(),
                        'details'    => "Authenticated session token: {$token->name}",
                    ];
                }
            } catch (\Throwable) {
                // Ignore if table unavailable
            }
        }

        // 3. Orders (Sales & Transactions events)
        if ($category === 'ALL' || $category === 'ORDERS' || $category === 'SALES') {
            try {
                $orderQuery = \App\Models\Order::with(['customer', 'user']);

                if ($dateFrom) {
                    $orderQuery->whereDate('created_at', '>=', $dateFrom);
                }
                if ($dateTo) {
                    $orderQuery->whereDate('created_at', '<=', $dateTo);
                }

                $orders = $orderQuery->latest('created_at')->limit(100)->get();

                foreach ($orders as $order) {
                    $status = strtoupper($order->status ?? 'COMPLETED');
                    $amount = number_format((float) ($order->total_amount ?? 0), 2);
                    $logs[] = [
                        'id'         => 'ord-log-' . $order->id,
                        'action'     => "ORDER_{$status}",
                        'category'   => 'ORDERS',
                        'target'     => "Order {$order->order_number} (\${$amount})",
                        'by'         => $order->user?->name ?? 'POS Register',
                        'time'       => $order->created_at ? $order->created_at->diffForHumans() : 'Recently',
                        'created_at' => $order->created_at ? $order->created_at->toIso8601String() : now()->toIso8601String(),
                        'details'    => "Customer: " . ($order->customer?->name ?? 'Walk-in'),
                    ];
                }
            } catch (\Throwable) {
                // Ignore if table unavailable
            }
        }

        // 4. Invoices (Billing & Invoicing events)
        if ($category === 'ALL' || $category === 'BILLING' || $category === 'INVOICES') {
            try {
                $invoiceQuery = \App\Models\Invoice::with(['customer', 'user']);

                if ($dateFrom) {
                    $invoiceQuery->whereDate('created_at', '>=', $dateFrom);
                }
                if ($dateTo) {
                    $invoiceQuery->whereDate('created_at', '<=', $dateTo);
                }

                $invoices = $invoiceQuery->latest('created_at')->limit(100)->get();

                foreach ($invoices as $inv) {
                    $invStatus = strtoupper($inv->status ?? 'ISSUED');
                    $invTotal = number_format((float) ($inv->total_amount ?? 0), 2);
                    $logs[] = [
                        'id'         => 'inv-log-' . $inv->id,
                        'action'     => "INVOICE_{$invStatus}",
                        'category'   => 'BILLING',
                        'target'     => "Invoice {$inv->invoice_number} (\${$invTotal})",
                        'by'         => $inv->user?->name ?? 'Finance Admin',
                        'time'       => $inv->created_at ? $inv->created_at->diffForHumans() : 'Recently',
                        'created_at' => $inv->created_at ? $inv->created_at->toIso8601String() : now()->toIso8601String(),
                        'details'    => "Billed to: {$inv->customer_name}",
                    ];
                }
            } catch (\Throwable) {
                // Ignore if table unavailable
            }
        }

        // 5. Staff Users (Account created / modified)
        if ($category === 'ALL' || $category === 'STAFF' || $category === 'USERS') {
            try {
                $userQuery = \App\Models\User::query();

                if ($dateFrom) {
                    $userQuery->whereDate('created_at', '>=', $dateFrom);
                }
                if ($dateTo) {
                    $userQuery->whereDate('created_at', '<=', $dateTo);
                }

                $users = $userQuery->latest('created_at')->limit(50)->get();

                foreach ($users as $u) {
                    $logs[] = [
                        'id'         => 'user-log-' . $u->id,
                        'action'     => 'USER_PROFILE_SYNC',
                        'category'   => 'STAFF',
                        'target'     => "{$u->name} ({$u->role})",
                        'by'         => 'System Admin',
                        'time'       => $u->created_at ? $u->created_at->diffForHumans() : 'Recently',
                        'created_at' => $u->created_at ? $u->created_at->toIso8601String() : now()->toIso8601String(),
                        'details'    => "Staff email: {$u->email}",
                    ];
                }
            } catch (\Throwable) {
                // Ignore if table unavailable
            }
        }

        // 6. Payroll & Compensation (salary changes, payroll edits, status transitions, payouts)
        if ($category === 'ALL' || $category === 'PAYROLL') {
            try {
                $auditQuery = \App\Models\PayrollAuditLog::with(['actor', 'staff']);

                if ($dateFrom) {
                    $auditQuery->whereDate('created_at', '>=', $dateFrom);
                }
                if ($dateTo) {
                    $auditQuery->whereDate('created_at', '<=', $dateTo);
                }

                $payrollLogs = $auditQuery->latest('created_at')->limit(150)->get();

                foreach ($payrollLogs as $entry) {
                    $changes = $entry->changes ?? [];
                    $detailParts = [];

                    foreach ($changes as $field => $change) {
                        if (is_array($change) && array_key_exists('from', $change)) {
                            $from = $change['from'] ?? 'none';
                            $to = $change['to'] ?? 'none';
                            $detailParts[] = "{$field}: {$from} → {$to}";
                        } else {
                            $detailParts[] = "{$field}: {$change}";
                        }
                    }

                    $logs[] = [
                        'id'         => 'payr-log-' . $entry->id,
                        'action'     => $entry->action,
                        'category'   => 'PAYROLL',
                        'target'     => $entry->subject ?? ($entry->staff?->name ?? 'Staff'),
                        'by'         => $entry->actor?->name ?? 'System',
                        'time'       => $entry->created_at ? $entry->created_at->diffForHumans() : 'Recently',
                        'created_at' => $entry->created_at ? $entry->created_at->toIso8601String() : now()->toIso8601String(),
                        'details'    => $detailParts === [] ? ($entry->subject ?? 'Payroll event') : implode(', ', $detailParts),
                    ];
                }
            } catch (\Throwable) {
                // Ignore if table unavailable
            }
        }

        // Apply text search filtering if provided
        if ($search) {
            $logs = array_filter($logs, function ($item) use ($search) {
                return str_contains(strtolower($item['action'] ?? ''), $search)
                    || str_contains(strtolower($item['target'] ?? ''), $search)
                    || str_contains(strtolower($item['by'] ?? ''), $search)
                    || str_contains(strtolower($item['details'] ?? ''), $search);
            });
        }

        // Sort by created_at descending
        usort($logs, function ($a, $b) {
            return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
        });

        $logs = array_values($logs);

        // Paginate results
        $page = max((int) $request->input('page', 1), 1);
        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);
        $total = count($logs);
        $offset = ($page - 1) * $perPage;
        $itemsForCurrentPage = array_slice($logs, $offset, $perPage);

        $paginator = new LengthAwarePaginator(
            $itemsForCurrentPage,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return $this->paginatedResponse($paginator);
    }
}
