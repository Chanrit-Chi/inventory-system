# Code Review: frontend/web vs frontend/mobile — Consolidated Report

> **Date:** 2026-08-30
> **Status:** Complete — 15 findings across 4 severity tiers
> **Reference implementation:** `frontend/mobile` (battle-tested, working)
> **Target for remediation:** `frontend/web`

---

## Executive Summary

This review compares `frontend/web` (Vue 3 + Pinia) against the working reference implementation in `frontend/mobile` (React Native + Expo). The mobile codebase has been battle-tested and represents the desired feature parity. The review identifies **15 distinct issues** across **10 files**, ranked by severity and business impact.

| Severity | Count | Category |
|---|---|---|
| 🔴 Critical | 5 | Data loss, business-logic mismatch, silent failures |
| 🟠 High | 3 | Missing core features, poor UX patterns |
| 🟡 Medium | 3 | Missing visibility, perf issues, race conditions |
| 🟢 Low | 4 | Refactor, code quality, type safety |

---

## Reference Comparison Matrix

| Capability | frontend/mobile | frontend/web | Status |
|---|---|---|---|
| Loyalty tier resolution | Dual-criteria (spent OR orders) at 200/500/1000 | Single-criterion (spent only) at 100/250/500 | ❌ Mismatch |
| Order status badge | Handles all 8 statuses (COMPLETED, PAID, PENDING, DRAFT, PROCESSING, SENT, CANCELLED, REJECTED) | OrdersView handles 4; DashboardView handles 8 | ❌ Inconsistent |
| Product type (SIMPLE/VARIABLE) | `validation.ts:194` enum + form field | Not present | ❌ Missing |
| Initial stock on product creation | ✅ Supported | ❌ Missing | ❌ Missing |
| Product photo upload | Camera/gallery file picker | `image_url` text input only | ❌ Missing |
| Barcode scanner | `useHardwareBarcodeScanner` + `CameraScannerModal` | Keyboard wedge + `window.prompt()` | ⚠️ Partial |
| Offline order queue | `useOfflineQueue` with localStorage persistence | ❌ None | ❌ Missing |
| API client timeout | 30s timeout configured | ❌ No timeout | ❌ Missing |
| 401 → logout redirect | Event emitter + auto-redirect | Token cleared, no notification | ❌ Missing |
| Stock visibility in catalog | Per-variant stock pill on product cards | Not shown in ProductListView | ❌ Missing |
| Multi-step checkout | Channel → Zone → Bank pickers | Single-step PosCheckoutModal | ⚠️ Partial |
| Dashboard data fetching | Parallel `Promise.all` | Sequential `await` | ❌ Perf |
| Auth guard caching | Init once at startup | Re-init on every navigation | ❌ Race risk |
| Variant picker modal | Dedicated `VariantPickerModal` component | Inline branching in handler | ⚠️ Minimal |
| API client testability | Injectable token getter | Direct `localStorage` access | ⚠️ Coupled |

---

## Detailed Findings

### 🔴 CRITICAL #1 — Loyalty Tier Thresholds Inconsistency

**File:** `frontend/web/src/views/CustomersView.vue:44-50`

**Mobile reference:** `frontend/mobile/src/hooks/useCustomerLookup.ts:21-33`

```javascript
// frontend/web (BUG)
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 100,
  GOLD: 250,
  PLATINUM: 500,
}
```

```javascript
// frontend/mobile (CORRECT)
if (spent >= 1000 || orders >= 20) tier = 'Platinum'
else if (spent >= 500  || orders >= 10) tier = 'Gold'
else if (spent >= 200  || orders >= 3)  tier = 'Silver'
// else Bronze
```

**Failure scenario:** A customer who spent ฿300 with 1 order will be classified as **GOLD on web** (≥250) but **SILVER on mobile** (<500). They receive different discount rates, perks, and badge styling on the two clients.

**Fix:** Create a shared utility `frontend/web/src/utils/loyalty.ts`

```typescript
// frontend/web/src/utils/loyalty.ts
export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

const THRESHOLDS = {
  SILVER:   { spent: 200,  orders: 3 },
  GOLD:     { spent: 500,  orders: 10 },
  PLATINUM: { spent: 1000, orders: 20 },
}

export function getTier(spent: number, orders: number): Tier {
  if (spent >= 1000 || orders >= 20) return 'PLATINUM'
  if (spent >= 500  || orders >= 10) return 'GOLD'
  if (spent >= 200  || orders >= 3)  return 'SILVER'
  return 'BRONZE'
}
```

Update `CustomersView.vue` to import and use `getTier(totalSpent, totalOrders)` instead of the inline `TIER_THRESHOLDS` comparison. Also update the `vipCount` computed property if it relies on tier thresholds.

---

### 🔴 CRITICAL #2 — POSView Has No Offline Queue

**File:** `frontend/web/src/views/POSView.vue:367-458` (`handleCompleteCheckout`)

**Mobile reference:** `frontend/mobile/src/hooks/useOfflineQueue.ts` (full hook with localStorage persistence, auto-retry, idempotency keys)

```typescript
// frontend/web/POSView (current — order lost on network failure)
const res = await api.post<any>('/orders/checkout', payload)
```

```typescript
// frontend/mobile (correct — auto-queued on failure)
const { enqueueMutation } = useOfflineQueue()
try {
  await api.post('/orders/checkout', payload)
} catch (err) {
  enqueueMutation({
    type: 'ORDER_CHECKOUT',
    payload,
    mutationId: crypto.randomUUID(),
  })
  toast.info('Order saved offline — will sync when reconnected')
}
```

**Failure scenario:** Cashier completes a sale while network briefly drops → entire order is lost with no retry or queue, requiring the customer to re-order. Mobile silently saves to local storage and replays on reconnect.

**Fix:** Port the `useOfflineQueue` hook (or extract a shared version into `packages/shared/`) and wire it into `handleCompleteCheckout` in POSView. Key implementation details:

1. Create `frontend/web/src/hooks/useOfflineQueue.ts`:
   ```typescript
   const QUEUE_STORAGE_KEY = '@inventory_offline_queue'

   export function useOfflineQueue() {
     function getQueue(): OfflineMutation[] {
       try {
         return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
       } catch { return [] }
     }

     function enqueueMutation(mutation: OfflineMutation) {
       const queue = getQueue()
       queue.push({ ...mutation, id: crypto.randomUUID(), createdAt: Date.now() })
       localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
     }

     async function replayQueue(onProgress?: (id: string) => void) {
       const queue = getQueue()
       for (const m of queue) {
         try {
           await api.post(m.endpoint, m.payload)
           // remove from queue on success
           const updated = getQueue().filter(x => x.id !== m.id)
           localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated))
           onProgress?.(m.id)
         } catch {
           // keep in queue, will retry later
           break // stop replay on first failure
         }
       }
     }

     return { enqueueMutation, replayQueue }
   }
   ```

2. Wrap the checkout call:
   ```typescript
   const offlineQueue = useOfflineQueue()
   try {
     const res = await api.post<any>('/orders/checkout', payload)
     // clear any queued orders on success
     await offlineQueue.replayQueue()
   } catch (err) {
     offlineQueue.enqueueMutation({
       type: 'ORDER_CHECKOUT',
       endpoint: '/orders/checkout',
       payload,
     })
     toast.warning('Order saved offline — will sync when reconnected')
   }
   ```

---

### 🔴 CRITICAL #3 — OrdersView Missing 4 Status Mappings

**File:** `frontend/web/src/views/OrdersView.vue:144-151`

```javascript
// frontend/web OrdersView (BUG — 4 statuses)
function statusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED')  return { variant: 'success',      label: 'Completed' }
  if (s === 'PENDING')    return { variant: 'warning',      label: 'Pending' }
  if (s === 'PROCESSING') return { variant: 'info',         label: 'Processing' }
  if (s === 'CANCELLED')  return { variant: 'destructive',  label: 'Cancelled' }
  return { variant: 'neutral', label: status }
}
```

```javascript
// frontend/web DashboardView (CORRECT — 8 statuses)
if (s === 'COMPLETED'  || s === 'PAID')      return { variant: 'success',     label: 'Completed' }
if (s === 'PROCESSING' || s === 'SENT')      return { variant: 'info',        label: 'Processing' }
if (s === 'PENDING'    || s === 'DRAFT')     return { variant: 'warning',     label: 'Pending' }
if (s === 'CANCELLED'  || s === 'REJECTED') return { variant: 'destructive', label: 'Cancelled' }
```

**Failure scenario:** An order with `status='PAID'` will render as a raw, unstyled gray "PAID" string in the Orders list but as a green "Completed" badge on the Dashboard. Inconsistent UX, broken color semantics.

**Fix:** Extract to `frontend/web/src/utils/orderStatus.ts`:

```typescript
// frontend/web/src/utils/orderStatus.ts
export type OrderStatusBadge = {
  variant: 'success' | 'info' | 'warning' | 'destructive' | 'neutral'
  label: string
}

export function getOrderStatusBadge(status: string): OrderStatusBadge {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED' || s === 'PAID')      return { variant: 'success',     label: 'Completed' }
  if (s === 'PROCESSING' || s === 'SENT')     return { variant: 'info',        label: 'Processing' }
  if (s === 'PENDING'   || s === 'DRAFT')     return { variant: 'warning',     label: 'Pending' }
  if (s === 'CANCELLED' || s === 'REJECTED') return { variant: 'destructive', label: 'Cancelled' }
  return { variant: 'neutral', label: status }
}
```

Replace the inline `statusBadge()` function in both `OrdersView.vue` and `DashboardView.vue` with:

```typescript
import { getOrderStatusBadge } from '@/utils/orderStatus'
// in template: :variant="getOrderStatusBadge(order.status).variant"
```

---

### 🔴 CRITICAL #4 — API Client Lacks Timeout

**File:** `frontend/web/src/api/axios.ts`

The axios instance has no `timeout` configured. A hung request stays as a spinner indefinitely with no retry option. User must refresh the page.

**Fix:**

```typescript
// frontend/web/src/api/axios.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30_000, // 30 seconds
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      // Surface "Request timed out" to the user via toast
    }
    if (!err.response) {
      // Network error — no response received
    }
    return Promise.reject(err)
  }
)
```

---

### 🔴 CRITICAL #5 — 401 Clears Token Without UI Notification

**File:** `frontend/web/src/api/axios.ts` (response interceptor)

The 401 handler clears the token but does not notify the UI. Users keep adding items to cart then get a silent checkout failure with no redirect to login.

**Fix:**

```typescript
// frontend/web/src/api/axios.ts
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const auth = useAuthStore()
      auth.handleSessionExpired() // sets isAuthenticated=false, clears token
      const toast = useToast()
      toast.warning('Your session has expired. Please log in again.')
      // Router push handled by authStore listener
    }
    return Promise.reject(err)
  }
)
```

---

### 🟠 HIGH #6 — ProductCreateView Missing Core Fields

**File:** `frontend/web/src/views/ProductCreateView.vue:44-53`

**Mobile reference:** `frontend/mobile/src/utils/validation.ts:194` defines `productType: z.enum(['SIMPLE', 'VARIABLE'])`. Mobile also has photo upload + initial stock fields.

```typescript
// frontend/web (BUG — limited form)
const form = ref({
  name: '',
  barcode: '',
  purchase_price: '',
  selling_price: '',
  default_reorder_level: '5',
  image_url: '',       // ← text input only
  description: '',
  is_active: true,
})
```

**Missing fields:** `product_type` (SIMPLE/VARIABLE), `initial_stock` (opening inventory), `image_file` (file upload instead of URL).

**Failure scenario:** Staff must create the product first, then go back to the product detail page to set initial stock and upload a photo — a clunky 3-step process instead of one wizard. Variable products cannot be created because there is no SIMPLE/VARIABLE gate to reveal the variant step.

**Fix:** Add to the form in ProductCreateView:

```typescript
const form = ref({
  product_type: 'SIMPLE' as 'SIMPLE' | 'VARIABLE',
  name: '',
  barcode: '',
  purchase_price: '',
  selling_price: '',
  initial_stock: 0,           // ← NEW
  default_reorder_level: '5',
  image_file: null as File | null, // ← NEW (replaces image_url for upload)
  description: '',
  is_active: true,
})
```

- Use a `<FileUpload>` component or `<input type="file">` for `image_file`
- Gate the Variant Options step on `product_type === 'VARIABLE'`
- On submit, use `FormData` to send `image_file` as multipart alongside other fields
- Add `product_type` field to the API payload sent to the backend

---

### 🟠 HIGH #7 — POSView Uses `window.prompt()` for Barcode Input

**File:** `frontend/web/src/views/POSView.vue:255-260`, `:534-536`

**Mobile reference:** `frontend/mobile/src/components/CameraScannerModal.tsx` (continuous scan UI), `frontend/mobile/src/hooks/useHardwareBarcodeScanner.ts` (USB scanner buffer)

```typescript
// frontend/web (clunky)
function handleOpenScannerPrompt() {
  const code = window.prompt('Enter / Scan Barcode (F2):')
  if (code) processBarcode(code)
}
```

```typescript
// F2 hotkey also uses native prompt
if (e.key === 'F2') {
  const code = prompt('Enter Barcode or Scan Item:') // ← blocks the page
  if (code) processBarcode(code)
}
```

**Failure scenario:** Staff must type barcodes manually or use a keyboard wedge. The native `prompt()` blocks the page, has no validation, and provides no UX feedback. Typo rate is high during a rush.

**Fix:** Replace `window.prompt` with an in-app barcode input field modal:

```vue
<Dialog v-model:open="showScannerInput">
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Scan Barcode</DialogTitle>
    </DialogHeader>
    <Input
      v-model="barcodeInput"
      ref="barcodeInputRef"
      placeholder="Type or scan barcode…"
      autofocus
      @keydown.enter="handleManualBarcodeSubmit"
    />
    <DialogFooter>
      <Button variant="outline" @click="showScannerInput = false">Cancel</Button>
      <Button @click="handleManualBarcodeSubmit">Add to Cart</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

The hardware wedge (USB scanner) buffer at POSView line ~561-581 should stay as-is — that keyboard-wedge detection path works correctly and should not be changed.

---

### 🟠 HIGH #8 — StatusBadge Return Type Drift

**File:** `frontend/web/src/views/OrdersView.vue:144`

`statusBadge()` returns `{ variant, label }` (object). Some templates may expect a class string. Type errors and `[object Object]` rendering in class bindings are easy to introduce.

**Fix:** Declare the return type explicitly and centralize (see #3 fix above — the `getOrderStatusBadge` utility handles this).

---

### 🟡 MEDIUM #9 — ProductListView Missing Stock Column

**File:** `frontend/web/src/views/ProductListView.vue:306-403` (table) and `:407-479` (grid)

The table shows: Image, Product Name, Barcode, Variants, Cost Price, Selling Price, Active, Actions. **No stock levels anywhere.** Same for the grid view.

**Failure scenario:** A manager scanning the catalog cannot tell which products are low or out of stock without clicking into each product individually. Slows purchasing and replenishment decisions.

**Fix:** Add a `Stock` column to the table and a stock indicator to the card grid.

Table addition — add column after Variants:

```vue
<TableHead>Stock</TableHead>
```

```vue
<TableCell>
  <span :class="getStockClass(totalStock(p))">
    {{ totalStock(p) }}
  </span>
</TableCell>
```

Grid card addition — add stock indicator below the description:

```vue
<div class="text-xs mt-1" :class="getStockClass(totalStock(p))">
  {{ totalStock(p) }} units
</div>
```

Helper functions (add to `<script setup>`):

```typescript
function totalStock(p: Product): number {
  return (p.variants || []).reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
}

function getStockClass(stock: number, reorderLevel = 5): string {
  if (stock <= 0) return 'text-red-600 font-semibold'
  if (stock <= reorderLevel) return 'text-amber-600 font-semibold'
  return 'text-emerald-600'
}
```

---

### 🟡 MEDIUM #10 — Dashboard Sequential API Calls

**File:** `frontend/web/src/views/DashboardView.vue:283-317`

Three independent `await` calls run serially. Total wait = sum of latencies. Should be parallel.

**Fix:**

```typescript
const [summary, orders, lowStock] = await Promise.all([
  fetchDashboardSummary(),
  fetchRecentOrders(per_page=20),
  fetchLowStockProducts(),
])
```

Also consider trimming `per_page` for low-stock preview to fetch only what's needed (4 items max) — see efficiency review.

---

### 🟡 MEDIUM #11 — Router Auth Guard Init Race

**File:** `frontend/web/src/router/index.ts:64-69`

`useAuthStore().initAuth()` is called on every navigation guard call. This re-reads `localStorage` on every protected route navigation, even when the token is null.

**Fix:**

```typescript
// frontend/web/src/stores/authStore.ts
async function initAuth() {
  if (initialized.value) return // cache the result
  // ... existing init logic
  initialized.value = true
}
```

`main.ts` already calls `initAuth()` once at startup. The guard call is redundant in the common authenticated case.

---

### 🟢 LOW #12 — `statusBadge()` Called Twice Per Row in Template

**File:** `frontend/web/src/views/DashboardView.vue` (template)

The template calls `statusBadge(order.status)` twice — once for the variant and once for the label. Recomputed on every render.

**Fix:** Precompute badges or extract a helper that returns the object reference per status. Option:

```typescript
const ordersWithBadges = computed(() =>
  orders.value.map(o => ({ ...o, _badge: getOrderStatusBadge(o.status) }))
)
```

Then in template use `o._badge.variant` and `o._badge.label`.

---

### 🟢 LOW #13 — Direct `localStorage` Access in API Client

**File:** `frontend/web/src/api/axios.ts`

Direct `localStorage.getItem('auth_token')` couples the client to browser storage and prevents testing in non-browser environments.

**Fix:** Inject a token getter:

```typescript
// frontend/web/src/api/tokenStore.ts
let _getter: () => string | null = () => localStorage.getItem('auth_token')
let _setter: (val: string | null) => void = (val) => {
  if (val) localStorage.setItem('auth_token', val)
  else localStorage.removeItem('auth_token')
}

export const tokenStore = {
  get: () => _getter(),
  set: (val: string | null) => _setter(val),
  configure: (getter: () => string | null, setter: (val: string | null) => void) => {
    _getter = getter
    _setter = setter
  },
}
```

Then `axios.ts` calls `tokenStore.get()` and tests can inject a mock.

---

### 🟢 LOW #14 — POSView Single-Step Checkout vs Mobile Multi-Step

**File:** `frontend/web/src/components/pos/PosCheckoutModal.vue` (referenced from POSView)

Mobile uses multi-step checkout: Channel → Zone → Bank. Web's single-step `PosCheckoutModal` covers most cases but lacks the guided flow.

**Note:** This is largely a UX preference. The current single-step is acceptable if it covers all required options (channel, zone, bank, payment). Verify field coverage; otherwise split into steps.

---

### 🟢 LOW #15 — POSView No SIMPLE/VARIABLE Product Type Distinction

**File:** `frontend/web/src/views/POSView.vue:262-279` (`handleProductClick`)

```typescript
// current — minimal branching
if (variants.length > 1) {
  showVariantModal.value = true
} else {
  // add single variant
}
```

Adequate for basic flow but does not distinguish "this product is intentionally SIMPLE (one variant)" vs "this is a VARIABLE with one variant selected." A dedicated `VariantPickerModal` (mobile has it as a separate component) would clarify intent and allow richer presentation.

**Fix:** Use the existing `PosVariantModal` component consistently. When adding a product, check `productType` to determine variant handling logic.

---

## Recommended Implementation Plan

| Step | Item | Effort | Impact |
|---|---|---|---|
| 1 | Port `useOfflineQueue` to web; wire into `handleCompleteCheckout` | High | 🔴 Critical |
| 2 | Add API timeout + 401 redirect interceptor | Low | 🔴 Critical |
| 3 | Extract `getOrderStatusBadge` to shared utility; fix OrdersView | Low | 🔴 Critical |
| 4 | Align loyalty tier thresholds with mobile | Low | 🔴 Critical |
| 5 | Add product_type, initial_stock, file upload to ProductCreateView | High | 🟠 High |
| 6 | Replace `window.prompt` with in-app barcode modal | Medium | 🟠 High |
| 7 | Add stock column to ProductListView | Low | 🟡 Medium |
| 8 | Parallelize Dashboard fetches with `Promise.all` | Low | 🟡 Medium |
| 9 | Cache auth init in router guard | Low | 🟡 Medium |
| 10 | Document `statusBadge` return type | Low | 🟢 Low |
| 11 | Injectable token getter in API client | Low | 🟢 Low |
| 12 | Pre-compute status badges in Dashboard | Low | 🟢 Low |

---

## Top Priority Risks

1. **#2 Offline Queue Missing** — Orders silently lost during network drops. Highest data-loss risk.
2. **#4 API Timeout Missing** — UI hangs forever on network issues.
3. **#5 401 Silent Failure** — User keeps working with expired session, then fails silently.
4. **#1 Loyalty Tier Mismatch** — Same customer gets different tiers on web vs mobile.
5. **#3 Order Status Inconsistency** — Different badge logic between Dashboard and Orders view.

These five should be addressed before the next release window.
