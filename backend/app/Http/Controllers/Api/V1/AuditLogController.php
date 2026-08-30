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
        $category = $request->filled('category') ? strtoupper(trim($request->input('category'))) : 'ALL';
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);

        $query = AuditLog::query();

        // Category filter
        if ($category !== 'ALL') {
            $query->where('category', $category);
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