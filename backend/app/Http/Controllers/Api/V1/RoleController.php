<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends BaseApiController
{
    /**
     * GET /api/v1/roles
     * List all roles with assigned permissions and user count.
     */
    public function index(Request $request): JsonResponse
    {
        $roles = Role::with('permissions')
            ->orderBy('name')
            ->get()
            ->map(function (Role $role) {
                $count = \App\Models\User::where('role_id', $role->id)
                    ->orWhere('role', $role->slug)
                    ->count();

                return [
                    'id'          => $role->id,
                    'name'        => $role->name,
                    'slug'        => $role->slug,
                    'description' => $role->description,
                    'permissions' => $role->getPermissionsArray(),
                    'users_count' => (int) $count,
                    'usersCount'  => (int) $count,
                ];
            });

        return $this->successResponse($roles, 'Roles retrieved successfully.');
    }

    /**
     * GET /api/v1/roles/{id}
     * Retrieve single role with its permissions and metadata.
     */
    public function show(string $id): JsonResponse
    {
        $role = Role::with('permissions')
            ->where('id', $id)
            ->orWhere('slug', $id)
            ->firstOrFail();

        $count = \App\Models\User::where('role_id', $role->id)
            ->orWhere('role', $role->slug)
            ->count();

        return $this->successResponse([
            'id'          => $role->id,
            'name'        => $role->name,
            'slug'        => $role->slug,
            'description' => $role->description,
            'permissions' => $role->getPermissionsArray(),
            'users_count' => (int) $count,
            'usersCount'  => (int) $count,
        ], 'Role retrieved successfully.');
    }

    /**
     * PUT /api/v1/roles/{id}/permissions
     * Update permissions assigned to a role.
     */
    public function updatePermissions(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'permissions'   => ['present', 'array'],
            'permissions.*' => ['string'],
        ]);

        $role = Role::where('id', $id)->orWhere('slug', $id)->firstOrFail();

        $permissionInputs = $data['permissions'] ?? [];
        $permissionIds = [];

        if (! empty($permissionInputs)) {
            $permissions = Permission::whereIn('slug', $permissionInputs)
                ->orWhereIn('id', $permissionInputs)
                ->get();

            $permissionIds = $permissions->pluck('id')->toArray();
        }

        // Prohibit removing root bypass wildcard from SUPER_ADMIN role
        if ($role->slug === 'SUPER_ADMIN') {
            $wildcardPerm = Permission::where('slug', '*')->first();
            if ($wildcardPerm && ! in_array($wildcardPerm->id, $permissionIds, true)) {
                $permissionIds[] = $wildcardPerm->id;
            }
        }

        DB::transaction(function () use ($role, $permissionIds) {
            $role->permissions()->sync($permissionIds);
        });

        $role->load('permissions');

        return $this->successResponse([
            'id'          => $role->id,
            'name'        => $role->name,
            'slug'        => $role->slug,
            'description' => $role->description,
            'permissions' => $role->getPermissionsArray(),
        ], 'Role permissions updated successfully.');
    }
}
