# E2E Test Infra: Dynamic Role-Based Access Control (RBAC) System

## Test Philosophy
- Opaque-box, requirement-driven verification.
- Derives directly from `ORIGINAL_REQUEST.md`.
- Multi-tier testing methodology: Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases), Tier 3 (Cross-Feature Combinations), Tier 4 (Real-World Workloads).

## Feature Inventory & Test Mapping
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| 1 | Dynamic Role & Permission Seeding Verification | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 2 | Dynamic Permission Check & SUPER_ADMIN Bypass | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 3 | Super Admin Role & Permission Management API | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 4 | User Dynamic Permissions in Auth Payload | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 5 | Immediate Access Gain/Loss upon API Role Update | ORIGINAL_REQUEST §Acceptance | ✓ | ✓ | ✓ | ✓ |
| 6 | Frontend Dynamic Hook & AdminRolesScreen UI | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 7 | Full Regression (PHPUnit, E2E, Mobile Invariants) | ORIGINAL_REQUEST §Acceptance | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- **Backend PHPUnit Test Suite**: `cd backend && php artisan test` (including `backend/tests/Feature/DynamicRbacTest.php` and `backend/tests/Feature/AuthAndRbacTest.php`).
- **Python E2E Test Runner**: `python tests/e2e/runner.py --all` (including `tests/e2e/tier1_features/test_dynamic_rbac.py` and `tests/e2e/api_client.py`).
- **Mobile Invariant Checks**: `node tests/test_mobile_adversarial.js` & `node tests/test_mobile_empirical.js`.
- **TypeScript Type Checks**: `cd frontend/mobile && npx tsc --noEmit`.

## Coverage Thresholds
- Acceptance Test 1: Automated test proves that when a role's permissions are updated via the API, a user with that role immediately gains or loses access to the affected endpoints.
- Acceptance Test 2: Automated test verifies that existing RBAC tests continue to pass using the new dynamic permission system.
- Application Verification: 100% clean run of the E2E test suite and PHPUnit test suite without regressions.
