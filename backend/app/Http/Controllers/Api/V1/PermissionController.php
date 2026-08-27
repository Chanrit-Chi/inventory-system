<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermissionController extends BaseApiController
{
    /**
     * GET /api/v1/permissions
     * List all system permissions grouped by module.
     */
    public function index(Request $request): JsonResponse
    {
        $permissions = Permission::orderBy('module')
            ->orderBy('slug')
            ->get()
            ->map(function (Permission $permission) {
                return [
                    'id'          => $permission->id,
                    'name'        => $permission->name,
                    'slug'        => $permission->slug,
                    'module'      => $permission->module,
                    'description' => $permission->description,
                ];
            });

        return $this->successResponse($permissions, 'Permissions retrieved successfully.');
    }
}
