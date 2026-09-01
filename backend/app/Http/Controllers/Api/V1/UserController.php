<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\User;
use App\Models\UserSalary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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
            ->map(fn (User $u) => $this->formatUser($u, true));

        return $this->successResponse($users);
    }

    /**
     * GET /api/v1/staff-members
     * List all active staff users for sales attribution (accessible to all authenticated staff).
     */
    public function staffList(Request $request): JsonResponse
    {
        $users = User::whereNull('deleted_at')
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('role')
                  ->orWhereRaw("UPPER(TRIM(role)) NOT IN ('SUPER_ADMIN', 'SUPERADMIN')");
            })
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'role'       => $u->role,
                'department' => $u->department,
                'is_active'  => (bool) $u->is_active,
            ]);

        return $this->successResponse($users);
    }

    /**
     * Helper to resolve canonical role slug and role_id from various input forms.
     */
    private function normalizeRoleAndId(?string $role, ?string $roleId = null): array
    {
        if (empty($role) && empty($roleId)) {
            return [null, null];
        }

        // 1. If roleId is passed, look up in Role table first
        if (!empty($roleId)) {
            $found = \App\Models\Role::find($roleId);
            if ($found) {
                return [$found->slug, $found->id];
            }
        }

        if (!empty($role)) {
            $trimmed = trim($role);
            $upper = strtoupper($trimmed);

            // Canonical standard mappings & aliases
            $aliases = [
                'SUPERADMIN'    => 'SUPER_ADMIN',
                'SUPER-ADMIN'   => 'SUPER_ADMIN',
                'SUPER_ADMIN'   => 'SUPER_ADMIN',
                'ROOT'          => 'SUPER_ADMIN',
                'ADMIN'         => 'ADMIN',
                'ADMINISTRATOR' => 'ADMIN',
                'MANAGER'       => 'MANAGER',
                'STORE_MANAGER' => 'MANAGER',
                'STORE-MANAGER' => 'MANAGER',
                'SELLER'        => 'SELLER',
                'CASHIER'       => 'SELLER',
                'SALES'         => 'SELLER',
                'STAFF'         => 'SELLER',
            ];

            if (isset($aliases[$upper])) {
                $canonical = $aliases[$upper];
                $matched = \App\Models\Role::where('slug', $canonical)->first();
                return [$canonical, $matched?->id];
            }

            // Look up dynamically in roles table by slug, name, or UUID
            $isUuid = \Illuminate\Support\Str::isUuid($trimmed);
            $matched = \App\Models\Role::where('slug', $trimmed)
                ->orWhere('slug', $upper)
                ->orWhere('name', $trimmed)
                ->when($isUuid, fn ($q) => $q->orWhere('id', $trimmed))
                ->first();

            if ($matched) {
                return [$matched->slug, $matched->id];
            }

            return [$upper, null];
        }

        return [null, null];
    }

    /**
     * POST /api/v1/users
     * Create a new staff user.
     */
    public function store(Request $request): JsonResponse
    {
        if ($request->has('role') || $request->has('role_id')) {
            [$resolvedRole, $resolvedRoleId] = $this->normalizeRoleAndId(
                $request->input('role'),
                $request->input('role_id')
            );
            if ($resolvedRole) {
                $request->merge(['role' => $resolvedRole]);
            }
            if ($resolvedRoleId) {
                $request->merge(['role_id' => $resolvedRoleId]);
            }
        }

        $data = $request->validate([
            'name'             => ['required', 'string', 'max:100'],
            'email'            => ['required', 'email', 'unique:users,email'],
            'phone'            => ['nullable', 'string', 'max:30'],
            'hire_date'        => ['nullable', 'date'],
            'department'       => ['nullable', 'string', 'max:50'],
            'role'             => ['required', 'string', 'max:50'],
            'role_id'          => ['nullable', 'string'],
            'password'         => ['nullable', 'string', 'min:8'],
            'permission_group' => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'base_salary'      => ['nullable', 'numeric', 'min:0'],
            'salary_reason'    => ['nullable', 'string', 'max:255'],
        ]);

        [$finalRole, $finalRoleId] = $this->normalizeRoleAndId($data['role'] ?? null, $data['role_id'] ?? null);
        $finalRole = $finalRole ?: 'SELLER';

        $plainPassword = !empty($data['password']) ? $data['password'] : Str::random(10);

        $user = User::create([
            'name'                 => $data['name'],
            'email'                => $data['email'],
            'phone'                => $data['phone'] ?? null,
            'hire_date'            => $data['hire_date'] ?? null,
            'department'           => $data['department'] ?? null,
            'role'                 => $finalRole,
            'role_id'              => $finalRoleId,
            'password'             => Hash::make($plainPassword),
            'is_active'            => true,
            'must_change_password' => true,
            'permission_group'     => $data['permission_group'] ?? null,
            'notes'                => $data['notes'] ?? null,
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

        $formatted = $this->formatUser($user);
        $formatted['temporary_password'] = $plainPassword;

        return $this->createdResponse($formatted, 'User created successfully.');
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

        if ($request->has('role') || $request->has('role_id')) {
            [$resolvedRole, $resolvedRoleId] = $this->normalizeRoleAndId(
                $request->input('role'),
                $request->input('role_id')
            );
            if ($resolvedRole) {
                $request->merge(['role' => $resolvedRole]);
            }
            if ($resolvedRoleId) {
                $request->merge(['role_id' => $resolvedRoleId]);
            }
        }

        $data = $request->validate([
            'name'             => ['sometimes', 'string', 'max:100'],
            'email'            => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'            => ['sometimes', 'nullable', 'string', 'max:30'],
            'hire_date'        => ['sometimes', 'nullable', 'date'],
            'department'       => ['sometimes', 'nullable', 'string', 'max:50'],
            'role'             => ['sometimes', 'string', 'max:50'],
            'role_id'          => ['sometimes', 'nullable', 'string'],
            'isActive'         => ['sometimes', 'boolean'],
            'is_active'        => ['sometimes', 'boolean'],
            'password'         => ['sometimes', 'nullable', 'string', 'min:8'],
            'permission_group' => ['sometimes', 'nullable', 'string'],
            'notes'            => ['sometimes', 'nullable', 'string'],
            'base_salary'      => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'salary_reason'    => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $updateData = [];
        if ($request->has('name')) $updateData['name'] = $data['name'];
        if ($request->has('email')) $updateData['email'] = $data['email'];
        if ($request->has('phone')) $updateData['phone'] = $data['phone'];
        if ($request->has('hire_date')) $updateData['hire_date'] = $data['hire_date'];
        if ($request->has('department')) $updateData['department'] = $data['department'];

        if ($request->has('role') || $request->has('role_id')) {
            [$finalRole, $finalRoleId] = $this->normalizeRoleAndId(
                $request->input('role'),
                $request->input('role_id')
            );
            if ($finalRole) {
                $updateData['role'] = $finalRole;
            }
            if ($finalRoleId) {
                $updateData['role_id'] = $finalRoleId;
            }
        }

        if ($request->has('is_active')) {
            $updateData['is_active'] = (bool) $request->input('is_active');
        } elseif ($request->has('isActive')) {
            $updateData['is_active'] = (bool) $request->input('isActive');
        }
        if ($request->has('password') && !empty($data['password'])) {
            $updateData['password'] = Hash::make($data['password']);
        }
        if ($request->has('permission_group')) $updateData['permission_group'] = $data['permission_group'];
        if ($request->has('notes')) $updateData['notes'] = $data['notes'];

        if (!empty($updateData)) {
            $user->update($updateData);
        }

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

        return $this->successResponse($this->formatUser($user->fresh(), true), 'User updated successfully.');
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

        $attrs = $user->getAttributes();
        $isActive = array_key_exists('is_active', $attrs) ? (bool) $attrs['is_active'] : true;
        $mustChange = array_key_exists('must_change_password', $attrs) ? (bool) $attrs['must_change_password'] : false;

        $roleSlug = strtoupper($user->role ?: 'SELLER');

        $formatted = [
            'id'                   => $user->id,
            'name'                 => $user->name,
            'email'                => $user->email,
            'phone'                => array_key_exists('phone', $attrs) ? $attrs['phone'] : null,
            'hire_date'            => $user->hire_date?->toDateString(),
            'department'           => array_key_exists('department', $attrs) ? $attrs['department'] : null,
            'notes'                => array_key_exists('notes', $attrs) ? $attrs['notes'] : null,
            'role'                 => $roleSlug,
            'role_id'              => array_key_exists('role_id', $attrs) ? $attrs['role_id'] : $user->role_id,
            'is_active'            => $isActive,
            'isActive'             => $isActive,
            'status'               => $isActive ? 'ACTIVE' : 'INACTIVE',
            'must_change_password' => $mustChange,
            'mustChangePassword'   => $mustChange,
            'base_salary'          => $latestSalary ? (float) $latestSalary->base_salary : 0,
            'salary_reason'        => $latestSalary?->reason,
            'permissionGroup'      => array_key_exists('permission_group', $attrs) ? $attrs['permission_group'] : null,
            'permissions'          => $user->getPermissionsArray(),
            'lastActive'           => $user->updated_at?->toDateTimeString(),
            'createdAt'            => $user->created_at?->toDateTimeString(),
            'created_at'           => $user->created_at?->toDateTimeString(),
        ];

        if ($detailed) {
            $totalOrders = \App\Models\Order::where(function ($q) use ($user) {
                $q->where('seller_id', $user->id)
                  ->orWhere(function ($q2) use ($user) {
                      $q2->where('user_id', $user->id)->whereNull('seller_id');
                  });
            })->count();

            $totalSales = (float) \App\Models\Order::where(function ($q) use ($user) {
                $q->where('seller_id', $user->id)
                  ->orWhere(function ($q2) use ($user) {
                      $q2->where('user_id', $user->id)->whereNull('seller_id');
                  });
            })
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
