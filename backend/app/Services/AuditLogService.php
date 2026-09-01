<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuditLogService
{
    /**
     * Record an audit log entry.
     */
    public function log(
        string $sourceType,
        string $sourceId,
        string $action,
        string $category,
        string $target,
        ?string $actorName = null,
        ?string $actorRole = null,
        ?string $details = null,
        array $metadata = [],
        ?\DateTimeInterface $occurredAt = null
    ): void {
        if (!isset($metadata['ip']) && function_exists('request') && request()) {
            $metadata['ip'] = request()->ip();
        }
        if (!isset($metadata['device']) && function_exists('request') && request()) {
            $metadata['device'] = request()->userAgent();
        }

        AuditLog::create([
            'id' => (string) Str::uuid(),
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'action' => $action,
            'category' => $category,
            'target' => $target,
            'actor_name' => $actorName,
            'actor_role' => $actorRole,
            'details' => $details,
            'metadata' => $metadata ?: null,
            'occurred_at' => $occurredAt ?? now(),
        ]);
    }

    /**
     * Sync stock movements to audit log.
     */
    public function syncStockMovement(\App\Models\StockMovement $movement): void
    {
        $itemLabel = $movement->variant?->product?->name ?? ($movement->variant?->sku ?? ($movement->variant_id ?? 'Item'));
        $change = (int) ($movement->quantity_change ?? 0);
        $changeStr = ($change >= 0 ? '+' : '') . $change;
        $actionType = strtoupper($movement->movement_type ?? ($movement->type ?? 'STOCK_MOVEMENT'));

        $this->log(
            'STOCK_MOVEMENT',
            (string) $movement->id,
            $actionType,
            'INVENTORY',
            "{$itemLabel} ({$changeStr})",
            $movement->user?->name ?? 'System Staff',
            $movement->user?->role ?? null,
            $movement->notes ?? "Stock change of {$changeStr} units",
            [
                'variant_id' => $movement->variant_id,
                'product_id' => $movement->variant?->product_id,
                'quantity_change' => $change,
                'reference_type' => $movement->reference_type,
                'reference_id' => $movement->reference_id,
            ],
            $movement->created_at
        );
    }

    /**
     * Sync personal access token (login) to audit log.
     */
    public function syncPersonalAccessToken(\Laravel\Sanctum\PersonalAccessToken $token): void
    {
        $userName = $token->tokenable?->name ?? ($token->tokenable?->email ?? 'Staff User');
        $userRole = $token->tokenable?->role ?? 'STAFF';
        $eventTime = $token->last_used_at ?? $token->created_at;

        $abilities = is_array($token->abilities) ? $token->abilities : [];
        $ipAbility = collect($abilities)->first(fn ($a) => is_string($a) && str_starts_with($a, 'ip:'));
        $ipAddress = $ipAbility ? substr($ipAbility, 3) : null;

        $detailsText = $ipAddress
            ? "Device: {$token->name} • IP: {$ipAddress}"
            : "Device: {$token->name}";

        $this->log(
            'PERSONAL_ACCESS_TOKEN',
            'login-' . $token->id,
            'USER_LOGIN',
            'SECURITY',
            $token->tokenable?->email ?? 'POS App Session',
            $userName,
            $userRole,
            $detailsText,
            [
                'ip' => $ipAddress,
                'device' => $token->name,
                'abilities' => $abilities,
            ],
            $eventTime
        );
    }

    /**
     * Sync order to audit log.
     */
    public function syncOrder(\App\Models\Order $order): void
    {
        $status = strtoupper($order->status ?? 'COMPLETED');
        $amount = number_format((float) ($order->total_amount ?? 0), 2);

        $this->log(
            'ORDER',
            'ord-log-' . $order->id,
            "ORDER_{$status}",
            'ORDERS',
            "Order {$order->order_number} (\${$amount})",
            $order->user?->name ?? 'POS Register',
            $order->user?->role ?? null,
            "Customer: " . ($order->customer?->name ?? 'Walk-in'),
            [
                'order_number' => $order->order_number,
                'total_amount' => (float) ($order->total_amount ?? 0),
                'status' => $order->status,
                'customer_id' => $order->customer_id,
                'channel_id' => $order->channel_id,
            ],
            $order->created_at
        );
    }

    /**
     * Sync invoice to audit log.
     */
    public function syncInvoice(\App\Models\Invoice $invoice): void
    {
        $invStatus = strtoupper($invoice->status ?? 'ISSUED');
        $invTotal = number_format((float) ($invoice->total_amount ?? 0), 2);

        $this->log(
            'INVOICE',
            'inv-log-' . $invoice->id,
            "INVOICE_{$invStatus}",
            'BILLING',
            "Invoice {$invoice->invoice_number} (\${$invTotal})",
            $invoice->user?->name ?? 'Finance Admin',
            $invoice->user?->role ?? null,
            "Billed to: {$invoice->customer_name}",
            [
                'invoice_number' => $invoice->invoice_number,
                'total_amount' => (float) ($invoice->total_amount ?? 0),
                'status' => $invoice->status,
                'customer_id' => $invoice->customer_id,
            ],
            $invoice->created_at
        );
    }

    /**
     * Sync user to audit log.
     */
    public function syncUser(\App\Models\User $user): void
    {
        $this->log(
            'USER',
            'user-log-' . $user->id,
            'USER_PROFILE_SYNC',
            'STAFF',
            "{$user->name} ({$user->role})",
            'System Admin',
            'ADMIN',
            "Staff email: {$user->email}",
            [
                'email' => $user->email,
                'role' => $user->role,
            ],
            $user->created_at
        );
    }

    /**
     * Sync payroll audit log to unified audit log.
     */
    public function syncPayrollAuditLog(\App\Models\PayrollAuditLog $entry): void
    {
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

        $this->log(
            'PAYROLL_AUDIT_LOG',
            'payr-log-' . $entry->id,
            $entry->action,
            'PAYROLL',
            $entry->subject ?? ($entry->staff?->name ?? 'Staff'),
            $entry->actor?->name ?? 'System',
            $entry->actor?->role ?? null,
            $detailParts === [] ? ($entry->subject ?? 'Payroll event') : implode(', ', $detailParts),
            [
                'changes' => $changes,
                'staff_id' => $entry->staff_id,
                'actor_id' => $entry->actor_id,
            ],
            $entry->created_at
        );
    }

    /**
     * Bulk sync from source models (for backfill/migration).
     * Call this from a command or scheduled job.
     */
    public function bulkSync(): array
    {
        $counts = [
            'stock_movements' => 0,
            'tokens' => 0,
            'orders' => 0,
            'invoices' => 0,
            'users' => 0,
            'payroll' => 0,
        ];

        DB::transaction(function () use (&$counts) {
            // Stock Movements
            \App\Models\StockMovement::chunkById(100, function ($movements) use (&$counts) {
                foreach ($movements as $movement) {
                    $this->syncStockMovement($movement);
                    $counts['stock_movements']++;
                }
            });

            // Personal Access Tokens
            \Laravel\Sanctum\PersonalAccessToken::chunkById(100, function ($tokens) use (&$counts) {
                foreach ($tokens as $token) {
                    $this->syncPersonalAccessToken($token);
                    $counts['tokens']++;
                }
            });

            // Orders
            \App\Models\Order::chunkById(100, function ($orders) use (&$counts) {
                foreach ($orders as $order) {
                    $this->syncOrder($order);
                    $counts['orders']++;
                }
            });

            // Invoices
            \App\Models\Invoice::chunkById(100, function ($invoices) use (&$counts) {
                foreach ($invoices as $invoice) {
                    $this->syncInvoice($invoice);
                    $counts['invoices']++;
                }
            });

            // Users
            \App\Models\User::chunkById(100, function ($users) use (&$counts) {
                foreach ($users as $user) {
                    $this->syncUser($user);
                    $counts['users']++;
                }
            });

            // Payroll Audit Logs
            \App\Models\PayrollAuditLog::chunkById(100, function ($logs) use (&$counts) {
                foreach ($logs as $log) {
                    $this->syncPayrollAuditLog($log);
                    $counts['payroll']++;
                }
            });
        });

        return $counts;
    }
}