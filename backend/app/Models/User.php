<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, HasUuids, HasApiTokens, Notifiable, SoftDeletes;

    protected $table = 'users';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'role_id',
        'phone',
        'hire_date',
        'department',
        'is_active',
        'is_test_account',
        'permission_group',
        'notes',
        'must_change_password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'    => 'datetime',
            'password'             => 'hashed',
            'is_active'            => 'boolean',
            'is_test_account'      => 'boolean',
            'must_change_password' => 'boolean',
            'hire_date'            => 'date',
        ];
    }

    /**
     * Scope query to real operational staff (non-super-admin, active, not test accounts).
     */
    public function scopeOperational($query)
    {
        return $query->whereNull('deleted_at')
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('is_test_account')
                  ->orWhere('is_test_account', false);
            })
            ->where(function ($q) {
                $q->whereNull('role')
                  ->orWhereRaw("UPPER(TRIM(role)) NOT IN ('SUPER_ADMIN', 'SUPERADMIN')");
            });
    }

    /**
     * Relationship to the assigned dynamic Role.
     */
    public function roleRelation(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /**
     * Backward compatibility accessor for role string.
     */
    public function getRoleAttribute(?string $value): ?string
    {
        if ($value !== null && $value !== '') {
            $normalized = strtoupper(trim($value));
            if ($normalized === 'CASHIER') {
                return 'SELLER';
            }
            if ($normalized === 'ADMIN') {
                return 'ADMIN';
            }
            return $value;
        }

        if ($this->relationLoaded('roleRelation') && $this->roleRelation) {
            return $this->roleRelation->slug;
        }

        if (!empty($this->attributes['role_id'])) {
            try {
                $role = Role::find($this->attributes['role_id']);
                return $role?->slug;
            } catch (\Throwable $e) {
                return null;
            }
        }

        return $value;
    }

    /**
     * Backward compatibility mutator for role string.
     */
    public function setRoleAttribute(?string $value): void
    {
        if ($value === null) {
            $this->attributes['role'] = null;
            return;
        }

        $normalized = strtoupper(trim($value));
        if ($normalized === 'CASHIER') {
            $normalized = 'SELLER';
        }

        $this->attributes['role'] = $normalized;

        if (empty($this->attributes['role_id'])) {
            try {
                $roleRecord = Role::where('slug', $normalized)->first();
                if ($roleRecord) {
                    $this->attributes['role_id'] = $roleRecord->id;
                }
            } catch (\Throwable $e) {
                // Table might not exist during isolated tests or early migrations
            }
        }
    }

    /**
     * Mutator for role_id to keep role string in sync.
     */
    public function setRoleIdAttribute(?string $value): void
    {
        $this->attributes['role_id'] = $value;

        if (!empty($value) && empty($this->attributes['role'])) {
            try {
                $roleRecord = Role::find($value);
                if ($roleRecord) {
                    $this->attributes['role'] = $roleRecord->slug;
                }
            } catch (\Throwable $e) {
            }
        }
    }

    /**
     * Check if user has a specific permission or wildcard access.
     */
    public function hasPermission(string $permission): bool
    {
        $roleName = $this->role;
        if ($roleName === 'SUPER_ADMIN') {
            return true;
        }

        $role = $this->relationLoaded('roleRelation') ? $this->roleRelation : null;
        if (!$role && !empty($this->attributes['role_id'])) {
            $role = Role::with('permissions')->find($this->attributes['role_id']);
        }
        if (!$role && $roleName) {
            $role = Role::with('permissions')->where('slug', $roleName)->first();
        }

        if ($role) {
            return $role->hasPermission($permission);
        }

        return false;
    }

    /**
     * Get an array of all permission slugs granted to the user.
     *
     * @return array<int, string>
     */
    public function getPermissionsArray(): array
    {
        $roleName = $this->role;
        if ($roleName === 'SUPER_ADMIN') {
            return ['*'];
        }

        $role = $this->relationLoaded('roleRelation') ? $this->roleRelation : null;
        if (!$role && !empty($this->attributes['role_id'])) {
            $role = Role::with('permissions')->find($this->attributes['role_id']);
        }
        if (!$role && $roleName) {
            $role = Role::with('permissions')->where('slug', $roleName)->first();
        }

        if ($role) {
            return $role->getPermissionsArray();
        }

        return [];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'user_id');
    }

    public function restockSessions(): HasMany
    {
        return $this->hasMany(RestockSession::class, 'user_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'user_id');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'user_id');
    }

    public function salary()
    {
        return $this->hasOne(UserSalary::class, 'user_id');
    }

    public function salaries(): HasMany
    {
        return $this->hasMany(UserSalary::class, 'user_id');
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class, 'user_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['SUPER_ADMIN', 'ADMIN'], true);
    }
}
