<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\StockAdjusted;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\TelegramChat;
use App\Models\User;
use App\Services\BarcodeScannerService;
use App\Services\TelegramNotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TelegramBotController extends Controller
{
    /**
     * Constructor
     */
    public function __construct(
        protected TelegramNotificationService $telegramService,
        protected BarcodeScannerService $scannerService
    ) {}

    /**
     * Generate a link token for the authenticated user to link their Telegram account
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function generateLinkToken(Request $request)
    {
        $user = $request->user(); // Fixed: was $user = $user = Auth::user()

        $token = $this->telegramService->generateLinkToken($user);

        return response()->json([
            'success' => true,
            'data' => [
                'token'        => $token,
                'expires_in'   => 1800,
                'bot_username' => $this->telegramService->getBotUsername(),
            ],
        ]);
    }


    /**
     * Handle incoming Telegram webhook updates
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function handleWebhook(Request $request)
    {
        $update = $request->json()->all();

        if (!isset($update['message'])) {
            // We only handle messages for now (could handle callback queries, etc.)
            return response()->json(['success' => true]);
        }

        $message = $update['message'];
        $chatId = (string) $message['chat']['id'];
        $text = $message['text'] ?? '';

        // Handle commands
        if (Str::startsWith($text, '/start')) {
            return $this->handleStartCommand($chatId, $text, $message); // Pass $message for chat info
        }

        if (Str::startsWith($text, '/help')) {
            return $this->handleHelpCommand($chatId);
        }

        if (Str::startsWith($text, '/unlink')) {
            return $this->handleUnlinkCommand($chatId, $text);
        }

        // If we get here, it's an unhandled message
        $this->telegramService->sendMessage($chatId, "Sorry, I don't understand that command. Use /help to see available commands.");

        return response()->json(['success' => true]);
    }

    /**
     * Handle the /start command with optional token for linking
     *
     * @param string $chatId
     * @param string $text
     * @return \Illuminate\Http\JsonResponse
     */
    protected function handleStartCommand(string $chatId, string $text, array $message = []) // Fixed: $message now in scope
    {
        // Extract token if present: /start TOKEN
        $parts = explode(' ', $text);
        $token = $parts[1] ?? null;

        if ($token) {
            $userId = $this->telegramService->verifyLinkToken($token);

            if ($userId) {
                $user = User::find($userId);

                if ($user) {
                    // Get chat info from the message (now properly in scope)
                    $chatInfo = [
                        'username'   => $message['from']['username'] ?? null,
                        'first_name' => $message['from']['first_name'] ?? null,
                        'last_name'  => $message['from']['last_name'] ?? null,
                        'type'       => $message['chat']['type'] ?? 'private',
                    ];

                    // Activate the chat for the user
                    $this->telegramService->activateChat($user, $chatId, $chatInfo);

                    // Invalidate the token (single-use)
                    $this->telegramService->invalidateLinkToken($token);

                    $this->telegramService->sendMessage($chatId, "Success! Your Telegram account has been linked to your inventory system account ({$user->name}).");

                    return response()->json(['success' => true]);
                }
            }

            // Invalid or expired token
            $this->telegramService->sendMessage($chatId, "Invalid or expired link token. Please generate a new one from the inventory system.");
        } else {
            // No token provided, guide user and provide Mini App button
            $miniappUrl = $this->telegramService->getMiniAppUrl();
            $options = [];
            if (!empty($miniappUrl)) {
                $options['reply_markup'] = [
                    'inline_keyboard' => [
                        [
                            ['text' => '📱 Open KC Shop Portal', 'web_app' => ['url' => $miniappUrl]]
                        ]
                    ]
                ];
            }
            $this->telegramService->sendMessage(
                $chatId,
                "<b>Welcome to KC Shop Bot!</b>\n\nTap the button below to log in and connect your account instantly, or link using <code>/start TOKEN</code>.",
                $options
            );
        }

        return response()->json(['success' => true]);
    }

    /**
     * Handle the /help command
     *
     * @param string $chatId
     * @return \Illuminate\Http\JsonResponse
     */
    protected function handleHelpCommand(string $chatId)
    {
        $miniappUrl = $this->telegramService->getMiniAppUrl();
        $options = [];
        if (!empty($miniappUrl)) {
            $options['reply_markup'] = [
                'inline_keyboard' => [
                    [
                        ['text' => '📱 Open KC Shop Portal', 'web_app' => ['url' => $miniappUrl]]
                    ]
                ]
            ];
        }

        $helpText = "<b>KC Shop Bot Commands:</b>\n\n"
                  . "📱 <b>Mini App:</b> Tap the button below to open the portal\n"
                  . "🔑 <code>/start [TOKEN]</code> - Link using a security token\n"
                  . "❓ <code>/help</code> - Show this help message\n"
                  . "🔌 <code>/unlink</code> - Disconnect Telegram from your account\n";

        $this->telegramService->sendMessage($chatId, $helpText, $options);

        return response()->json(['success' => true]);
    }

    /**
     * Handle the /unlink command with optional token for unlinking
     *
     * @param string $chatId
     * @param string $text
     * @return \Illuminate\Http\JsonResponse
     */
    protected function handleUnlinkCommand(string $chatId, string $text)
    {
        // Extract token if present: /unlink TOKEN
        $parts = explode(' ', $text);
        $token = $parts[1] ?? null;

        if ($token) {
            $userId = $this->telegramService->verifyLinkToken($token);

            if ($userId) {
                // Deactivate the chat for the user
                TelegramChat::where('user_id', $userId)
                            ->where('chat_id', $chatId)
                            ->update(['is_active' => false]);

                // Invalidate the token
                $this->telegramService->invalidateLinkToken($token);

                $this->telegramService->sendMessage($chatId, "Your Telegram account has been unlinked from your inventory system account.");

                return response()->json(['success' => true]);
            }
        }

        // If no token or invalid token, just deactivate the chat (if we can find it by chat_id)
        $chat = TelegramChat::where('chat_id', $chatId)->first();

        if ($chat) {
            $chat->update(['is_active' => false]);
            $this->telegramService->sendMessage($chatId, "Your Telegram account has been unlinked from your inventory system account.");
        } else {
            $this->telegramService->sendMessage($chatId, "Could not find an active link for this chat. If you believe this is an error, please try linking again with a token from the inventory system.");
        }

        return response()->json(['success' => true]);
    }

    /**
     * Authenticate and link account directly from Telegram Mini App.
     *
     * @param  Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function loginFromMiniApp(Request $request)
    {
        $request->validate([
            'login'     => 'required|string',
            'password'  => 'required|string',
            'init_data' => 'required|string',
        ]);

        // 1. Verify Telegram cryptographic signature
        $tgData = $this->telegramService->validateWebAppData($request->input('init_data'));
        if (!$tgData || empty($tgData['user_data']['id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired Telegram session. Please re-open the app in Telegram.',
            ], 403);
        }

        $tgUser = $tgData['user_data'];
        $chatId = (string) $tgUser['id'];

        // 2. Authenticate User credentials
        $login    = trim($request->input('login'));
        $password = $request->input('password');

        $user = User::where('email', $login)
            ->orWhere('phone', $login)
            ->orWhere('name', $login)
            ->first();

        if (!$user || !Hash::check($password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials. Please verify your email/username and password.',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'This account has been deactivated. Please contact an administrator.',
            ], 403);
        }

        // 3. Bind Telegram chat with User
        $chatInfo = [
            'username'   => $tgUser['username'] ?? null,
            'first_name' => $tgUser['first_name'] ?? null,
            'last_name'  => $tgUser['last_name'] ?? null,
            'type'       => 'private',
        ];

        $this->telegramService->activateChat($user, $chatId, $chatInfo);

        // 4. Send welcoming notification in chat
        $roleLabel = ucwords(strtolower(str_replace('_', ' ', (string) $user->role)));
        $this->telegramService->sendMessage(
            $chatId,
            "<b>✅ Account Connected!</b>\n\nHello <b>{$user->name}</b>!\nYour Telegram is now linked as <b>{$roleLabel}</b>.\nYou will receive real-time inventory alerts here."
        );

        Log::info("[TelegramBot] User {$user->id} ({$user->name}) linked via Telegram Mini App (chat {$chatId})");

        return response()->json([
            'success' => true,
            'message' => 'Connected successfully!',
            'data'    => [
                'user_id' => $user->id,
                'name'    => $user->name,
                'role'    => $user->role,
                'email'   => $user->email,
            ],
        ]);
    }

    /**
     * Check if the Telegram user opening the Mini App is already linked.
     *
     * @param  Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getMiniAppStatus(Request $request)
    {
        $request->validate([
            'init_data' => 'required|string',
        ]);

        $tgData = $this->telegramService->validateWebAppData($request->input('init_data'));
        if (!$tgData || empty($tgData['user_data']['id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired Telegram session.',
            ], 403);
        }

        $tgUser = $tgData['user_data'];
        $chatId = (string) $tgUser['id'];

        $chat = TelegramChat::with('user')->where('chat_id', $chatId)->where('is_active', true)->first();

        if ($chat && $chat->user) {
            return response()->json([
                'success' => true,
                'linked'  => true,
                'data'    => [
                    'name'       => $chat->user->name,
                    'role'       => $chat->user->role,
                    'email'      => $chat->user->email,
                    'created_at' => $chat->created_at?->toIso8601String(),
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'linked'  => false,
        ]);
    }

    /**
     * Unlink account directly from Mini App.
     *
     * @param  Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function unlinkFromMiniApp(Request $request)
    {
        $request->validate([
            'init_data' => 'required|string',
        ]);

        $tgData = $this->telegramService->validateWebAppData($request->input('init_data'));
        if (!$tgData || empty($tgData['user_data']['id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid Telegram session.',
            ], 403);
        }

        $chatId = (string) $tgData['user_data']['id'];
        $this->telegramService->deactivateChat($chatId);

        $this->telegramService->sendMessage(
            $chatId,
            "👋 Your Telegram account has been unlinked from KC Shop. You can reconnect anytime via the portal."
        );

        return response()->json([
            'success' => true,
            'message' => 'Unlinked successfully.',
        ]);
    }

    /**
     * Authenticate and resolve the linked User from Telegram initData.
     *
     * @param  string  $initData
     * @return array{user: User, tgUser: array, chatId: string}|null
     */
    protected function resolveTelegramUser(string $initData): ?array
    {
        $tgData = $this->telegramService->validateWebAppData($initData);
        if (!$tgData || empty($tgData['user_data']['id'])) {
            return null;
        }

        $chatId = (string) $tgData['user_data']['id'];
        $chat = TelegramChat::with('user')
            ->where('chat_id', $chatId)
            ->where('is_active', true)
            ->first();

        if (!$chat || !$chat->user || !$chat->user->is_active) {
            return null;
        }

        return [
            'user'   => $chat->user,
            'tgUser' => $tgData['user_data'],
            'chatId' => $chatId,
        ];
    }

    /**
     * Get real-time business pulse and inventory dashboard for Mini App.
     *
     * @param  Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getMiniAppDashboard(Request $request)
    {
        $request->validate(['init_data' => 'required|string']);

        $auth = $this->resolveTelegramUser($request->input('init_data'));
        if (!$auth) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Please link your account first.',
            ], 403);
        }

        $user     = $auth['user'];
        $isSeller = in_array(strtoupper(trim((string) $user->role)), ['SELLER', 'CASHIER'], true);

        $todayStart = Carbon::today()->startOfDay();
        $todayEnd   = Carbon::tomorrow()->startOfDay();

        // Query completed orders today
        $ordersQuery = Order::where('created_at', '>=', $todayStart)
            ->where('created_at', '<', $todayEnd)
            ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'");

        if ($isSeller) {
            $ordersQuery->where(function ($q) use ($user) {
                $q->where('seller_id', $user->id)
                  ->orWhere('user_id', $user->id);
            });
        }

        $netRevenue  = (float) (clone $ordersQuery)->sum('total_amount');
        $ordersCount = (int) (clone $ordersQuery)->count();
        $avgBasket   = $ordersCount > 0 ? round($netRevenue / $ordersCount, 2) : 0.0;

        // Payment split (Cash vs Digital)
        $paymentsQuery = Payment::where('created_at', '>=', $todayStart)
            ->where('created_at', '<', $todayEnd)
            ->whereHas('order', function ($q) use ($isSeller, $user) {
                $q->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'");
                if ($isSeller) {
                    $q->where(fn ($sub) => $sub->where('seller_id', $user->id)->orWhere('user_id', $user->id));
                }
            });

        $totalPayments = (clone $paymentsQuery)->count();
        $cashPayments  = (clone $paymentsQuery)
            ->whereRaw("LOWER(TRIM(payment_method)) = 'cash'")
            ->count();
        $digitalPayments = $totalPayments - $cashPayments;
        $digitalPct = $totalPayments > 0 ? round(($digitalPayments / $totalPayments) * 100, 1) : 0.0;

        // Low stock count (active variants where quantity_on_hand <= reorder_level)
        $lowStockQuery = ProductVariant::where('is_active', true)
            ->whereNull('deleted_at')
            ->whereRaw('quantity_on_hand <= reorder_level');

        $lowStockCount = (clone $lowStockQuery)->count();

        // Top 5 urgent low stock items
        $urgentItems = (clone $lowStockQuery)
            ->with('product')
            ->orderByRaw('(quantity_on_hand - reorder_level) ASC')
            ->take(5)
            ->get()
            ->map(fn (ProductVariant $v) => [
                'id'               => (string) $v->id,
                'name'             => $v->product?->name ?? 'Item',
                'sku'              => $v->sku,
                'quantity_on_hand' => (int) $v->quantity_on_hand,
                'reorder_level'    => (int) $v->reorder_level,
                'retail_price'     => (float) ($v->selling_price_override ?? $v->selling_price ?? $v->product?->selling_price ?? 0),
            ]);

        // Top 3 selling items today
        $topItems = OrderItem::whereHas('order', function ($q) use ($todayStart, $todayEnd, $isSeller, $user) {
                $q->where('created_at', '>=', $todayStart)
                  ->where('created_at', '<', $todayEnd)
                  ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'");
                if ($isSeller) {
                    $q->where(fn ($sub) => $sub->where('seller_id', $user->id)->orWhere('user_id', $user->id));
                }
            })
            ->selectRaw('variant_id, sum(quantity) as total_sold, sum(total_price) as total_sales')
            ->groupBy('variant_id')
            ->orderByDesc('total_sold')
            ->with(['variant.product:id,name'])
            ->take(3)
            ->get()
            ->map(fn ($item) => [
                'name'        => $item->variant?->product?->name ?? 'Product',
                'sku'         => $item->variant?->sku ?? '',
                'total_sold'  => (int) $item->total_sold,
                'total_sales' => (float) $item->total_sales,
            ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'is_seller'        => $isSeller,
                'user_name'        => $user->name,
                'user_role'        => $user->role,
                'net_revenue'      => $netRevenue,
                'orders_count'     => $ordersCount,
                'avg_basket'       => $avgBasket,
                'total_payments'   => $totalPayments,
                'cash_payments'    => $cashPayments,
                'digital_payments' => $digitalPayments,
                'digital_pct'      => $digitalPct,
                'low_stock_count'  => $lowStockCount,
                'urgent_items'     => $urgentItems,
                'top_items'        => $topItems,
                'updated_at'       => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Scan or search a barcode/SKU from the Mini App.
     *
     * @param  Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function scanBarcodeFromMiniApp(Request $request)
    {
        $request->validate([
            'init_data' => 'required|string',
            'code'      => 'required|string|max:200',
        ]);

        $auth = $this->resolveTelegramUser($request->input('init_data'));
        if (!$auth) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Please link your account first.',
            ], 403);
        }

        $user = $auth['user'];
        $canSeeCost = in_array(strtoupper(trim((string) $user->role)), ['SUPER_ADMIN', 'ADMIN', 'MANAGER'], true);

        try {
            $result = $this->scannerService->scan($request->input('code'));

            if ($result['type'] === 'variant') {
                /** @var ProductVariant $variant */
                $variant = $result['variant'];
                $product = $result['product'];

                $sellingPrice = (float) ($variant->selling_price_override ?? $variant->selling_price ?? $product?->selling_price ?? 0);
                $costPrice    = (float) ($variant->cost_price_override ?? $variant->cost_price ?? $product?->cost_price ?? 0);

                return response()->json([
                    'success' => true,
                    'type'    => 'variant',
                    'data'    => [
                        'id'               => (string) $variant->id,
                        'product_id'       => (string) $product->id,
                        'name'             => $product->name,
                        'sku'              => $variant->sku,
                        'barcode'          => $variant->barcode,
                        'quantity_on_hand' => (int) $variant->quantity_on_hand,
                        'reorder_level'    => (int) $variant->reorder_level,
                        'retail_price'     => $sellingPrice,
                        'cost_price'       => $canSeeCost ? $costPrice : null,
                        'can_adjust_stock' => $canSeeCost,
                        'attributes'       => $variant->attributeValues->map(fn ($av) => [
                            'name'  => $av->attribute?->name ?? 'Attr',
                            'value' => $av->value,
                        ]),
                    ],
                ]);
            }

            // Master product with multiple variants
            $product  = $result['product'];
            $variants = $result['variants'];

            return response()->json([
                'success' => true,
                'type'    => 'product',
                'data'    => [
                    'product_id' => (string) $product->id,
                    'name'       => $product->name,
                    'barcode'    => $product->barcode,
                    'variants'   => $variants->map(fn (ProductVariant $v) => [
                        'id'               => (string) $v->id,
                        'sku'              => $v->sku,
                        'barcode'          => $v->barcode,
                        'quantity_on_hand' => (int) $v->quantity_on_hand,
                        'reorder_level'    => (int) $v->reorder_level,
                        'retail_price'     => (float) ($v->selling_price_override ?? $v->selling_price ?? $product->selling_price ?? 0),
                        'cost_price'       => $canSeeCost ? (float) ($v->cost_price_override ?? $v->cost_price ?? $product->cost_price ?? 0) : null,
                        'can_adjust_stock' => $canSeeCost,
                    ]),
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => "No product found for code: '{$request->input('code')}'",
            ], 404);
        }
    }

    /**
     * Quick stock adjustment from Mini App (Managers/Admins only).
     *
     * @param  Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function adjustStockFromMiniApp(Request $request)
    {
        $request->validate([
            'init_data'    => 'required|string',
            'variant_id'   => 'required|string',
            'new_quantity' => 'required|integer|min:0',
            'reason'       => 'required|string',
            'notes'        => 'nullable|string|max:500',
        ]);

        $auth = $this->resolveTelegramUser($request->input('init_data'));
        if (!$auth) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        $user = $auth['user'];
        $role = strtoupper(trim((string) $user->role));
        if (!in_array($role, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Permission denied. Only Managers and Administrators can adjust stock.',
            ], 403);
        }

        $variantId   = $request->input('variant_id');
        $newQuantity = (int) $request->input('new_quantity');
        $reason      = $request->input('reason');
        $notes       = $request->input('notes') ?? "Mini App adjustment ({$reason}) by {$user->name}";

        $movementType = match ($reason) {
            'Damaged'   => 'DAMAGE',
            'Audit'     => 'ADJUSTMENT',
            'Restock'   => 'RESTOCK',
            'Return'    => 'RETURN',
            'Shrinkage' => 'SHRINKAGE',
            default     => 'ADJUSTMENT',
        };

        try {
            $result = DB::transaction(function () use ($variantId, $newQuantity, $movementType, $notes, $user) {
                /** @var ProductVariant $variant */
                $variant = ProductVariant::lockForUpdate()->findOrFail($variantId);
                $qtyBefore = (int) $variant->quantity_on_hand;
                $diff = $newQuantity - $qtyBefore;

                $variant->quantity_on_hand = $newQuantity;
                $variant->save();

                $movement = null;
                if ($diff !== 0) {
                    $refId = 'TG-ADJ-' . strtoupper(Str::random(8));
                    $movement = StockMovement::create([
                        'product_id'      => $variant->product_id,
                        'variant_id'      => $variant->id,
                        'movement_type'   => $movementType,
                        'quantity_before' => $qtyBefore,
                        'quantity_after'  => $newQuantity,
                        'quantity_change' => $diff,
                        'reference_id'    => $refId,
                        'notes'           => $notes,
                        'user_id'         => $user->id,
                    ]);

                    StockAdjusted::dispatch($variant, $movement);
                }

                return [
                    'variant'    => $variant,
                    'qty_before' => $qtyBefore,
                    'qty_after'  => $newQuantity,
                    'difference' => $diff,
                ];
            });

            Log::info("[TelegramMiniApp] Stock adjusted for variant {$variantId} by {$user->name} ({$result['qty_before']} -> {$result['qty_after']})");

            return response()->json([
                'success' => true,
                'message' => "Stock updated to {$result['qty_after']} units.",
                'data'    => [
                    'variant_id'       => (string) $result['variant']->id,
                    'quantity_on_hand' => (int) $result['qty_after'],
                    'difference'       => (int) $result['difference'],
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product variant not found.',
            ], 404);
        } catch (\Throwable $e) {
            Log::error("[TelegramMiniApp] adjustStock error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to adjust stock: ' . $e->getMessage(),
            ], 500);
        }
    }
}