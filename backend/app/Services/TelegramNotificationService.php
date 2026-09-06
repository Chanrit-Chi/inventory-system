<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\RestockSession;
use App\Models\TelegramChat;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TelegramNotificationService
{
    /**
     * Telegram Bot Token
     */
    protected string $botToken = '';

    /**
     * Telegram Bot Username (without @)
     */
    protected string $botUsername = '';

    /**
     * Telegram Webhook Secret (for validation)
     */
    protected string $webhookSecret = '';

    /**
     * Telegram Mini App (Web App) URL
     */
    protected string $miniappUrl = '';

    /**
     * Base URL for Telegram Bot API
     */
    protected string $baseUrl = 'https://api.telegram.org/bot';

    public function __construct()
    {
        $rawToken            = (string) (config('services.telegram.bot_token') ?? '');
        // Strip optional 'bot:' prefix if accidentally included
        $this->botToken      = preg_replace('/^bot:?/i', '', trim($rawToken));
        $rawUsername         = (string) (config('services.telegram.bot_username') ?? '');
        // Strip optional '@' prefix if accidentally included
        $this->botUsername   = ltrim(trim($rawUsername), '@');
        $this->webhookSecret = (string) (config('services.telegram.webhook_secret') ?? '');
        $this->miniappUrl    = (string) (config('services.telegram.miniapp_url') ?? '');
    }

    /**
     * Return the bot username (public accessor).
     */
    public function getBotUsername(): string
    {
        return $this->botUsername;
    }

    /**
     * Return the Mini App URL.
     */
    public function getMiniAppUrl(): string
    {
        return $this->miniappUrl;
    }

    /**
     * Return the full API base URL including bot token.
     */
    public function getApiUrl(): string
    {
        return $this->baseUrl . $this->botToken;
    }

    /**
     * Configure Telegram bot's persistent Chat Menu Button to open the Mini App.
     *
     * @param  string|null  $url         Optional Mini App URL override
     * @param  string       $buttonText  Button title displayed in Telegram
     * @return bool
     */
    public function setChatMenuButton(?string $url = null, string $buttonText = '📱 Open KC Shop'): bool
    {
        $targetUrl = $url ?? $this->miniappUrl;
        if (empty($this->botToken) || empty($targetUrl)) {
            return false;
        }

        try {
            $response = Http::timeout(10)->post($this->getApiUrl() . '/setChatMenuButton', [
                'menu_button' => [
                    'type'     => 'web_app',
                    'text'     => $buttonText,
                    'web_app'  => [
                        'url'  => $targetUrl,
                    ],
                ],
            ]);

            if ($response->successful()) {
                Log::info("[TelegramNotificationService] Chat menu button set to: {$targetUrl}");
                return true;
            }

            Log::warning("[TelegramNotificationService] Failed to set chat menu button: " . $response->body());
            return false;
        } catch (\Throwable $e) {
            Log::error("[TelegramNotificationService] setChatMenuButton exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Register or update the webhook with Telegram Bot API.
     *
     * @param  string|null  $webhookUrl
     * @return array{success: bool, description: string}
     */
    public function setWebhook(?string $webhookUrl = null): array
    {
        $url = $webhookUrl ?? (rtrim((string) config('app.url'), '/') . '/api/v1/telegram/webhook');
        if (empty($this->botToken)) {
            return ['success' => false, 'description' => 'Bot token not configured'];
        }

        try {
            $payload = [
                'url'             => $url,
                'allowed_updates' => ['message'],
            ];

            if (!empty($this->webhookSecret)) {
                $payload['secret_token'] = $this->webhookSecret;
            }

            $response = Http::timeout(15)->post($this->getApiUrl() . '/setWebhook', $payload);
            $json = $response->json();

            if ($response->successful() && ($json['ok'] ?? false)) {
                Log::info("[TelegramNotificationService] Webhook registered: {$url}");
                return ['success' => true, 'description' => $json['description'] ?? 'Webhook was set'];
            }

            return ['success' => false, 'description' => $json['description'] ?? $response->body()];
        } catch (\Throwable $e) {
            Log::error("[TelegramNotificationService] setWebhook exception: " . $e->getMessage());
            return ['success' => false, 'description' => $e->getMessage()];
        }
    }

    /**
     * Get current webhook status from Telegram.
     */
    public function getWebhookInfo(): array
    {
        try {
            $response = Http::timeout(10)->get($this->getApiUrl() . '/getWebhookInfo');
            return $response->json() ?? [];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Validate Telegram Mini App initData cryptographic HMAC-SHA256 signature.
     *
     * @param  string  $initData  Raw query string from Telegram.WebApp.initData
     * @return array|false  Validated data including 'user_data', or false if invalid/expired
     */
    public function validateWebAppData(string $initData): array|false
    {
        if (empty($initData) || empty($this->botToken)) {
            return false;
        }

        parse_str($initData, $data);

        if (!isset($data['hash']) || !isset($data['auth_date'])) {
            return false;
        }

        $hash = $data['hash'];
        unset($data['hash']);

        // Sort keys alphabetically
        ksort($data);

        $checkPairs = [];
        foreach ($data as $key => $val) {
            $checkPairs[] = "{$key}={$val}";
        }
        $dataCheckString = implode("\n", $checkPairs);

        // Telegram specification: secret_key = HMAC_SHA256(bot_token, "WebAppData")
        $secretKey = hash_hmac('sha256', $this->botToken, 'WebAppData', true);
        $calculatedHash = hash_hmac('sha256', $dataCheckString, $secretKey);

        if (!hash_equals($calculatedHash, $hash)) {
            Log::warning('[TelegramNotificationService] Mini App initData hash mismatch');
            return false;
        }

        // Check auth_date is not older than 24 hours (86400s) to prevent replay attacks
        if (abs(time() - (int) $data['auth_date']) > 86400) {
            Log::warning('[TelegramNotificationService] Mini App initData expired');
            return false;
        }

        if (isset($data['user'])) {
            $data['user_data'] = json_decode($data['user'], true);
        }

        return $data;
    }

    // =========================================================================
    // Core sending methods
    // =========================================================================

    /**
     * Send a single Telegram message to one chat ID.
     * Used directly by the controller for interactive bot replies.
     *
     * @param  string  $chatId
     * @param  string  $message  Pre-formatted HTML text
     * @param  array   $options  Additional Telegram API options
     * @return bool
     */
    public function sendMessage(string $chatId, string $message, array $options = []): bool
    {
        if (empty($this->botToken)) {
            Log::warning('[TelegramNotificationService] Bot token not configured');
            return false;
        }

        try {
            $response = Http::timeout(20)->post(
                $this->getApiUrl() . '/sendMessage',
                array_merge([
                    'chat_id'                  => $chatId,
                    'text'                     => $message,
                    'parse_mode'               => 'HTML',
                    'disable_web_page_preview' => true,
                ], $options)
            );

            if ($response->successful()) {
                return true;
            }

            // Auto-deactivate on bot-blocked or chat-not-found errors
            $data = $response->json();
            if (isset($data['error_code']) && in_array($data['error_code'], [403, 404])) {
                $this->deactivateChat($chatId);
                Log::info("[TelegramNotificationService] Deactivated chat {$chatId}: " . ($data['description'] ?? ''));
            } else {
                Log::warning("[TelegramNotificationService] API error for chat {$chatId}: " . json_encode($data));
            }

            return false;
        } catch (\Throwable $e) {
            Log::error("[TelegramNotificationService] sendMessage exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send a payload-based message to an array of chat IDs.
     * Used internally by sendToUser() and sendToRoles().
     *
     * @param  array<string>          $chatIds
     * @param  array<string, mixed>   $payload  ['title'=>..., 'body'=>..., 'data'=>...]
     * @return array{sent: int, failed: int}
     */
    protected function sendBatch(array $chatIds, array $payload): array
    {
        $validChatIds = array_values(array_unique(array_filter($chatIds, fn ($id) =>
            is_string($id) && trim($id) !== ''
        )));

        if (empty($validChatIds)) {
            return ['sent' => 0, 'failed' => 0];
        }

        $sent   = 0;
        $failed = 0;
        $text   = $this->formatMessage($payload);

        foreach ($validChatIds as $chatId) {
            $this->sendMessage($chatId, $text) ? $sent++ : $failed++;
        }

        return ['sent' => $sent, 'failed' => $failed];
    }

    /**
     * Send a payload-based message to a specific user (all active chats).
     *
     * @param  User|string            $user
     * @param  array<string, mixed>   $payload
     * @return array{sent: int, failed: int}
     */
    public function sendToUser(User|string $user, array $payload): array
    {
        if (is_string($user)) {
            $user = User::with('telegramChats')->find($user);
        }

        if (!$user) {
            return ['sent' => 0, 'failed' => 0];
        }

        if (!$user->relationLoaded('telegramChats')) {
            $user->load('telegramChats');
        }

        $chatIds = $user->telegramChats
            ->where('is_active', true)
            ->pluck('chat_id')
            ->filter()
            ->all();

        return $this->sendBatch($chatIds, $payload);
    }

    /**
     * Send a payload-based message to users with specific roles.
     * Mirrors PushNotificationService::sendToRoles() exactly:
     *   - Eager-loads telegramChats (filtered to active only)
     *   - Checks both the role column and roleRelation (for role_id FK users)
     *   - Supports an optional $userFilter closure
     *
     * @param  array<string>                  $roles
     * @param  array<string, mixed>           $payload
     * @param  (callable(User): bool)|null    $userFilter
     * @return array{sent: int, failed: int}
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
            ->with(['telegramChats' => fn ($q) => $q->where('is_active', true)]);

        $users = $query->get();

        if ($userFilter !== null) {
            $users = $users->filter($userFilter);
        }

        $chatIds = $users
            ->flatMap(fn (User $u) => $u->telegramChats->pluck('chat_id'))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $this->sendBatch($chatIds, $payload);
    }

    /**
     * Send a message to all active Telegram chats (broadcast).
     *
     * @param  string  $message  Pre-formatted text
     * @return int  Number of chats the message was sent to
     */
    public function broadcast(string $message): int
    {
        $chats     = TelegramChat::where('is_active', true)->get();
        $sentCount = 0;

        foreach ($chats as $chat) {
            if ($this->sendMessage($chat->chat_id, $message)) {
                $sentCount++;
            }
        }

        return $sentCount;
    }

    /**
     * Format a payload array into an HTML Telegram message string.
     * Fixed: ucfirst() is called via concatenation, NOT string interpolation.
     *
     * @param  array<string, mixed>  $payload
     */
    public function formatMessage(array $payload): string
    {
        $title = $payload['title'] ?? 'KC Shop Notification';
        $body  = $payload['body'] ?? ($payload['desc'] ?? '');
        $data  = $payload['data'] ?? [];

        $message = "<b>{$title}</b>\n\n{$body}";

        if (!empty($data)) {
            $dataLines = [];
            foreach ($data as $key => $value) {
                if (!in_array($key, ['type', 'id', 'to'], true)) {
                    // Correct: concatenation, NOT string interpolation for function calls
                    $dataLines[] = '<b>' . ucfirst(str_replace('_', ' ', $key)) . ':</b> ' . $value;
                }
            }
            if (!empty($dataLines)) {
                $message .= "\n\n" . implode("\n", $dataLines);
            }
        }

        return $message;
    }

    // =========================================================================
    // Token / chat management (used by TelegramBotController)
    // =========================================================================

    /**
     * Generate a single-use token (40 chars, 5-min TTL) for linking a Telegram account.
     */
    public function generateLinkToken(User $user): string
    {
        $token = Str::random(40);
        Cache::put("telegram_link_token:{$token}", $user->id, 1800); // 30 minutes expiry
        return $token;
    }

    /**
     * Verify a link token and return the associated user ID (or null if invalid/expired).
     */
    public function verifyLinkToken(string $token): ?string
    {
        return Cache::get("telegram_link_token:{$token}");
    }

    /**
     * Consume (invalidate) a link token after successful use.
     */
    public function invalidateLinkToken(string $token): void
    {
        Cache::forget("telegram_link_token:{$token}");
    }

    /**
     * Activate (or reactivate) a Telegram chat for a user.
     */
    public function activateChat(User $user, string $chatId, array $chatInfo = []): TelegramChat
    {
        return TelegramChat::updateOrCreate(
            ['user_id' => $user->id, 'chat_id' => $chatId],
            array_merge(['is_active' => true, 'type' => 'private'], $chatInfo)
        );
    }

    /**
     * Deactivate a Telegram chat (e.g., when bot is blocked or chat not found).
     */
    public function deactivateChat(string $chatId): void
    {
        TelegramChat::where('chat_id', $chatId)->update(['is_active' => false]);
    }

    // =========================================================================
    // Specialized notification methods — mirroring PushNotificationService
    // =========================================================================

    /**
     * Low Stock Alert — Targets: SUPER_ADMIN, ADMIN, MANAGER, SELLER
     *
     * @param  ProductVariant|array  $variant
     * @return array{sent: int, failed: int}
     */
    public function notifyLowStock(ProductVariant|array $variant): array
    {
        $id        = is_array($variant) ? ($variant['id'] ?? '') : $variant->id;
        $sku       = is_array($variant) ? ($variant['sku'] ?? '') : $variant->sku;
        $skuStr    = $sku ? " ({$sku})" : '';
        $qty       = is_array($variant) ? (int) ($variant['quantity_on_hand'] ?? 0) : (int) ($variant->quantity_on_hand ?? 0);
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
            'body'  => "Stock is down to {$qty} " . ($qty === 1 ? 'unit' : 'units') . " (Threshold: {$threshold}).",
            'data'  => ['type' => 'low_stock', 'variant_id' => $id, 'to' => '/inventory'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'], $payload);
    }

    /**
     * Restock Completed — Targets: SUPER_ADMIN, ADMIN, MANAGER (SELLER excluded)
     *
     * @param  RestockSession|array  $session
     * @return array{sent: int, failed: int}
     */
    public function notifyRestockCompleted(RestockSession|array $session): array
    {
        $id        = is_array($session) ? ($session['id'] ?? '') : $session->id;
        $code      = is_array($session)
            ? ($session['session_code'] ?? substr((string) $id, 0, 8))
            : ($session->session_code ?? substr((string) $session->id, 0, 8));
        $status    = is_array($session) ? ($session['status'] ?? 'verified') : ($session->status ?? 'verified');
        $statusStr = ucfirst(strtolower($status));
        $cost      = is_array($session)
            ? number_format((float) ($session['total_cost'] ?? 0), 2)
            : number_format((float) ($session->total_cost ?? 0), 2);

        $payload = [
            'title' => "Restock Batch #{$code} ({$statusStr})",
            'body'  => "Inbound inventory session recorded. Total value: \${$cost}.",
            'data'  => ['type' => 'restock', 'session_id' => $id, 'to' => '/restock'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], $payload);
    }

    /**
     * Order Completed — Targets: SUPER_ADMIN, ADMIN, MANAGER + matching SELLER only.
     * Seller receives ONLY if order.seller_id / user_id matches their ID.
     *
     * @param  Order|array  $order
     * @return array{sent: int, failed: int}
     */
    public function notifyOrderCompleted(Order|array $order): array
    {
        $id    = is_array($order) ? ($order['id'] ?? '') : $order->id;
        $num   = is_array($order)
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
            if (in_array($role, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'], true)) {
                return true;
            }
            if ($role === 'SELLER') {
                return $sellerId !== null && (string) $user->id === (string) $sellerId;
            }
            return false;
        };

        $payload = [
            'title' => "Order #{$num} Completed",
            'body'  => "Checkout sale of \${$total} successfully settled.",
            'data'  => ['type' => 'order', 'order_id' => $id, 'to' => '/orders'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'], $payload, $userFilter);
    }

    /**
     * Invoice Overdue — Targets: SUPER_ADMIN, ADMIN, MANAGER, SELLER
     *
     * @param  Invoice|array  $invoice
     * @return array{sent: int, failed: int}
     */
    public function notifyInvoiceOverdue(Invoice|array $invoice): array
    {
        $id        = is_array($invoice) ? ($invoice['id'] ?? '') : $invoice->id;
        $num       = is_array($invoice)
            ? ($invoice['invoice_number'] ?? substr((string) $id, 0, 8))
            : ($invoice->invoice_number ?? substr((string) $invoice->id, 0, 8));
        $bal       = is_array($invoice)
            ? number_format((float) ($invoice['balance_due'] ?? ($invoice['total_amount'] ?? 0)), 2)
            : number_format((float) ($invoice->balance_due ?? ($invoice->total_amount ?? 0)), 2);
        $custName  = is_array($invoice) ? ($invoice['customer_name'] ?? null) : $invoice->customer_name;
        $cust      = $custName ? " for {$custName}" : '';
        $status    = is_array($invoice) ? ($invoice['status'] ?? 'OVERDUE') : ($invoice->status ?? 'OVERDUE');
        $statusStr = ucfirst(strtolower($status));

        $payload = [
            'title' => "Invoice #{$num} ({$statusStr})",
            'body'  => "Outstanding balance of \${$bal}{$cust}.",
            'data'  => ['type' => 'invoice', 'invoice_id' => $id, 'to' => '/invoices'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'], $payload);
    }

    /**
     * Security Audit Event — Targets: SUPER_ADMIN, ADMIN only
     *
     * @param  AuditLog|array  $auditLog
     * @return array{sent: int, failed: int}
     */
    public function notifySecurityEvent(AuditLog|array $auditLog): array
    {
        $id        = is_array($auditLog) ? ($auditLog['id'] ?? '') : $auditLog->id;
        $rawAction = is_array($auditLog) ? ($auditLog['action'] ?? 'Action') : ($auditLog->action ?? 'Action');
        $action    = ucwords(str_replace(['.', '_', '-'], ' ', (string) $rawAction));
        $actor     = is_array($auditLog) ? ($auditLog['actor_name'] ?? 'System') : ($auditLog->actor_name ?? 'System');
        $rawTarget = is_array($auditLog) ? ($auditLog['target'] ?? null) : $auditLog->target;
        $target    = $rawTarget ? " on {$rawTarget}" : '';

        $payload = [
            'title' => "Security Log: {$action}",
            'body'  => "{$actor} performed {$action}{$target}.",
            'data'  => ['type' => 'audit', 'audit_id' => $id, 'to' => '/audit-logs'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN'], $payload);
    }

    // =========================================================================
    // Extra notification methods (beyond PushNotificationService scope)
    // =========================================================================

    /**
     * Notify about a new order being placed.
     * Targets: SUPER_ADMIN, ADMIN, MANAGER
     *
     * @param  Order|array  $order
     * @return array{sent: int, failed: int}
     */
    public function notifyOrderPlaced(Order|array $order): array
    {
        $id       = is_array($order) ? ($order['id'] ?? '') : $order->id;
        $num      = is_array($order)
            ? ($order['order_number'] ?? substr((string) $id, 0, 8))
            : ($order->order_number ?? substr((string) $order->id, 0, 8));
        $total    = is_array($order)
            ? number_format((float) ($order['total_amount'] ?? 0), 2)
            : number_format((float) ($order->total_amount ?? 0), 2);
        $customer = is_array($order) ? ($order['customer_name'] ?? null) : ($order->customer_name ?? null);
        $custStr  = $customer ? " by {$customer}" : '';

        $payload = [
            'title' => "New Order #{$num} Placed",
            'body'  => "Order of \${$total}{$custStr} received.",
            'data'  => ['type' => 'order_placed', 'order_id' => $id, 'to' => '/orders'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], $payload);
    }

    /**
     * Notify about an order status change.
     * Targets: SUPER_ADMIN, ADMIN, MANAGER
     *
     * @param  Order|array  $order
     * @param  string       $oldStatus
     * @return array{sent: int, failed: int}
     */
    public function notifyOrderStatusChanged(Order|array $order, string $oldStatus): array
    {
        $id        = is_array($order) ? ($order['id'] ?? '') : $order->id;
        $num       = is_array($order)
            ? ($order['order_number'] ?? substr((string) $id, 0, 8))
            : ($order->order_number ?? substr((string) $order->id, 0, 8));
        $newStatus = is_array($order) ? ($order['status'] ?? '') : ($order->status ?? '');

        $payload = [
            'title' => "Order #{$num} Status Updated",
            'body'  => "Status changed from {$oldStatus} to {$newStatus}.",
            'data'  => ['type' => 'order_status', 'order_id' => $id, 'to' => '/orders'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], $payload);
    }

    /**
     * Notify about an invoice payment being recorded.
     * Targets: SUPER_ADMIN, ADMIN, MANAGER
     *
     * @param  Invoice|array  $invoice
     * @return array{sent: int, failed: int}
     */
    public function notifyInvoicePaymentRecorded(Invoice|array $invoice): array
    {
        $id       = is_array($invoice) ? ($invoice['id'] ?? '') : $invoice->id;
        $num      = is_array($invoice)
            ? ($invoice['invoice_number'] ?? substr((string) $id, 0, 8))
            : ($invoice->invoice_number ?? substr((string) $invoice->id, 0, 8));
        $paid     = is_array($invoice)
            ? number_format((float) ($invoice['amount_paid'] ?? 0), 2)
            : number_format((float) ($invoice->amount_paid ?? 0), 2);
        $status   = is_array($invoice) ? ($invoice['status'] ?? '') : ($invoice->status ?? '');

        $payload = [
            'title' => "Invoice #{$num} — Payment Recorded",
            'body'  => "Payment of \${$paid} received. Status: {$status}.",
            'data'  => ['type' => 'invoice_payment', 'invoice_id' => $id, 'to' => '/invoices'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], $payload);
    }

    /**
     * Flexible low-stock notification targeting custom roles.
     *
     * @param  ProductVariant|array  $variant
     * @param  array<string>         $roles
     * @return array{sent: int, failed: int}
     */
    public function notifyLowStockToRoles(ProductVariant|array $variant, array $roles): array
    {
        $id     = is_array($variant) ? ($variant['id'] ?? '') : $variant->id;
        $sku    = is_array($variant) ? ($variant['sku'] ?? '') : $variant->sku;
        $qty    = is_array($variant) ? (int) ($variant['quantity_on_hand'] ?? 0) : (int) ($variant->quantity_on_hand ?? 0);
        $pName  = is_array($variant) ? ($variant['product_name'] ?? 'Product') : ($variant->name ?? 'Product');
        $skuStr = $sku ? " ({$sku})" : '';

        $payload = [
            'title' => "Low Stock: {$pName}{$skuStr}",
            'body'  => "Current stock: {$qty} " . ($qty === 1 ? 'unit' : 'units') . '.',
            'data'  => ['type' => 'low_stock', 'variant_id' => $id, 'to' => '/inventory'],
        ];

        return $this->sendToRoles($roles, $payload);
    }
}
