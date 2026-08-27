# Original User Request

## Initial Request — 2026-08-23T07:23:08Z

Implement a dynamic Role-Based Access Control (RBAC) system so that Super Admins can configure the specific permissions assigned to each role via a UI, replacing the current hardcoded permission mappings.

Working directory: d:/GitCode/inventory-system
Integrity mode: development

## Requirements

### R1. Database & Seeding
Create a `permissions` table, a `roles` table, and a `permission_role` pivot table. Update the `users` table to reference `roles.id` instead of a string enum, migrating existing user data. Seed the database with the default roles (SUPER_ADMIN, ADMIN, MANAGER, SELLER) and their default capabilities (`products:*`, `users:manage`, etc.).

### R2. API & Middleware
Update the `CheckRole` middleware to check against dynamic permissions (`hasPermission`) instead of hardcoded role names (but keep a bypass for SUPER_ADMIN). Add API endpoints for Super Admins to list roles and update their attached permissions. Update the auth login and `/me` endpoints to return the user's specific array of permissions in the JSON payload.

### R3. Frontend State & UI
Update `usePermissions.ts` in the frontend (mobile/web) to check permissions against the dynamically returned array from the backend, deleting the hardcoded `ROLE_PERMISSIONS`. Build an `AdminRolesScreen` UI accessible only to Super Admins that lists roles and allows toggling their specific permissions.

## Acceptance Criteria

### Automated Verification
- [ ] An automated test proves that when a role's permissions are updated via the API, a user with that role immediately gains or loses access to the affected endpoints.
- [ ] An automated test verifies that existing RBAC tests (e.g., in `Tests\Feature\AuthAndRbacTest`) continue to pass using the new dynamic permission system.

### Application Verification
- [ ] A clean run of the E2E test suite confirms the authentication and authorization flows work end-to-end without regressions.
- [ ] A clean run of the PHPUnit test suite confirms backend integrity.
