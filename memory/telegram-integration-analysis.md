# Telegram Bot Integration Analysis for Inventory System

> **Last Updated:** 2026-09-06
> **Status:** Revised — all code review findings applied

---

## Executive Summary

This document analyzes the existing notification architecture in the inventory system and provides recommendations for integrating Telegram bot notifications alongside the current Expo push notification system. The system uses Laravel 11/12 with an event-driven architecture, making Telegram integration straightforward.

---

## Current Notification Architecture Analysis

### 1. Push Notification Service (`backend/app/Services/PushNotificationService.php`)
- Centralized service for sending notifications via Expo push API
- Supports **true batch sending** (up to 100 tokens per single HTTP request — Expo supports arrays)
- Automatic dead token pruning when Expo returns `DeviceNotRegistered`
- Role-based targeting with an optional `$userFilter` closure
- All methods accept both **Eloquent model or plain array** for lightweight calls
- Return signature: `array{sent: int, failed: int, purged: array<string>}` — Telegram equivalent returns `array{sent: int, failed: int}` (no purged array needed)
- Specialized methods:
  - `notifyLowStock(ProductVariant|array $variant)` — Targets SUPER_ADMIN, ADMIN, MANAGER, SELLER
  - `notifyRestockCompleted(RestockSession|array $session)` — Targets SUPER_ADMIN, ADMIN, MANAGER only
  - `notifyOrderCompleted(Order|array $order)` — Targets SUPER_ADMIN, ADMIN, MANAGER + matching SELLER (by `seller_id`/`user_id`)
  - `notifyInvoiceOverdue(Invoice|array $invoice)` — Targets SUPER_ADMIN, ADMIN, MANAGER, SELLER
  - `notifySecurityEvent(AuditLog|array $auditLog)` — Targets SUPER_ADMIN, ADMIN **only**

### 2. User Model (`backend/app/Models/User.php`)
- Roles: SUPER_ADMIN, ADMIN, MANAGER, SELLER (`CASHIER` auto-normalized to `SELLER` via mutators)
- Uses `SoftDeletes`, `HasUuids`, `HasApiTokens`, `Notifiable`
- Relationship to push tokens: `public function pushTokens(): HasMany`
- `is_active` field exists, cast to `boolean`
- **No** `telegram_username` or `telegram_notifications_enabled` fields exist yet — these are optional enhancements
- `telegramChats` relationship must be added as `HasMany` — same pattern as `pushTokens()`

### 3. Push Token Model (`backend/app/Models/PushToken.php`)
- **No** `SoftDeletes`, **no** `is_active` flag — dead tokens are hard-deleted on `DeviceNotRegistered`
- Fields: `user_id`, `token`, `device_name`, `device_type`, `platform`
- Includes mutators to keep `platform` and `device_type` in sync
- `TelegramChat` should use soft-deactivation (`is_active = false`) rather than hard-delete — users may re-add the bot later

### 4. Event-Driven Architecture
- Events: `LowStockDetected`, `OrderPlaced`, `OrderStatusChanged`, `StockAdjusted`, `InvoicePaymentRecorded`, `OrderCancelled`
- `LowStockDetected` constructor: `(ProductVariant $variant, int $currentStock, int $reorderLevel)`
- **Only one listener exists**: `CheckLowStockThresholdListener` — listens to `StockAdjusted` and `OrderPlaced`, dispatches `LowStockDetected` when threshold is breached
- **IMPORTANT:** `CheckLowStockThresholdListener` does NOT call `PushNotificationService`. Push/Telegram notifications must be wired via a **separate listener** on `LowStockDetected`. New Telegram listeners must follow this same pattern.

---

## Bugs & Gaps Found in Original Draft

### Bug 1: PHP String Interpolation Error in `formatMessage()`
PHP only interpolates **variables** inside `{}` — it does **not** call functions inside interpolated strings.

```php
// WRONG — ucfirst() is not called; literal string "{ucfirst($key)}" is output
$dataLines[] = "<b>{ucfirst($key)}:</b> {$value}";

// CORRECT — use concatenation for function calls
$dataLines[] = '<b>' . ucfirst($key) . ':</b> ' . $value;
```

### Bug 2: Missing `use SoftDeletes` Trait on `TelegramChat` Model
The migration draft includes `$table->softDeletes()` but the model did not include the `SoftDeletes` trait. This must be added explicitly.

### Bug 3: Missing `use Illuminate\Support\Facades\Http` in `TelegramBotController`
The controller calls `Http::post(...)` in the welcome message block, but the `Http` facade import was absent from the original draft.

### Gap 1: Security Hole — `/start` Command Accepted Any Token
The original draft explicitly stated *"For now, we'll accept any token"*. Anyone knowing a user's UUID could hijack their Telegram linking. The fixed implementation uses a **short-lived Cache-backed signed token** (10 min TTL, single-use).

### Gap 2: No Webhook Signature Verification
Without verifying Telegram's `X-Telegram-Bot-Api-Secret-Token` header, anyone can POST fake events to the webhook endpoint. A dedicated middleware handles this.

### Gap 3: Specialized Notification Methods Were Stubs
`notifyLowStock()`, `notifyRestockCompleted()`, `notifyOrderCompleted()`, `notifyInvoiceOverdue()`, and `notifySecurityEvent()` were all `// ... (implementation details)`. Full implementations are provided below, mirroring `PushNotificationService` exactly.

### Gap 4: No Queue Support
Telegram sends one HTTP request per chat ID (no true batching). Calling this synchronously in a request cycle blocks the response. All callers must dispatch via queued listeners (`ShouldQueue`).

### Gap 5: No HTTP Timeout on Telegram API Calls
Missing `->timeout(5)` on `Http::post()` calls — risks process hangs on slow/dead API responses.

### Gap 6: Telegram Rate Limits Not Addressed
Telegram limits: **30 messages/second globally**, **1 message/second per unique chat**. High-volume scenarios need queue throttling or delays between sends.

### Gap 7: Event Listener Architecture Misunderstood
The original draft proposed modifying `CheckLowStockThresholdListener` to also call `TelegramNotificationService`. This is incorrect — that listener only dispatches `LowStockDetected`. The correct approach is a **separate queued listener** on `LowStockDetected`.

---

## Recommended Architecture

### 1. TelegramChat Model

```php
// backend/app/Models/TelegramChat.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes; // Required — migration has softDeletes()

class TelegramChat extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'telegram_chats';

    protected $fillable = [
        'user_id',
        'chat_id',
        'username',
        'first_name',
        'last_name',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
```

### 2. Migration for `telegram_chats` Table

```php
// database/migrations/2026_09_06_000001_create_telegram_chats_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telegram_chats', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('chat_id')->unique(); // Telegram chat ID (can be negative for groups)
            $table->string('username')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes(); // Soft-delete — user may re-add bot later

            $table->index(['user_id', 'is_active']);
            $table->index('chat_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_chats');
    }
};
```

### 3. User Model — Add `telegramChats` Relationship

```php
// Add to backend/app/Models/User.php

/**
 * Telegram chat IDs associated with this user.
 */
public function telegramChats(): HasMany
{
    return $this->hasMany(TelegramChat::class, 'user_id');
}
```

### 4. TelegramNotificationService (Full Implementation)

> Key differences from `PushNotificationService`:
> - Telegram API is per-message (no true batch endpoint) — iterate per chat ID
> - Return type `array{sent: int, failed: int}` — no `purged` array
> - HTTP timeout must be set explicitly (`->timeout(5)`)
> - Callers must dispatch via queued listeners

```php
// backend/app/Services/TelegramNotificationService.php
namespace App\Services;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\RestockSession;
use App\Models\TelegramChat;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramNotificationService
{
    public string $apiUrl; // public so controller helper can reference it

    protected string $botToken;

    public function __construct(?string $botToken = null)
    {
        $this->botToken = $botToken ?? config('services.telegram.bot_token', '');
        $this->apiUrl   = "https://api.telegram.org/bot{$this->botToken}";
    }

    /**
     * Send a Telegram message to a list of chat IDs.
     *
     * @param  array<string>  $chatIds
     * @param  array<string, mixed>  $payload
     * @return array{sent: int, failed: int}
     */
    public function sendMessage(array $chatIds, array $payload): array
    {
        $validChatIds = array_values(array_unique(array_filter($chatIds, fn ($id) =>
            is_string($id) && trim($id) !== ''
        )));

        if (empty($validChatIds)) {
            return ['sent' => 0, 'failed' => 0];
        }

        $sentCount   = 0;
        $failedCount = 0;

        foreach ($validChatIds as $chatId) {
            $message = [
                'chat_id'                  => $chatId,
                'text'                     => $this->formatMessage($payload),
                'parse_mode'               => 'HTML',
                'disable_web_page_preview' => true,
            ];

            if (isset($payload['keyboard'])) {
                $message['reply_markup'] = json_encode($payload['keyboard']);
            }

            try {
                $response = Http::timeout(5)->post("{$this->apiUrl}/sendMessage", $message);

                if ($response->successful()) {
                    $sentCount++;
                } else {
                    $failedCount++;
                    $errorData = $response->json();

                    // Deactivate if bot was blocked (403) or chat not found (404)
                    if (isset($errorData['error_code']) && in_array($errorData['error_code'], [403, 404])) {
                        TelegramChat::where('chat_id', $chatId)->update(['is_active' => false]);
                        Log::info("[TelegramNotificationService] Deactivated chat {$chatId}: {$errorData['description']}");
                    } else {
                        Log::warning("[TelegramNotificationService] API error for chat {$chatId}: " . json_encode($errorData));
                    }
                }
            } catch (\Throwable $e) {
                $failedCount++;
                Log::error("[TelegramNotificationService] Request exception: " . $e->getMessage());
            }
        }

        return ['sent' => $sentCount, 'failed' => $failedCount];
    }

    /**
     * Send to a specific user.
     *
     * @param  User|string  $user
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

        return $this->sendMessage($chatIds, $payload);
    }

    /**
     * Send to users with specific roles, with an optional user filter closure.
     *
     * @param  array<string>  $roles
     * @param  array<string, mixed>  $payload
     * @param  (callable(User): bool)|null  $userFilter
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

        $chatIds = $users->flatMap(fn (User $u) => $u->telegramChats->pluck('chat_id'))
            ->filter()->unique()->values()->all();

        return $this->sendMessage($chatIds, $payload);
    }

    /**
     * Format a payload array into an HTML Telegram message.
     * Fixed: ucfirst() cannot be called inside PHP string interpolation.
     */
    protected function formatMessage(array $payload): string
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
                    $dataLines[] = '<b>' . ucfirst($key) . ':</b> ' . $value;
                }
            }
            if (!empty($dataLines)) {
                $message .= "\n\n" . implode("\n", $dataLines);
            }
        }

        return $message;
    }

    // =========================================================================
    // Specialized notification methods — fully mirroring PushNotificationService
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
            'title' => "\u26a0\ufe0f Low Stock Alert: {$pName}{$skuStr}",
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
            'title' => "\ud83d\udce6 Restock Batch #{$code} ({$statusStr})",
            'body'  => "Inbound inventory session recorded. Total value: \${$cost}.",
            'data'  => ['type' => 'restock', 'session_id' => $id, 'to' => '/restock'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], $payload);
    }

    /**
     * Order Completed — Targets: SUPER_ADMIN, ADMIN, MANAGER + matching SELLER only
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
            'title' => "\ud83d\uded2 Order #{$num} Completed",
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
            'title' => "\ud83d\udd14 Invoice #{$num} ({$statusStr})",
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
            'title' => "\ud83d\udd10 Security Log: {$action}",
            'body'  => "{$actor} performed {$action}{$target}.",
            'data'  => ['type' => 'audit', 'audit_id' => $id, 'to' => '/audit-logs'],
        ];

        return $this->sendToRoles(['SUPER_ADMIN', 'ADMIN'], $payload);
    }
}
```

### 5. Webhook Security Middleware

```php
// backend/app/Http/Middleware/VerifyTelegramWebhook.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyTelegramWebhook
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('services.telegram.webhook_secret');

        // Only enforce if secret is configured (skip in local dev)
        if (!empty($secret)) {
            $incoming = $request->header('X-Telegram-Bot-Api-Secret-Token');
            if (!hash_equals($secret, (string) $incoming)) {
                return response()->json(['ok' => false, 'description' => 'Unauthorized'], 401);
            }
        }

        return $next($request);
    }
}
```

### 6. Telegram Bot Controller (Fixed)

```php
// backend/app/Http/Controllers/Api/V1/TelegramBotController.php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TelegramChat;
use App\Models\User;
use App\Services\TelegramNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;  // For secure token verification
use Illuminate\Support\Facades\Http;   // Fixed: was missing in original draft
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TelegramBotController extends Controller
{
    public function __construct(
        protected TelegramNotificationService $telegramService
    ) {}

    /**
     * Generate a short-lived secure linking token.
     * Called from the mobile app Settings screen.
     * Returns: https://t.me/{BOT_USERNAME}?start={token}
     *
     * Route: POST /api/v1/telegram/link-token  (auth:sanctum)
     */
    public function generateLinkToken(Request $request)
    {
        $user  = $request->user();
        $token = Str::random(32);

        // Store in cache for 10 minutes; consumed immediately on use (single-use)
        Cache::put("telegram_link:{$token}", $user->id, now()->addMinutes(10));

        $botUsername = config('services.telegram.bot_username');

        return response()->json([
            'ok'         => true,
            'link'       => "https://t.me/{$botUsername}?start={$token}",
            'expires_in' => 600,
        ]);
    }

    /**
     * Handle all incoming Telegram webhook updates.
     * Route: POST /api/v1/telegram/webhook  (VerifyTelegramWebhook middleware)
     */
    public function handleWebhook(Request $request)
    {
        $update  = $request->all();
        $message = $update['message'] ?? null;

        if (!$message) {
            return response()->json(['ok' => true]);
        }

        $text      = $message['text'] ?? '';
        $chatId    = (string) ($message['chat']['id'] ?? '');
        $username  = $message['from']['username'] ?? null;
        $firstName = $message['from']['first_name'] ?? '';
        $lastName  = $message['from']['last_name'] ?? null;

        if (str_starts_with($text, '/start')) {
            return $this->handleStart($text, $chatId, $username, $firstName, $lastName);
        }

        if ($text === '/help') {
            return $this->handleHelp($chatId);
        }

        if ($text === '/unlink') {
            return $this->handleUnlink($chatId, $firstName);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Handle /start <token> — verifies Cache token (single-use, 10 min TTL).
     * Fixed: no longer blindly accepts any token.
     */
    protected function handleStart(string $text, string $chatId, ?string $username, string $firstName, ?string $lastName)
    {
        $parts = explode(' ', $text);
        $token = $parts[1] ?? '';

        if (empty($token)) {
            $this->sendText($chatId, "Hello! Open the KC Shop app and go to Settings to connect Telegram.");
            return response()->json(['ok' => true]);
        }

        // Verify token from Cache
        $cacheKey = "telegram_link:{$token}";
        $userId   = Cache::get($cacheKey);

        if (!$userId) {
            $this->sendText($chatId, "This link has expired or is invalid. Please generate a new one from the app.");
            return response()->json(['ok' => true]);
        }

        // Consume the token immediately (single-use)
        Cache::forget($cacheKey);

        $user = User::find($userId);
        if (!$user) {
            $this->sendText($chatId, "User account not found.");
            return response()->json(['ok' => true]);
        }

        TelegramChat::updateOrCreate(
            ['user_id' => $user->id, 'chat_id' => $chatId],
            [
                'username'   => $username,
                'first_name' => $firstName,
                'last_name'  => $lastName,
                'is_active'  => true,
            ]
        );

        Log::info("[TelegramBot] User {$user->id} ({$user->name}) linked chat {$chatId}");

        $this->sendText(
            $chatId,
            "<b>Telegram Notifications Connected!</b>\n\nHello {$firstName}! You will now receive inventory alerts from KC Shop here.\n\nSend /help to see available commands."
        );

        return response()->json(['ok' => true]);
    }

    /**
     * Handle /help command.
     */
    protected function handleHelp(string $chatId)
    {
        $this->sendText($chatId, implode("\n", [
            '<b>KC Shop Bot Commands</b>',
            '',
            '/help — Show this help message',
            '/unlink — Disconnect Telegram from KC Shop',
        ]));

        return response()->json(['ok' => true]);
    }

    /**
     * Handle /unlink — deactivates the chat link.
     */
    protected function handleUnlink(string $chatId, string $firstName)
    {
        $updated = TelegramChat::where('chat_id', $chatId)->update(['is_active' => false]);

        if ($updated) {
            Log::info("[TelegramBot] Chat {$chatId} unlinked via /unlink");
            $this->sendText($chatId, "Goodbye {$firstName}! Your Telegram has been disconnected. You can re-link anytime from the app.");
        } else {
            $this->sendText($chatId, "This chat was not linked to any KC Shop account.");
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Send a plain HTML text message via Telegram API.
     */
    protected function sendText(string $chatId, string $text): void
    {
        Http::timeout(5)->post("{$this->telegramService->apiUrl}/sendMessage", [
            'chat_id'                  => $chatId,
            'text'                     => $text,
            'parse_mode'               => 'HTML',
            'disable_web_page_preview' => true,
        ]);
    }
}
```

### 7. Event Listener for Dual-Channel Notifications

> **Important finding:** `CheckLowStockThresholdListener` only **dispatches** `LowStockDetected` — it does NOT call `PushNotificationService`. A separate queued listener on `LowStockDetected` must handle both push and Telegram. The same pattern applies for all other events.

```php
// backend/app/Listeners/SendLowStockNotificationsListener.php
namespace App\Listeners;

use App\Events\LowStockDetected;
use App\Services\PushNotificationService;
use App\Services\TelegramNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class SendLowStockNotificationsListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';

    public function __construct(
        protected PushNotificationService $pushService,
        protected TelegramNotificationService $telegramService
    ) {}

    public function handle(LowStockDetected $event): void
    {
        $variant = $event->variant;

        $this->pushService->notifyLowStock($variant);
        $this->telegramService->notifyLowStock($variant);
    }
}
```

Register in `EventServiceProvider`:

```php
use App\Events\LowStockDetected;
use App\Listeners\SendLowStockNotificationsListener;

protected $listen = [
    LowStockDetected::class => [
        SendLowStockNotificationsListener::class,
    ],
    // Add equivalent listeners for OrderStatusChanged, InvoicePaymentRecorded, etc.
];
```

### 8. Routes

```php
// backend/routes/api.php
use App\Http\Controllers\Api\V1\TelegramBotController;
use App\Http\Middleware\VerifyTelegramWebhook;

// Authenticated route — mobile app generates a secure linking deep link
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/telegram/link-token', [TelegramBotController::class, 'generateLinkToken']);
});

// Telegram webhook — secured by header signature verification + rate limiting
Route::middleware([VerifyTelegramWebhook::class, 'throttle:60,1'])
    ->post('/telegram/webhook', [TelegramBotController::class, 'handleWebhook']);
```

### 9. Configuration

**`.env`**
```dotenv
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username_without_at_sign
TELEGRAM_WEBHOOK_SECRET=a_random_secret_you_set_in_setWebhook_call
```

**`config/services.php`**
```php
'telegram' => [
    'bot_token'      => env('TELEGRAM_BOT_TOKEN'),
    'bot_username'   => env('TELEGRAM_BOT_USERNAME'),
    'webhook_secret' => env('TELEGRAM_WEBHOOK_SECRET'),
],
```

**Register webhook once after deployment:**
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/api/v1/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

---

## Implementation Recommendations

### 1. Phased Approach
- **Phase 1:** Create `TelegramChat` model + migration; add `telegramChats()` relationship to `User`
- **Phase 2:** Implement `TelegramNotificationService` (`sendMessage`, `sendToUser`, `sendToRoles`)
- **Phase 3:** Implement all 5 specialized `notify*()` methods
- **Phase 4:** Implement `VerifyTelegramWebhook` middleware + `TelegramBotController` with secure token linking
- **Phase 5:** Add `generateLinkToken` API; update mobile app Settings screen
- **Phase 6:** Wire `SendLowStockNotificationsListener` (and equivalents for other events) in `EventServiceProvider`
- **Phase 7:** Run `setWebhook` API call; test end-to-end
- **Phase 8:** Monitor queue metrics; adjust `notifications` queue workers

### 2. Security Considerations
- Webhook requests validated via `X-Telegram-Bot-Api-Secret-Token` header (implemented above)
- `/start` token is single-use, Cache-backed, 10-minute TTL
- Apply rate limiting to the webhook route (`throttle:60,1`)
- Sanitize all user-supplied fields (username, first_name, last_name) before storing

### 3. Performance Considerations
- Telegram API limits: **30 msg/sec globally**, **1 msg/sec per unique chat**
- Always dispatch via `ShouldQueue` on a dedicated `notifications` queue
- Do NOT call `TelegramNotificationService` synchronously in a request cycle
- For high-volume scenarios, add micro-delays between sends or use a rate-throttled queue driver

### 4. User Experience
- Mobile app: Settings → "Connect Telegram" → calls `POST /telegram/link-token` → opens deep link to bot
- Users disconnect via `/unlink` bot command or from app settings
- Consider per-notification-type preference toggles (e.g. opt out of order alerts but keep low stock)

### 5. Fallback Strategy
- Telegram failures are non-critical — push notifications remain the primary channel
- Log all failures; alert on sustained high failure rates via Laravel Telescope or monitoring

---

## Benefits of This Approach

1. **Consistent architecture** — mirrors `PushNotificationService` exactly (same signatures, same role logic)
2. **Secure by default** — webhook signature verification + single-use cache tokens for linking
3. **Queue-backed** — sequential Telegram sending does not block request cycles
4. **Extensible** — new notification types require one method in service + one listener
5. **Graceful degradation** — blocked/not-found chats auto-deactivated, can be re-linked anytime
6. **Dual-channel** — push + Telegram fire independently; one failing does not affect the other

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/app/Models/TelegramChat.php` | Eloquent model with `SoftDeletes` |
| `backend/app/Services/TelegramNotificationService.php` | Full notification service |
| `backend/app/Http/Controllers/Api/V1/TelegramBotController.php` | Webhook + link token controller |
| `backend/app/Http/Middleware/VerifyTelegramWebhook.php` | Webhook signature middleware |
| `backend/app/Listeners/SendLowStockNotificationsListener.php` | Queued dual-channel listener |
| `database/migrations/2026_09_06_000001_create_telegram_chats_table.php` | DB migration |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/Models/User.php` | Add `telegramChats(): HasMany` relationship |
| `backend/app/Providers/EventServiceProvider.php` | Register new listener on `LowStockDetected` (+ other events) |
| `backend/routes/api.php` | Add webhook + link-token routes |
| `backend/config/services.php` | Add `telegram` config block |
| `.env` / `.env.example` | Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` |

### Optional Enhancements
- Per-notification-type preference toggles on user profile
- Admin panel for managing Telegram chat links
- `/status` bot command showing current notification preferences
- `telegram_notifications_enabled` boolean on `users` table
