<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\PushToken;
use App\Models\RestockSession;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushNotificationService
{
    /**
     * Expo Push API Gateway endpoint.
     */
    protected string $expoApiUrl;

    /**
     * Optional Expo Access Token for higher rate limits.
     */
    protected ?string $accessToken;

    /**
     * Create a new PushNotificationService instance.
     */
    public function __construct(?string $expoApiUrl = null, ?string $accessToken = null)
    {
        $this->expoApiUrl = $expoApiUrl ?? config('services.expo.url', 'https://exp.host/--/api/v2/push/send');
        $this->accessToken = $accessToken ?? config('services.expo.access_token', env('EXPO_ACCESS_TOKEN'));
    }

    /**
     * Send push notifications to a list of tokens in batches of up to 100.
     * Prunes dead tokens when Expo returns 'DeviceNotRegistered'.
     *
     * @param  array<string>  $tokens
     * @param  array<string, mixed>  $payload
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function sendPush(array $tokens, array $payload): array
    {
        // 1. Sanitize, filter, and deduplicate tokens
        $validTokens = array_values(array_unique(array_filter($tokens, function ($token) {
            return is_string($token) && trim($token) !== '';
        })));

        if (empty($validTokens)) {
            return [
                'sent' => 0,
                'failed' => 0,
                'purged' => [],
            ];
        }

        $sentCount = 0;
        $failedCount = 0;
        $purgedTokens = [];

        // 2. Chunk into batches of up to 100 tokens
        $chunks = array_chunk($validTokens, 100);

        $headers = [
            'Accept' => 'application/json',
            'Accept-Encoding' => 'gzip, deflate',
            'Content-Type' => 'application/json',
        ];

        if (!empty($this->accessToken)) {
            $headers['Authorization'] = 'Bearer ' . $this->accessToken;
        }

        foreach ($chunks as $chunk) {
            $messages = [];
            foreach ($chunk as $token) {
                $message = [
                    'to' => $token,
                    'title' => $payload['title'] ?? 'OmniPOS Notification',
                    'body' => $payload['body'] ?? ($payload['desc'] ?? ''),
                    'data' => $payload['data'] ?? [],
                    'sound' => $payload['sound'] ?? 'default',
                ];

                if (isset($payload['priority'])) {
                    $message['priority'] = $payload['priority'];
                }
                if (isset($payload['channelId'])) {
                    $message['channelId'] = $payload['channelId'];
                }
                if (isset($payload['badge'])) {
                    $message['badge'] = (int) $payload['badge'];
                }

                $messages[] = $message;
            }

            try {
                $response = Http::withHeaders($headers)
                    ->timeout(10)
                    ->post($this->expoApiUrl, $messages);

                if ($response->successful()) {
                    $data = $response->json('data');
                    if (is_array($data)) {
                        foreach ($data as $index => $ticket) {
                            $token = $chunk[$index] ?? null;
                            $status = $ticket['status'] ?? 'unknown';

                            if ($status === 'ok') {
                                $sentCount++;
                            } else {
                                $failedCount++;
                                $errorType = $ticket['details']['error'] ?? null;

                                // Prune dead token immediately on DeviceNotRegistered
                                if ($errorType === 'DeviceNotRegistered' && $token) {
                                    PushToken::where('token', $token)->delete();
                                    $purgedTokens[] = $token;
                                    Log::info("[PushNotificationService] Pruned dead push token: {$token}");
                                } else {
                                    Log::warning("[PushNotificationService] Push ticket error for token {$token}: " . json_encode($ticket));
                                }
                            }
                        }
                    } else {
                        $failedCount += count($chunk);
                        Log::warning("[PushNotificationService] Unexpected response structure from Expo API: " . $response->body());
                    }
                } else {
                    $failedCount += count($chunk);
                    Log::error("[PushNotificationService] Expo API returned HTTP {$response->status()}: " . $response->body());
                }
            } catch (\Throwable $e) {
                $failedCount += count($chunk);
                Log::error("[PushNotificationService] Expo API request exception: " . $e->getMessage());
            }
        }

        return [
            'sent' => $sentCount,
            'failed' => $failedCount,
            'purged' => array_values(array_unique($purgedTokens)),
        ];
    }

    /**
     * Send push notification to a specific user.
     *
     * @param  User|string  $user
     * @param  array<string, mixed>  $payload
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function sendToUser(User|string $user, array $payload): array
    {
        if (is_string($user)) {
            $user = User::with('pushTokens')->find($user);
        }

        if (!$user) {
            return ['sent' => 0, 'failed' => 0, 'purged' => []];
        }

        $isActive = array_key_exists('is_active', $user->getAttributes())
            ? (bool) $user->is_active
            : true;

        if (!$isActive) {
            return ['sent' => 0, 'failed' => 0, 'purged' => []];
        }

        if (!$user->relationLoaded('pushTokens')) {
            $user->load('pushTokens');
        }

        $tokens = $user->pushTokens->pluck('token')->filter()->all();
        return $this->sendPush($tokens, $payload);
    }

    /**
     * Send push notification to users having specific roles, with an optional user filter closure.
     *
     * @param  array<string>  $roles
     * @param  array<string, mixed>  $payload
     * @param  (callable(User): bool)|null  $userFilter
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function sendToRoles(array $roles, array $payload, ?callable $userFilter = null): array
    {
        $normalizedRoles = array_map(function ($r) {
            $clean = strtoupper(trim((string) $r));
            return $clean === 'CASHIER' ? 'SELLER' : $clean;
        }, $roles);

        $query = User::where('is_active', true)
            ->where(function ($q) use ($normalizedRoles) {
                $q->whereIn('role', $normalizedRoles)
                  ->orWhereHas('roleRelation', function ($sub) use ($normalizedRoles) {
                      $sub->whereIn('slug', $normalizedRoles);
                  });
            })
            ->with('pushTokens');

        $users = $query->get();

        if ($userFilter !== null) {
            $users = $users->filter($userFilter);
        }

        $tokens = $users->flatMap(function (User $user) {
            return $user->pushTokens->pluck('token');
        })->filter()->unique()->values()->all();

        return $this->sendPush($tokens, $payload);
    }

    /**
     * Dispatch Low Stock notification:
     * Target roles: SUPER_ADMIN, ADMIN, MANAGER, SELLER
     *
     * @param  ProductVariant|array  $variant
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function notifyLowStock(ProductVariant|array $variant): array
    {
        $id = is_array($variant) ? ($variant['id'] ?? '') : $variant->id;
        $sku = is_array($variant) ? ($variant['sku'] ?? '') : $variant->sku;
        $skuStr = $sku ? " ({$sku})" : '';
        $qty = is_array($variant) ? (int) ($variant['quantity_on_hand'] ?? 0) : (int) ($variant->quantity_on_hand ?? 0);
        $threshold = is_array($variant) ? (int) ($variant['reorder_level'] ?? 5) : (int) ($variant->reorder_level ?? 5);

        $pName = 'Product Item';
        if (is_array($variant)) {
            $pName = $variant['product']['name'] ?? ($variant['product_name'] ?? 'Product Item');
        } elseif ($variant->relationLoaded('product') && $variant->product) {
            $pName = $variant->product->name;
        } elseif (!empty($variant->name)) {
            $pName = $variant->name;
        }

        $payload = [
            'title' => "Low Stock Alert: {$pName}{$skuStr}",
            'body' => "Stock is down to {$qty} " . ($qty === 1 ? 'unit' : 'units') . " (Threshold: {$threshold}).",
            'data' => [
                'type' => 'low_stock',
                'id' => 'low_stock_' . $id,
                'variant_id' => $id,
                'to' => '/inventory',
            ],
            'priority' => 'high',
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'], $payload);
    }

    /**
     * Dispatch Restock Completed notification:
     * Target roles: SUPER_ADMIN, ADMIN, MANAGER (SELLER strictly excluded)
     *
     * @param  RestockSession|array  $session
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function notifyRestockCompleted(RestockSession|array $session): array
    {
        $id = is_array($session) ? ($session['id'] ?? '') : $session->id;
        $code = is_array($session)
            ? ($session['session_code'] ?? substr((string) $id, 0, 8))
            : ($session->session_code ?? substr((string) $session->id, 0, 8));
        $status = is_array($session) ? ($session['status'] ?? 'verified') : ($session->status ?? 'verified');
        $statusStr = ucfirst(strtolower($status));
        $cost = is_array($session)
            ? number_format((float) ($session['total_cost'] ?? 0), 2)
            : number_format((float) ($session->total_cost ?? 0), 2);

        $payload = [
            'title' => "Restock Batch #{$code} ({$statusStr})",
            'body' => "Inbound inventory session recorded. Total value: \${$cost}.",
            'data' => [
                'type' => 'restock',
                'id' => 'restock_' . $id,
                'session_id' => $id,
                'to' => '/restock',
            ],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], $payload);
    }

    /**
     * Dispatch Order Completed notification:
     * Target roles: SUPER_ADMIN, ADMIN, MANAGER, and matching SELLER only
     * (Seller receives ONLY if order.user_id === seller.id or order.seller_id === seller.id)
     *
     * @param  Order|array  $order
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function notifyOrderCompleted(Order|array $order): array
    {
        $id = is_array($order) ? ($order['id'] ?? '') : $order->id;
        $num = is_array($order)
            ? ($order['order_number'] ?? substr((string) $id, 0, 8))
            : ($order->order_number ?? substr((string) $order->id, 0, 8));
        $total = is_array($order)
            ? number_format((float) ($order['total_amount'] ?? 0), 2)
            : number_format((float) ($order->total_amount ?? 0), 2);

        $sellerId = is_array($order)
            ? ($order['seller_id'] ?? ($order['user_id'] ?? ($order['created_by'] ?? null)))
            : ($order->seller_id ?? ($order->user_id ?? ($order->created_by ?? null)));

        $userFilter = function (User $user) use ($sellerId) {
            $role = strtoupper(trim((string) $user->role));
            if ($role === 'CASHIER') {
                $role = 'SELLER';
            }

            // Admins and managers always receive order notifications
            if (in_array($role, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'], true)) {
                return true;
            }

            // Sellers receive ONLY if they are the designated seller of this order
            if ($role === 'SELLER') {
                return $sellerId !== null && (string) $user->id === (string) $sellerId;
            }

            return false;
        };

        $payload = [
            'title' => "Order #{$num} Completed",
            'body' => "Checkout sale of \${$total} successfully settled.",
            'data' => [
                'type' => 'order',
                'id' => 'order_' . $id,
                'order_id' => $id,
                'to' => '/orders',
            ],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'], $payload, $userFilter);
    }

    /**
     * Dispatch Invoice Overdue notification:
     * Target roles: SUPER_ADMIN, ADMIN, MANAGER, SELLER
     *
     * @param  Invoice|array  $invoice
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function notifyInvoiceOverdue(Invoice|array $invoice): array
    {
        $id = is_array($invoice) ? ($invoice['id'] ?? '') : $invoice->id;
        $num = is_array($invoice)
            ? ($invoice['invoice_number'] ?? substr((string) $id, 0, 8))
            : ($invoice->invoice_number ?? substr((string) $invoice->id, 0, 8));
        $bal = is_array($invoice)
            ? number_format((float) ($invoice['balance_due'] ?? ($invoice['total_amount'] ?? 0)), 2)
            : number_format((float) ($invoice->balance_due ?? ($invoice->total_amount ?? 0)), 2);
        $custName = is_array($invoice) ? ($invoice['customer_name'] ?? null) : $invoice->customer_name;
        $cust = $custName ? " for {$custName}" : '';
        $status = is_array($invoice) ? ($invoice['status'] ?? 'OVERDUE') : ($invoice->status ?? 'OVERDUE');
        $statusStr = ucfirst(strtolower($status));

        $payload = [
            'title' => "Invoice #{$num} ({$statusStr})",
            'body' => "Outstanding balance of \${$bal}{$cust}.",
            'data' => [
                'type' => 'invoice',
                'id' => 'invoice_' . $id,
                'invoice_id' => $id,
                'to' => '/invoices',
            ],
            'priority' => 'high',
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'], $payload);
    }

    /**
     * Dispatch Security Audit Event notification:
     * Target roles: SUPER_ADMIN, ADMIN only (Managers and Sellers excluded)
     *
     * @param  AuditLog|array  $auditLog
     * @return array{sent: int, failed: int, purged: array<string>}
     */
    public function notifySecurityEvent(AuditLog|array $auditLog): array
    {
        $id = is_array($auditLog) ? ($auditLog['id'] ?? '') : $auditLog->id;
        $rawAction = is_array($auditLog) ? ($auditLog['action'] ?? 'Action') : ($auditLog->action ?? 'Action');
        $action = ucwords(str_replace(['.', '_', '-'], ' ', (string) $rawAction));
        $actor = is_array($auditLog) ? ($auditLog['actor_name'] ?? 'System') : ($auditLog->actor_name ?? 'System');
        $rawTarget = is_array($auditLog) ? ($auditLog['target'] ?? null) : $auditLog->target;
        $target = $rawTarget ? " on {$rawTarget}" : '';

        $payload = [
            'title' => "Security Log: {$action}",
            'body' => "{$actor} performed {$action}{$target}.",
            'data' => [
                'type' => 'audit',
                'id' => 'audit_' . $id,
                'audit_id' => $id,
                'to' => '/audit-logs',
            ],
            'priority' => 'high',
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN'], $payload);
    }
}
