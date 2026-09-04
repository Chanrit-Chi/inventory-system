<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        $search = $request->filled('search') ? trim($request->input('search')) : null;
        $rawCategory = $request->filled('category') ? strtoupper(trim($request->input('category'))) : 'ALL';
        $action = $request->filled('action') ? trim($request->input('action')) : null;
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);

        $query = AuditLog::query();

        // Category filter (support canonical categories & common frontend aliases)
        if ($rawCategory !== 'ALL') {
            if (in_array($rawCategory, ['SECURITY', 'AUTH', 'LOGIN'])) {
                $query->where(function ($q) {
                    $q->whereIn('category', ['SECURITY', 'AUTH'])
                      ->orWhere('action', 'like', '%LOGIN%')
                      ->orWhere('action', 'like', '%LOGOUT%')
                      ->orWhere('action', 'like', '%PASSWORD%');
                });
            } elseif (in_array($rawCategory, ['INVENTORY', 'PRODUCTS', 'PRODUCT', 'STOCK'])) {
                $query->where(function ($q) {
                    $q->whereIn('category', ['INVENTORY', 'PRODUCTS'])
                      ->orWhereIn('action', ['RESTOCK', 'ADJUSTMENT', 'SALE', 'CANCELLATION_REVERSAL', 'STOCK_ADJUSTMENT']);
                });
            } elseif (in_array($rawCategory, ['STAFF', 'USERS', 'USER', 'SYSTEM'])) {
                $query->where(function ($q) {
                    $q->whereIn('category', ['STAFF', 'USERS', 'SYSTEM'])
                      ->orWhere('action', 'like', 'USER_%')
                      ->orWhere('action', 'like', '%ROLE%')
                      ->orWhere('action', 'like', '%PERMISSION%');
                });
            } elseif (in_array($rawCategory, ['BILLING', 'EXPENSES', 'EXPENSE', 'INVOICES', 'INVOICE'])) {
                $query->where(function ($q) {
                    $q->whereIn('category', ['BILLING', 'EXPENSES', 'INVOICE', 'INVOICES'])
                      ->orWhere('action', 'like', 'INVOICE_%')
                      ->orWhere('action', 'like', 'EXPENSE_%');
                });
            } elseif (in_array($rawCategory, ['ORDERS', 'ORDER', 'CHECKOUT', 'SALES'])) {
                $query->where(function ($q) {
                    $q->where('category', 'ORDERS')
                      ->orWhere('action', 'like', 'ORDER_%');
                });
            } elseif ($rawCategory === 'PAYROLL') {
                $query->where(function ($q) {
                    $q->where('category', 'PAYROLL')
                      ->orWhere('action', 'like', 'PAYROLL_%');
                });
            } else {
                $query->where('category', $rawCategory);
            }
        }

        // Action filter
        if ($action) {
            $query->where('action', 'like', "%{$action}%");
        }

        // Date range filter
        if ($dateFrom) {
            $query->whereDate('occurred_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('occurred_at', '<=', $dateTo);
        }

        // Text search
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('target', 'like', "%{$search}%")
                    ->orWhere('actor_name', 'like', "%{$search}%")
                    ->orWhere('details', 'like', "%{$search}%");
            });
        }

        // Sort by occurred_at descending (most recent first)
        $query->latest('occurred_at');

        $logs = $query->paginate($perPage);

        return $this->paginatedResponse($logs);
    }
}