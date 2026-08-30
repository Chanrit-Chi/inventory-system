# Project: OmniPOS Web Frontend Redesign

## Architecture
- **Framework**: Vue 3.5 (Composition API `<script setup>`), TypeScript 5.7, Vite 8.2
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), CSS variable-driven design tokens, Radix Vue 1.9 primitives, Lucide icons
- **State & Data**: Pinia stores for client domain state (`posStore`, `authStore`, `productStore`, etc.), Axios client (`src/api/axios.ts`) with Bearer token authentication
- **Design Identity**:
  * Background Base: Warm Cream (`#FAF7F2` / `#F8F5F0`)
  * Elevated Surfaces: Crisp White (`#FFFFFF`)
  * Borders: Amber-tinted Border (`#E8E2D9`)
  * Brand Primary: Deep Amber (`#924C00`)
  * Retail Accent / CTA: Vibrant Orange (`#FF8800`)
  * Text & Typography: Charcoal (`#1A1C1C` / `#1D1B16`), Space Grotesk (headings/display) & Inter (UI/body) & Fira Code (monospaced figures)

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Brand Token Layer | Tailwind v4 `@theme` configuration with warm cream, deep amber, vibrant orange, border tokens, and font families in `src/style.css` | M1 | Survey (Explorer 1) |
| 2 | Shared Radix UI Primitives | Expand `src/components/ui/` (Button, Card, Input, Select, Dialog, Modal, Tabs, Switch, Badge, Table, Skeleton, EmptyState, Toast, StatCard) | M1 | Survey (Explorer 1 & 3) |
| 3 | Core TypeScript Type Fixes | Fix TS errors in `useCustomerLookup.ts`, `QuotationsView.vue`, `ProductCreateView.vue`, `PayrollView.vue`, and POS components to restore build baseline | M1 | Survey (Explorer 1 & 3) |
| 4 | App Shell Layout Overhaul | Clean topbar and collapsible sidebar navigation supporting all 26 routes with active indicators, badges, and collapse state | M2 | Survey (Explorer 2) |
| 5 | Global Ctrl+K Command Palette | Multi-domain search dialog with instant navigation, action shortcuts, and keyboard accessibility | M2 | Survey (Explorer 2) |
| 6 | Navigation & Header Controls | Channel switcher, store selector, notification panel, user profile menu, breadcrumb navigation | M2 | Survey (Explorer 2) |
| 7 | Persistent POS Pinia Store | Implement `src/stores/posStore.ts` with multi-cart tabs (hold/resume), line discounts, customer binding, and localStorage persistence | M3 | Survey (Explorer 2) |
| 8 | High-Density Catalog Grid | Redesign left catalog zone in `POSView.vue` with category chips, debounced search, barcode scanner integration, and variant selection modal | M3 | Survey (Explorer 2) |
| 9 | Tactile Cart & Transaction Panel | Persistent right transaction cart with price totals, line discounts, quantity steppers, item removal, customer pill, and clear CTA | M3 | Survey (Explorer 2) |
| 10 | Quick Cash & Checkout Modal | Redesign `PosCheckoutModal.vue` with 1-click cash pills ($10, $20, $50, $100, Exact), multi-tender, and thermal receipt simulation | M3 | Survey (Explorer 2) |
| 11 | Dashboard View Modernization | High-impact KPI cards with trend indicators, recent orders table, stock alert cards, and quick actions in `DashboardView.vue` | M4 | Survey (Explorer 3) |
| 12 | Catalog & Inventory Operations Views | Overhaul `ProductListView`, `ProductCreateView`, `ProductEditView`, `CategoriesView`, `AttributesView`, `InventoryLedgerView`, `RestockSessionView`, `SuppliersView` | M4 | Survey (Explorer 3) |
| 13 | Sales, Orders & Customer Views | Overhaul `OrdersView`, `CustomersView`, `QuotationsView`, `InvoicesView`, `ExpensesView`, `BankAccountsView`, `PayrollView`, `SalesChannelsView` | M4 | Survey (Explorer 3) |
| 14 | Admin, Settings & Auth Views | Overhaul `SettingsView`, `DeliverySettingsView`, `RolesView`, `PermissionsView`, `UsersView`, `AdminUsersView`, `AuditLogsView`, `ReportsView`, `LoginView` | M4 | Survey (Explorer 3) |
| 15 | Feedback States & Micro-interactions | Consistent skeleton loaders, empty states with CTA, toast notifications, error recovery states, and smooth transitions across all views | M5 | Survey (Explorer 3) |
| 16 | Production Build & E2E Validation | Pass `npm run build` (`vue-tsc -b && vite build`) with 0 errors and verify full end-to-end user workflows | M5 | Survey (Explorer 1, 2, 3) |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Token Architecture & Base UI Primitives | Clean Tailwind v4 `@theme` in `src/style.css`, expand `src/components/ui/` with accessible Radix primitives, fix initial TypeScript build blockers | none | DONE |
| M2 | App Shell, Navigation & Command Palette | Redesign `src/App.vue`, top navigation, 26-route grouped sidebar, channel selector, notifications, dynamic breadcrumbs, and live Ctrl+K Command Palette | M1 | DONE |
| M3 | High-Density POS Terminal & Catalog | Build `src/stores/posStore.ts`, redesign `src/views/POSView.vue` + `src/components/pos/` (dual-zone layout, catalog, persistent cart, variant selector, quick cash checkout, receipt preview, hotkeys) | M1, M2 | DONE |
| M4 | Dashboard & Operational Views Modernization | Redesign all 26 operational views across Catalog, Inventory, Sales, Finance, Customers, Settings, and Admin with standardized data tables, metric cards, and form dialogs | M1, M2 | DONE |
| M5 | State Polish, Feedback & E2E Verification | Polish skeleton loaders, empty states, toasts, micro-animations, execute `npm run build`, and verify functional workflows | M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### `src/style.css` (Tailwind v4 `@theme`)
```css
@theme {
  --color-background: #FAF7F2;
  --color-foreground: #1A1C1C;
  --color-surface: #FFFFFF;
  --color-surface-hover: #F3ECE2;
  --color-border: #E8E2D9;
  --color-border-strong: #D5CCC0;
  --color-primary: #924C00;
  --color-primary-hover: #7A3F00;
  --color-primary-foreground: #FFFFFF;
  --color-cta: #FF8800;
  --color-cta-hover: #E67A00;
  --color-cta-foreground: #FFFFFF;
  --color-muted: #7A7268;
  --color-muted-background: #F0EAE1;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', monospace;
}
```

### `src/stores/posStore.ts`
```typescript
export interface CartItem {
  id: string
  product_id: string
  variant_id?: string
  name: string
  sku: string
  barcode?: string
  price: number
  cost_price?: number
  quantity: number
  discount: number // percentage or fixed amount
  notes?: string
  image_url?: string
}

export interface HoldCart {
  id: string
  name: string
  customer?: { id: string; name: string; phone?: string }
  items: CartItem[]
  timestamp: number
  notes?: string
}
```

---

## Code Layout
- `frontend/web/src/style.css`: Core Tailwind v4 design tokens and global layout rules
- `frontend/web/src/components/ui/`: Radix Vue & Tailwind v4 shared primitives
- `frontend/web/src/App.vue`: Root app shell, sidebar navigation, topbar, command palette
- `frontend/web/src/stores/`: Pinia stores (`posStore.ts`, `authStore.ts`, `productStore.ts`, etc.)
- `frontend/web/src/components/pos/`: POS components (Catalog Grid, Cart Panel, Variant Modal, Checkout Modal, Receipt Modal)
- `frontend/web/src/views/`: 27 page views (POS, Dashboard, Products, Orders, Customers, Inventory, Settings, etc.)
