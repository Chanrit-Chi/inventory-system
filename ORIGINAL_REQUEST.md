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

## Request — 2026-08-30T10:05:11Z

Redesign the OmniPOS web frontend in `frontend/web` to elevate it from AI-generated UI slop into a high-craft, professional retail POS and inventory management interface adhering strictly to the brand identity (`#FAF7F2`/`#F8F5F0` warm cream base, `#924C00` deep amber primary, `#FF8800` vibrant orange CTA, `#1A1C1C` deep charcoal text, Space Grotesk typography).

Working directory: d:/GitCode/inventory-system/frontend/web
Integrity mode: demo

## Requirements

### R1. Brand-Aligned Token Architecture & Clean Styling
Establish a streamlined Tailwind CSS v4 design token layer based on the official brand specification:
- Background: Warm cream (`#FAF7F2` / `#F8F5F0`), elevated surfaces (`#FFFFFF`), subtle amber-tinted borders (`#E8E2D9`).
- Brand & Actions: Deep amber (`#924C00`) and vibrant retail orange (`#FF8800`), with accessible contrast ratios.
- Typography: Space Grotesk / Inter with a strict, readable type hierarchy and proper line-heights.
- Eliminate monolithic bloated CSS overrides in favor of composable Tailwind v4 utility tokens and Radix Vue / shadcn patterns.

### R2. Core App Shell & Navigation Redesign
Overhaul the top navigation bar, collapsible sidebar, global Ctrl+K command palette, notifications, and user/channel selectors with clean visual hierarchy, modern tactile micro-interactions, active states, and responsive layout handling.

### R3. High-Density POS Terminal & Catalog Overhaul
Redesign the POS view (`POSView.vue`) into a fast, tactile, and intuitive dual-zone layout (product catalog / grid on the left, persistent transaction cart and checkout panel on the right) with clear price displays, modifier handling, quick item counters, and keyboard shortcuts.

### R4. Dashboard & Operational Views Modernization
Modernize the Dashboard, Product List/Create/Edit, Orders, Customers, Inventory Ledger, and Settings views:
- Clean, high-readability data tables with sorting, filtering, and responsive states.
- Polished metric cards with contextual trend indicators.
- Standardized form inputs, select menus, toggle switches, and dialog modals with clear focus rings and validation states.

### R5. Interactive Feedback & State Polish
Provide consistent skeleton loading screens, intuitive empty states with call-to-actions, toast notifications, error recovery states, and smooth 60fps micro-animations.

## Acceptance Criteria

### Brand & Visual Fidelity
- [ ] Strict adherence to the warm cream (`#F8F5F0`), deep amber (`#924C00`), and vibrant orange (`#FF8800`) brand palette.
- [ ] All text passes WCAG AA contrast standards on their respective surface backgrounds.
- [ ] Visual polish across spacing, elevation, border-radii, and typography hierarchy without visual clutter or awkward misalignments.

### Technical & Component Quality
- [ ] `npm run build` (`vue-tsc -b && vite build`) passes with 0 errors and 0 type issues.
- [ ] Vue 3 script setup, Pinia stores, and Vue Query integration remain fully intact and operational.
- [ ] Radix Vue primitives and Lucide icons are used consistently for interactive controls.

### Functional Integrity
- [ ] POS checkout flow, search palette (Ctrl+K), product management, customer CRUD, order management, and settings save actions work seamlessly without regression.

## Request — 2026-08-30T10:54:36Z

Continue the OmniPOS frontend web UI redesign in `frontend/web` directly from the existing `PROJECT.md` specification.

Status & Context:
- Working directory: d:/GitCode/inventory-system/frontend/web
- Milestones 1, 2, and 3 are COMPLETED and VERIFIED (Token architecture, Radix UI primitives, App Shell & Command Palette, and High-Density POS Terminal with posStore).
- Proceed directly with Milestone 4 (Dashboard & Operational Views Modernization) across the 26 views (Dashboard, Product Catalog/Create/Edit, Orders, Customers, Inventory Ledger, Expenses, Settings, etc.) and Milestone 5 (Interactive Feedback, State Polish & Production Build Verification).
- Maintain brand specifications: Warm Cream (#FAF7F2/#F8F5F0), Deep Amber (#924C00), Vibrant Orange CTA (#FF8800), Charcoal text (#1A1C1C), Space Grotesk / Inter typography.
- Ensure `npm run build` (`vue-tsc -b && vite build`) succeeds with 0 errors.


