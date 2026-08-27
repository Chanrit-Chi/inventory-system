# Project: Dynamic Role-Based Access Control (RBAC) System

## Architecture
The system consists of:
1. **Database & Relational Model Layer (PostgreSQL / SQLite)**:
   - `roles` table: UUID `id`, `name`, `slug`, `description`, timestamps.
   - `permissions` table: UUID `id`, `name`, `slug`, `module`, `description`, timestamps.
   - `permission_role` pivot table: UUID `id`, `role_id` (FK `roles.id`), `permission_id` (FK `permissions.id`), timestamps.
   - `users` table: updated with `role_id` (FK `roles.id`), preserving `role` string compatibility.
2. **Backend Services & API Layer (Laravel 11 + Sanctum)**:
   - Models: `App\Models\Role`, `App\Models\Permission`, `App\Models\User`.
   - `CheckRole` middleware: Checks dynamically against `$user->hasPermission(...)` with `SUPER_ADMIN` bypass.
   - Controllers: `RoleController`, `PermissionController`, `AuthController` (`formatUser` with `permissions: string[]`).
   - Routes: `GET /api/v1/roles`, `GET /api/v1/permissions`, `PUT /api/v1/roles/{id}/permissions` (Super Admin protected).
3. **Frontend Client & UI Layer (React Native / Expo + TypeScript)**:
   - `usePermissions.ts`: Evaluates dynamic permissions directly from `currentUser.permissions` (hardcoded `ROLE_PERMISSIONS` deleted).
   - `types/index.ts`: `UserAccount` with `permissions?: string[]`, `RoleItem`, `PermissionItem`, `TabType`.
   - `api/endpoints.ts`: `fetchRoles`, `fetchPermissions`, `updateRolePermissions`.
   - `AdminRolesScreen.tsx`: Super Admin UI to inspect roles, view capabilities grouped by module, and toggle permissions in real-time.
4. **Testing & Verification Layer**:
   - Automated PHPUnit tests (`backend/tests/Feature/DynamicRbacTest.php`, existing `AuthAndRbacTest.php`).
   - E2E Python test runner (`tests/e2e/runner.py`, `tests/e2e/tier1_features/test_dynamic_rbac.py`, `tests/e2e/api_client.py`).
   - Mobile JS adversarial and empirical invariant test suites.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dynamic RBAC Schema | Create `roles`, `permissions`, `permission_role` tables and migrate `users.role_id` foreign key | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Relational Models | Eloquent models `Role`, `Permission`, `User` with `permissions()`, `roles()`, `hasPermission()`, `getPermissionsArray()` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Role & Permission Seeding | Seed default roles (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SELLER`) and default capabilities (`products:*`, `users:manage`, etc.) | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Dynamic Permission Middleware | Refactor `CheckRole` to check `$user->hasPermission()` with `SUPER_ADMIN` bypass and backward compatibility | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Super Admin Role Management API | Endpoints `GET /roles`, `GET /permissions`, `PUT /roles/{id}/permissions` restricted to Super Admin | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Dynamic User Auth Payload | Update `/auth/login` and `/auth/me` responses to return user's dynamic `permissions: string[]` | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Frontend Dynamic Hook & State | Update `usePermissions.ts` to check `currentUser.permissions`, deleting static `ROLE_PERMISSIONS` | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Frontend Super Admin UI | Build `AdminRolesScreen.tsx` for Super Admins to view roles and toggle permissions; link in navigation | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Dynamic Access Gain/Loss Tests | Automated PHPUnit tests proving user immediately gains/loses access upon API role permission update | M4 | ORIGINAL_REQUEST §Acceptance |
| 10 | Regression & Full E2E Verification | Ensure all 187+ PHPUnit tests and 95+ E2E tests pass 100% cleanly without regressions | M4 | ORIGINAL_REQUEST §Acceptance |
| 11 | Full-Scope Review & Integrity Audit | Objective review and forensic integrity audit confirming clean, genuine implementation | M5 | Integrity Policy |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database, Models & Seeding | Migrations (`roles`, `permissions`, `permission_role`, `users.role_id`), Models (`Role`, `Permission`, `User`), Seeders (`RoleSeeder`, `PermissionSeeder`, `RolePermissionSeeder`, `UserSeeder`) | none | IN_PROGRESS |
| M2 | API, Middleware & Auth Payload | `CheckRole` middleware, `RoleController`, `PermissionController`, routes in `routes/api.php`, dynamic `formatUser()` payload | M1 | PLANNED |
| M3 | Frontend State & AdminRolesScreen UI | Refactor `usePermissions.ts`, delete `ROLE_PERMISSIONS`, `AdminRolesScreen.tsx`, API integration, route guards | M2 | PLANNED |
| M4 | Automated Verification & E2E Suite | `DynamicRbacTest.php`, Python E2E dynamic RBAC test & client simulation, full suite regression verification | M1, M2, M3 | PLANNED |
| M5 | Final Review & Forensic Integrity Audit | Multi-perspective code review, challenger verification, forensic integrity audit | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### Super Admin Role & Permission Management API
- `GET /api/v1/roles`:
  - Header: `Authorization: Bearer <token>` (Super Admin only, otherwise 403)
  - Response (200):
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": "uuid",
          "name": "Admin",
          "slug": "ADMIN",
          "description": "Administrator with broad operational access",
          "permissions": ["products:*", "sales:*", "users:manage", "reports:view", "expenses:*", "settings:*"]
        }
      ]
    }
    ```

- `GET /api/v1/permissions`:
  - Header: `Authorization: Bearer <token>` (Super Admin only, otherwise 403)
  - Response (200):
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": "uuid",
          "name": "Manage Users",
          "slug": "users:manage",
          "module": "users",
          "description": "Create, edit, view, and delete staff accounts"
        }
      ]
    }
    ```

- `PUT /api/v1/roles/{id}/permissions`:
  - Header: `Authorization: Bearer <token>` (Super Admin only, otherwise 403)
  - Request:
    ```json
    {
      "permissions": ["products:*", "sales:*", "users:manage"]
    }
    ```
  - Response (200):
    ```json
    {
      "status": "success",
      "message": "Role permissions updated successfully",
      "data": {
        "id": "uuid",
        "name": "Admin",
        "slug": "ADMIN",
        "permissions": ["products:*", "sales:*", "users:manage"]
      }
    }
    ```

### User Auth Payload
- `POST /api/v1/auth/login` and `GET /api/v1/auth/me`:
  - Response (200):
    ```json
    {
      "status": "success",
      "data": {
        "token": "string",
        "user": {
          "id": "uuid",
          "name": "string",
          "email": "string",
          "role": "ADMIN",
          "permissions": ["products:*", "sales:*", "users:manage", "reports:view", "expenses:*", "settings:*"],
          "isActive": true
        }
      }
    }
    ```

## Code Layout
- `backend/database/migrations/2026_08_23_000001_create_dynamic_rbac_tables.php`
- `backend/database/migrations/2026_08_23_000002_add_role_id_to_users_table.php`
- `backend/database/seeders/RoleSeeder.php`
- `backend/database/seeders/PermissionSeeder.php`
- `backend/database/seeders/RolePermissionSeeder.php`
- `backend/database/seeders/DatabaseSeeder.php`
- `backend/app/Models/Role.php`
- `backend/app/Models/Permission.php`
- `backend/app/Models/User.php`
- `backend/app/Http/Middleware/CheckRole.php`
- `backend/app/Http/Controllers/Api/V1/RoleController.php`
- `backend/app/Http/Controllers/Api/V1/PermissionController.php`
- `backend/app/Http/Controllers/Api/V1/AuthController.php`
- `backend/routes/api.php`
- `backend/tests/Feature/DynamicRbacTest.php`
- `frontend/mobile/src/types/index.ts`
- `frontend/mobile/src/api/endpoints.ts`
- `frontend/mobile/src/hooks/usePermissions.ts`
- `frontend/mobile/src/screens/AdminRolesScreen.tsx`
- `frontend/mobile/src/screens/HubScreen.tsx`
- `frontend/mobile/src/screens/AdminUsersScreen.tsx`
- `frontend/mobile/App.tsx`
- `tests/e2e/api_client.py`
- `tests/e2e/tier1_features/test_dynamic_rbac.py`
