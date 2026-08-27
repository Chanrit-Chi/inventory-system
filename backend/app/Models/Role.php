<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'roles';

    protected $fillable = [
        'name',
        'slug',
        'description',
    ];

    /**
     * The permissions that belong to the role.
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(
            Permission::class,
            'permission_role',
            'role_id',
            'permission_id'
        )->using(PermissionRole::class)->withTimestamps();
    }

    /**
     * The users that belong to the role.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }

    /**
     * Determine whether the role grants a specific permission.
     */
    public function hasPermission(string $permission): bool
    {
        if ($this->slug === 'SUPER_ADMIN') {
            return true;
        }

        $permissions = $this->getPermissionsArray();

        if (in_array('*', $permissions, true)) {
            return true;
        }

        if (in_array($permission, $permissions, true)) {
            return true;
        }

        if (str_contains($permission, ':')) {
            [$module, $action] = explode(':', $permission, 2);
            // 1. If checking module:action and role has module:*
            if (in_array($module . ':*', $permissions, true)) {
                return true;
            }
            // 2. If checking module:* and role has any granular module:x permission
            if ($action === '*') {
                foreach ($permissions as $p) {
                    if (str_starts_with($p, $module . ':')) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Get an array of all permission slugs assigned to this role.
     *
     * @return array<int, string>
     */
    public function getPermissionsArray(): array
    {
        if ($this->relationLoaded('permissions')) {
            $slugs = $this->permissions->pluck('slug')->toArray();
        } else {
            $slugs = $this->permissions()->pluck('slug')->toArray();
        }

        if ($this->slug === 'SUPER_ADMIN' && empty($slugs)) {
            return ['*'];
        }

        return $slugs;
    }
}
