<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends BaseApiController
{
    /**
     * GET /api/v1/customers
     */
    public function index(Request $request): JsonResponse
    {
        $query = Customer::query();

        if ($request->filled('search')) {
            $raw = trim($request->input('search'));
            $digits = preg_replace('/\D/', '', $raw);

            $query->where(function ($q) use ($raw, $digits) {
                if (!empty($digits)) {
                    $q->where('phone_normalized', 'like', '%' . $digits . '%')
                      ->orWhere('phone', 'like', '%' . $raw . '%');
                }

                $q->orWhere('name', 'like', '%' . $raw . '%');
            });
        }

        // Direct autocomplete limit option for high-speed POS search
        if ($request->has('limit')) {
            $limit = min(50, max(1, (int) $request->input('limit', 10)));
            $customers = $query->orderByDesc('total_purchased')
                               ->orderByDesc('last_purchase_at')
                               ->limit($limit)
                               ->get();

            return $this->successResponse($customers);
        }

        $sortBy = $request->input('sort_by', 'total_spent');
        if ($sortBy === 'total_purchased') {
            $query->orderByDesc('total_purchased')->orderByDesc('total_spent')->latest();
        } elseif ($sortBy === 'name') {
            $query->orderBy('name');
        } elseif ($sortBy === 'latest') {
            $query->latest();
        } else {
            $query->orderByDesc('total_spent')->orderByDesc('total_purchased')->latest();
        }

        $perPage = min(100, max(1, (int) $request->input('per_page', 15)));
        $customers = $query->paginate($perPage);

        return $this->paginatedResponse($customers);
    }

    /**
     * GET /api/v1/customers/{id}
     */
    public function show(string $id): JsonResponse
    {
        $customer = Customer::with([
            'orders' => fn ($q) => $q->orderByDesc('total_amount')->latest()->limit(10),
            'orders.channel',
            'orders.payments',
            'orders.items.product',
            'orders.items.variant',
        ])->findOrFail($id);

        return $this->successResponse($customer);
    }
}
