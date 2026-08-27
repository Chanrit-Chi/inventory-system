<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\User;
use App\Models\UserSalary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends BaseApiController
{
    /**
     * GET /api/v1/users
     * List all staff users (admin/super_admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $users = User::whereNull('deleted_at')
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => $this->formatUser($u));

        return $this->successResponse($users);
    }

    /**
     * POST /api/v1/users
     * Create a new staff user.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'             => ['required', 'string', 'max:100'],
            'email'            => ['required', 'email', 'unique:users,email'],
            'phone'            => ['nullable', 'string', 'max:30'],
            'hire_date'        => ['nullable', 'date'],
            'department'       => ['nullable', 'string', 'max:50'],
            'role'             => ['required', Rule::in(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'])],
            'password'         => ['required', 'string', 'min:8'],
            'permission_group' => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'base_salary'      => ['nullable', 'numeric', 'min:0'],
            'salary_reason'    => ['nullable', 'string', 'max:255'],
        ]);

        $user = User::create([
            'name'             => $data['name'],
            'email'            => $data['email'],
            'phone'            => $data['phone'] ?? null,
            'hire_date'        => $data['hire_date'] ?? null,
            'department'       => $data['department'] ?? null,
            'role'             => $data['role'],
            'password'         => Hash::make($data['password']),
            'is_active'        => true,
            'permission_group' => $data['permission_group'] ?? null,
            'notes'            => $data['notes'] ?? null,
        ]);

        if (isset($data['base_salary']) && is_numeric($data['base_salary']) && (float) $data['base_salary'] > 0) {
            UserSalary::create([
                'user_id'        => $user->id,
                'base_salary'    => round((float) $data['base_salary'], 2),
                'effective_from' => $data['hire_date'] ?? now()->toDateString(),
                'reason'         => $data['salary_reason'] ?? 'Initial Starting Salary Package',
                'created_by'     => auth()->id() ?? $user->id,
            ]);
        }

        return $this->createdResponse($this->formatUser($user), 'User created successfully.');
    }

    /**
     * GET /api/v1/users/{id}
     */
    public function show(string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        return $this->successResponse($this->formatUser($user, true));
    }

    /**
     * PATCH /api/v1/users/{id}
     * Update a staff user's profile and role.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $data = $request->validate([
            'name'             => ['sometimes', 'string', 'max:100'],
            'email'            => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'            => ['sometimes', 'nullable', 'string', 'max:30'],
            'hire_date'        => ['sometimes', 'nullable', 'date'],
            'department'       => ['sometimes', 'nullable', 'string', 'max:50'],
            'role'             => ['sometimes', Rule::in(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'])],
            'isActive'         => ['sometimes', 'boolean'],
            'permission_group' => ['sometimes', 'nullable', 'string'],
            'notes'            => ['sometimes', 'nullable', 'string'],
            'base_salary'      => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'salary_reason'    => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        // Map camelCase from mobile to snake_case for DB
        $updateData = array_filter([
            'name'             => $data['name'] ?? null,
            'email'            => $data['email'] ?? null,
            'phone'            => $data['phone'] ?? null,
            'hire_date'        => $data['hire_date'] ?? null,
            'department'       => $data['department'] ?? null,
            'role'             => $data['role'] ?? null,
            'is_active'        => isset($data['isActive']) ? (bool) $data['isActive'] : null,
            'permission_group' => $data['permission_group'] ?? null,
            'notes'            => $data['notes'] ?? null,
        ], fn ($v) => $v !== null);

        $user->update($updateData);

        if (isset($data['base_salary']) && is_numeric($data['base_salary'])) {
            $newSalary = round((float) $data['base_salary'], 2);
            $latestSalary = UserSalary::where('user_id', $user->id)
                ->orderByDesc('effective_from')
                ->first();

            if (!$latestSalary || (float) $latestSalary->base_salary !== $newSalary) {
                UserSalary::create([
                    'user_id'        => $user->id,
                    'base_salary'    => $newSalary,
                    'effective_from' => now()->toDateString(),
                    'reason'         => $data['salary_reason'] ?? 'Salary Adjustment',
                    'created_by'     => auth()->id() ?? $user->id,
                ]);
            }
        }

        return $this->successResponse($this->formatUser($user->fresh()), 'User updated successfully.');
    }

    /**
     * PATCH /api/v1/users/{id}/status
     * Toggle user active/inactive status.
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        // Protect super admin accounts
        if ($user->role === 'SUPER_ADMIN') {
            return $this->errorResponse('Super Admin accounts cannot be deactivated.', null, 403);
        }

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $user->update(['is_active' => $data['is_active']]);

        $status = $data['is_active'] ? 'activated' : 'deactivated';
        return $this->successResponse($this->formatUser($user->fresh()), "User {$status} successfully.");
    }

    /**
     * DELETE /api/v1/users/{id}
     * Soft-delete a user.
     */
    public function destroy(string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->role === 'SUPER_ADMIN') {
            return $this->errorResponse('Super Admin accounts cannot be deleted.', null, 403);
        }

        $user->delete();

        return $this->successResponse(null, 'User deleted successfully.');
    }

    private function formatUser(User $user, bool $detailed = false): array
    {
        $latestSalary = UserSalary::where('user_id', $user->id)
            ->orderByDesc('effective_from')
            ->first();

        $formatted = [
            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $user->email,
            'phone'           => $user->phone,
            'hire_date'       => $user->hire_date?->toDateString(),
            'department'      => $user->department,
            'notes'           => $user->notes,
            'role'            => $user->role,
            'isActive'        => (bool) $user->is_active,
            'base_salary'     => $latestSalary ? (float) $latestSalary->base_salary : 0,
            'salary_reason'   => $latestSalary?->reason,
            'permissionGroup' => $user->permission_group,
            'permissions'     => $user->getPermissionsArray(),
            'lastActive'      => $user->updated_at?->toDateTimeString(),
        ];

        if ($detailed) {
            $totalOrders = \App\Models\Order::where('seller_id', $user->id)->count();
            $totalSales = (float) \App\Models\Order::where('seller_id', $user->id)
                ->whereRaw("UPPER(TRIM(status)) = 'COMPLETED'")
                ->sum('total_amount');
            $totalNetPaid = (float) \App\Models\Payroll::where('user_id', $user->id)
                ->where('status', 'PAID')
                ->sum('total_net_pay');

            $formatted['stats'] = [
                'total_orders'   => $totalOrders,
                'total_sales'    => round($totalSales, 2),
                'total_net_paid' => round($totalNetPaid, 2),
            ];
        }

        return $formatted;
    }
}
