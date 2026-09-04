# Project: Mobile Push Notification System

## Architecture
- **Backend**: Laravel 11/12 (PHP 8.4), Laravel Sanctum authentication, Eloquent ORM with UUIDs, SQLite in-memory test environment.
- **Mobile**: Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9, Axios API client, `expo-notifications`, `expo-device`, `ToastContext`.
- **Push Service**: Expo Push HTTP/2 Gateway (`https://exp.host/--/api/v2/push/send`) with 100-item chunking, ticket parsing, and automated token pruning on `DeviceNotRegistered`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `push_tokens` Table Migration | Migration `2026_09_04_140000_create_push_tokens_table.php` with UUID `id`, `user_id` foreign key cascade, unique `token`, `device_name`/`device_type`, `platform` | M1 | Survey (Backend Explorer & Spec Miner) |
| 2 | `PushToken` Model & `User` Relationship | Eloquent `PushToken` model with `user(): BelongsTo` and `User::pushTokens(): HasMany` relation | M1 | Survey (Backend Explorer & Spec Miner) |
| 3 | Push Token Registration Endpoint | `POST /api/v1/push-tokens` under `auth:sanctum`. Upserts token and transfers token to authenticated user if previously registered to another user | M1 | Survey (Backend Explorer & Spec Miner) |
| 4 | Push Token Deregistration Endpoint | `DELETE /api/v1/push-tokens/{token}` under `auth:sanctum`. Removes push token on logout (idempotent, supports URL-encoded token strings) | M1 | Survey (Backend Explorer & Spec Miner) |
| 5 | `PushNotificationService` Dispatch Engine | Core service sending chunked HTTP POST batches (up to 100 items) to `https://exp.host/--/api/v2/push/send` via Laravel `Http` facade | M1 | Survey (Backend Explorer & Spec Miner) |
| 6 | Role-Aware Dispatch Filtering | Role-based notification rules: Low stock (ADMIN, MANAGER, SELLER), Restock completed (ADMIN, MANAGER), Order completed (ADMIN, MANAGER, and matching SELLER only), Invoice overdue (ADMIN, MANAGER, SELLER), Security events (ADMIN only) | M1 | Survey (Backend Explorer & Spec Miner) |
| 7 | Dead Token Automatic Pruning | When Expo ticket response contains `status: error` with `DeviceNotRegistered`, immediately delete token from `push_tokens` table | M1 | Survey (Backend Explorer & Spec Miner) |
| 8 | Backend Push Notification Feature Tests | Comprehensive PHPUnit feature test suite in `tests/Feature/PushNotificationTest.php` covering CRUD, reassignment, role filtering, chunking, and fake Expo responses | M1 | Survey (Backend Explorer & Spec Miner) |
| 9 | Mobile `usePushNotifications` Hook | React Native hook managing notification permission, Android channel, Expo push token retrieval with EAS project ID, non-device guard, backend sync, and logout cleanup | M2 | Survey (Mobile Explorer & Spec Miner) |
| 10 | Mobile `NotificationHandler` Component | Foreground notification interceptor suppressing native OS alert banner (`shouldShowAlert: false`) and routing incoming push messages to `ToastContext.showToast()` | M2 | Survey (Mobile Explorer & Spec Miner) |
| 11 | Mobile App Provider Tree Mounting | Cleanly mount `<NotificationHandler />` inside `<ToastProvider>` in `frontend/mobile/App.tsx` with access to both `useToast` and `useAuth` | M2 | Survey (Mobile Explorer & Spec Miner) |
| 12 | Mobile TypeScript & Test Verification | Verification that mobile codebase passes `npx tsc --noEmit` with 0 errors and `npm test` passes all suites | M2 | Survey (Mobile Explorer & Spec Miner) |
| 13 | End-to-End Verification & Forensic Audit | Verification across backend PHPUnit and mobile typecheck/tests, forensic integrity audit, and victory report | M3 | Survey (Orchestrator) |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Push Token Storage & Dispatch Service | Migration, `PushToken` model, `User::pushTokens()`, `PushTokenController`, `PushNotificationService` with role matrix, and PHPUnit feature tests | none | DONE |
| M2 | Mobile Push Registration & In-App Notification Handling | `usePushNotifications` hook, `NotificationHandler` component, `App.tsx` mount, and TypeScript check | M1 | IN_PROGRESS |
| M3 | End-to-End Verification, Forensic Audit & Victory Claim | Comprehensive integration tests, full verification, forensic integrity audit | M1, M2 | PLANNED |

---

## Interface Contracts

### 1. Backend API Contracts (`POST /api/v1/push-tokens` & `DELETE /api/v1/push-tokens/{token}`)
- **POST `/api/v1/push-tokens`**:
  - Middleware: `auth:sanctum`
  - Body:
    ```json
    {
      "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      "device_name": "iPhone 15 Pro",
      "platform": "ios"
    }
    ```
  - Behavior: Uses `PushToken::updateOrCreate(['token' => $token], ['user_id' => $user->id, 'device_name' => $deviceName, 'platform' => $platform])`. Automatically transfers token if already bound to another user.
  - Response (HTTP 200/201):
    ```json
    {
      "success": true,
      "data": {
        "id": "uuid",
        "user_id": "uuid",
        "token": "ExponentPushToken[...]",
        "device_name": "...",
        "platform": "..."
      },
      "message": "Push token registered successfully."
    }
    ```

- **DELETE `/api/v1/push-tokens/{token}`**:
  - Middleware: `auth:sanctum`
  - Route param: `{token}` (raw or URL-encoded, regex `.*`)
  - Behavior: `PushToken::where('token', urldecode($token))->where('user_id', $user->id)->delete();` (or deletes matching token). Idempotent.
  - Response (HTTP 200):
    ```json
    {
      "success": true,
      "data": null,
      "message": "Push token deregistered successfully."
    }
    ```

### 2. `PushNotificationService` Contract
- `sendPush(array $tokens, array $payload): array`
  - Batching: `array_chunk($tokens, 100)`
  - Endpoint: `POST https://exp.host/--/api/v2/push/send`
  - Pruning: On `ticket.status === 'error'` and `ticket.details.error === 'DeviceNotRegistered'`, delete matching token.
  - Return: `['sent' => int, 'failed' => int, 'purged' => array]`
- Event dispatchers:
  - `notifyLowStock($variant)` -> dispatches to `['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER']`
  - `notifyRestockCompleted($session)` -> dispatches to `['SUPER_ADMIN', 'ADMIN', 'MANAGER']` (SELLER excluded)
  - `notifyOrderCompleted($order)` -> dispatches to `['SUPER_ADMIN', 'ADMIN', 'MANAGER']` and matching SELLER only (`order.user_id === seller.id` or `order.seller_id === seller.id`)
  - `notifyInvoiceOverdue($invoice)` -> dispatches to `['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER']`
  - `notifySecurityEvent($auditLog)` -> dispatches to `['SUPER_ADMIN', 'ADMIN']` only

### 3. Mobile Hook Contract (`usePushNotifications`)
- Signature:
  ```typescript
  export function usePushNotifications(): {
    expoPushToken: string | null
    permissionStatus: Notifications.PermissionStatus | 'undetermined'
    isRegistered: boolean
    registerDevice: () => Promise<string | null>
  }
  ```
- Lifecycle:
  - Checks `Device.isDevice`. If false, returns null and does not call native push APIs.
  - Sets up Android channel `default` on Android 8.0+.
  - Requests permissions. If granted, retrieves Expo push token with EAS project ID.
  - Automatically syncs token with `POST /api/v1/push-tokens` when user is authenticated.
  - Deregisters token via `DELETE /api/v1/push-tokens/{token}` on logout.

### 4. Mobile Component Contract (`NotificationHandler`)
- Foreground suppression:
  ```typescript
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
  ```
- Listener: Listens via `Notifications.addNotificationReceivedListener` and maps:
  - `low_stock` -> `'warning'`
  - `restock` -> `'info'`
  - `order` -> `'success'`
  - `invoice` -> `'warning'`
  - `audit` -> `'error'`
  - Fallback -> `'info'`
  Calls `useToast().showToast(message, type)`.

---

## Code Layout
- `backend/database/migrations/2026_09_04_140000_create_push_tokens_table.php`: Migration for `push_tokens` table
- `backend/app/Models/PushToken.php`: Eloquent model for push tokens
- `backend/app/Models/User.php`: Extended with `pushTokens(): HasMany`
- `backend/app/Http/Controllers/Api/V1/PushTokenController.php`: API controller for token registration and deregistration
- `backend/app/Services/PushNotificationService.php`: Push notification dispatch and filtering service
- `backend/routes/api.php`: Route registrations under `v1` and `auth:sanctum`
- `backend/tests/Feature/PushNotificationTest.php`: Feature tests for push notifications and token management
- `frontend/mobile/src/hooks/usePushNotifications.ts`: Custom hook for token acquisition and backend registration
- `frontend/mobile/src/components/NotificationHandler.tsx`: Component for foreground suppression and in-app toast routing
- `frontend/mobile/App.tsx`: Mounts `<NotificationHandler />` inside `<ToastProvider>`
- `frontend/mobile/src/api/endpoints.ts`: Optional API helper functions for push token registration
