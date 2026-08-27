<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends BaseApiController
{
    /**
     * GET /api/v1/expenses
     */
    public function index(Request $request): JsonResponse
    {
        $query = Expense::query()->with(['user:id,name,role']);

        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%")
                  ->orWhere('payment_method', 'like', "%{$search}%");
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('expense_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('expense_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('category') && strtoupper($request->input('category')) !== 'ALL') {
            $query->where('category', 'like', '%' . $request->input('category') . '%');
        }

        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->input('payment_method'));
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $expenses = $query->latest('expense_date')->latest('created_at')->paginate($perPage);

        return $this->paginatedResponse($expenses);
    }

    /**
     * POST /api/v1/expenses
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'          => ['nullable', 'string', 'max:255'],
            'expense_date'   => ['required', 'date'],
            'category'       => ['required', 'string', 'max:100'],
            'amount'         => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
            'notes'          => ['nullable', 'string'],
        ]);

        if (empty($validated['title'])) {
            $validated['title'] = $validated['category'] . ' Expense';
        }

        $validated['user_id'] = $request->user()?->id;
        $validated['created_by'] = $request->user()?->id;

        $expense = Expense::create($validated);
        $expense->loadMissing('user:id,name,role');

        return $this->createdResponse($expense, 'Expense recorded successfully.');
    }

    /**
     * DELETE /api/v1/expenses/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);
        $expense->delete();

        return $this->noContentResponse('Expense deleted successfully.');
    }
}
