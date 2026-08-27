# AI AGENT DIRECTIVE: OMNICHANNEL POS & INVENTORY SYSTEM IMPLEMENTATION

You are an expert Full-Stack Engineer and Database Architect. Your task is to generate and scaffold a complete, production-grade Omnichannel POS and Inventory Management System using **Laravel lastet version (Backend API)**, **Vue 3 with TypeScript (Web Admin)**, and **React Native with Expo (Mobile POS App)** backed by **PostgreSQL** using neon for db connection, cloudflaire for storing object in free tier.

Execute the implementation according to the strict architectural guidelines, relational models, and business logic detailed below.

---

## 1. Architecture Stack & Operational Rules

* **Backend:** Laravel latest version (13?), PHP 8.3+, PostgreSQL, Eloquent ORM.
* **Web Admin:** Vue (Composition API, `<script setup lang="ts">`), Tailwind CSS, Pinia, Axios.
* **Mobile POS:** React Native (Expo), TypeScript, `expo-camera`, Axios, UUIDv4 idempotency.
* **Concurrency & Integrity Invariants:**
  * All checkout stock mutations must use database transactions with pessimistic row locks (`SELECT ... FOR UPDATE` via `lockForUpdate()`).
  * Never allow stock levels to drop below 0 (`CHECK (quantity_on_hand >= 0)`).
  * Every quantity mutation (sale, restock, manual adjustment) must record an immutable entry in `stock_movements`.
  * Support soft-deletes (`SoftDeletes`) on `products`, `product_variants`, and `customers`.
  * Enforce API request idempotency via `client_mutation_id`.

---

## 2. Execution Task Checklist

### Task 1: Backend Database & Migrations (Laravel)
Create migration files in `database/migrations/` covering:
1. `attributes` (`id UUID PK`, `name VARCHAR(50) UNIQUE`, `is_active BOOL`, timestamps)
2. `attribute_values` (`id UUID PK`, `attribute_id UUID FK -> attributes`, `value_name VARCHAR(50)`, `is_active BOOL`, unique `[attribute_id, value_name]`)
3. `products` (`id UUID PK`, `name VARCHAR(255)`, `barcode VARCHAR(100) INDEX`, `purchase_price DECIMAL(10,2)`, `selling_price DECIMAL(10,2)`, `default_reorder_level INT DEFAULT 5`, `image_url TEXT`, `is_active BOOL`, `deleted_at`, timestamps)
4. `product_attributes` (`id UUID PK`, `product_id UUID FK -> products`, `attribute_id UUID FK -> attributes`, unique `[product_id, attribute_id]`)
5. `product_variants` (`id UUID PK`, `product_id UUID FK -> products`, `sku VARCHAR(100) UNIQUE`, `barcode VARCHAR(100) UNIQUE`, `cost_price_override DECIMAL(10,2) NULL`, `selling_price_override DECIMAL(10,2) NULL`, `quantity_on_hand INT DEFAULT 0`, `quantity_reserved INT DEFAULT 0`, `reorder_level INT DEFAULT 5`, `is_active BOOL`, `deleted_at`, timestamps)
6. `variant_attribute_values` (`id UUID PK`, `variant_id UUID FK -> product_variants`, `attribute_value_id UUID FK -> attribute_values`, unique `[variant_id, attribute_value_id]`)
7. `stock_movements` (`id UUID PK`, `variant_id UUID FK -> product_variants`, `movement_type ENUM('INITIAL','RESTOCK','SALE','ADJUSTMENT','RETURN','DAMAGE')`, `quantity_change INT`, `reference_id VARCHAR(100) INDEX`, `notes TEXT`, `created_at TIMESTAMP`)
8. `customers` (`id UUID PK`, `name VARCHAR(150)`, `phone VARCHAR(50) UNIQUE INDEX`, `address TEXT`, `total_purchased INT DEFAULT 0`, `total_spent DECIMAL(12,2) DEFAULT 0.00`, `last_purchase_at TIMESTAMP`, timestamps)
9. `sales_channels` (`id UUID PK`, `name VARCHAR(100) UNIQUE`, `image_url TEXT`, `is_active BOOL`, timestamps)
10. `orders` (`id UUID PK`, `order_number VARCHAR(50) UNIQUE`, `client_mutation_id VARCHAR(100) UNIQUE`, `customer_id UUID FK -> customers NULL`, `channel_id UUID FK -> sales_channels`, `status ENUM('PENDING','PROCESSING','COMPLETED','CANCELLED')`, `subtotal DECIMAL(10,2)`, `discount DECIMAL(10,2) DEFAULT 0`, `delivery_cost DECIMAL(10,2) DEFAULT 0`, `total_amount DECIMAL(10,2)`, `delivery_address TEXT`, `region VARCHAR(100)`, `created_by UUID NULL`, `note TEXT`, timestamps)
11. `order_items` (`id UUID PK`, `order_id UUID FK -> orders`, `variant_id UUID FK -> product_variants`, `quantity INT`, `unit_price DECIMAL(10,2)`, `total_price DECIMAL(10,2)`, timestamps)
12. `payments` (`id UUID PK`, `order_id UUID FK -> orders`, `payment_method VARCHAR(50)`, `amount DECIMAL(10,2)`, `transaction_ref VARCHAR(100) NULL`, `proof_image_url TEXT NULL`, timestamps)
13. `restock_sessions` (`id UUID PK`, `session_date TIMESTAMP`, `status ENUM('DRAFT','COMPLETED','CANCELLED')`, `created_by UUID NULL`, `notes TEXT`, timestamps)
14. `restock_details` (`id UUID PK`, `restock_session_id UUID FK -> restock_sessions`, `variant_id UUID FK -> product_variants`, `scanned_barcode VARCHAR(100) NULL`, `quantity INT`, `unit_cost DECIMAL(10,2)`, timestamps)
15. `expenses` (`id UUID PK`, `expense_date DATE`, `category VARCHAR(100)`, `amount DECIMAL(10,2)`, `payment_method VARCHAR(50)`, `notes TEXT`, timestamps)

### Task 2: Eloquent Models & Service Layer (Laravel)
1. **Models:** Configure `HasUuids` and relationships on all models (`Product`, `ProductVariant`, `Attribute`, `AttributeValue`, `Order`, `OrderItem`, `Customer`, `StockMovement`, `SalesChannel`, `Payment`, `RestockSession`, `RestockDetail`, `Expense`).
2. **`VariantGeneratorService`:**
   - Accepts parent `Product` model and multidimensional array of attributes and value IDs.
   - Calculates the Cartesian product matrix.
   - Creates `ProductVariant` records with deterministic SKU formatting (`[PRODUCT-NAME]-[ATTR1]-[ATTR2]`) and attaches junction records to `variant_attribute_values`.
3. **`CheckoutService`:**
   - Encapsulates transaction logic inside `DB::transaction()`.
   - Handles idempotency: returns existing order if `client_mutation_id` exists.
   - Applies `lockForUpdate()` on each variant row. Validates `quantity_on_hand >= item.quantity`.
   - Decrements `quantity_on_hand` and inserts negative delta audit rows into `stock_movements`.
   - Upserts customer details, increments `total_purchased` and `total_spent`, and updates `last_purchase_at`.
   - Inserts records into `orders`, `order_items`, and `payments`.
4. **`BarcodeScannerService`:**
   - Resolves barcode input against `product_variants.barcode` / `product_variants.sku` (direct variant match) and falls back to `products.barcode` (expands to all variants).

### Task 3: API Routing & Controllers (Laravel)
Create and register routes in `routes/api.php` with versioning of api (v1,v2...):
* `POST /api/v1/products` -> `ProductController@store` (validates base fields, dispatches `VariantGeneratorService`).
* `GET  /api/v1/products` -> `ProductController@index` (supports pagination, category filters, and variant eagerness).
* `GET  /api/v1/inventory/scan` -> `BarcodeScannerController@scan` (query param `?code=...`).
* `POST /api/v1/orders/checkout` -> `OrderController@checkout` (protected by `CheckoutRequest` validation and `CheckoutService`).
* `GET  /api/v1/orders` -> `OrderController@index`.
* `POST /api/v1/inventory/restock` -> `RestockController@store`.
* `GET  /api/v1/customers` -> `CustomerController@index` (loyalty ledger and total metrics).
* `POST /api/v1/expenses` -> `ExpenseController@store`.

### Task 4: Web Admin Panel (Vue 3 + TypeScript)
Build frontend components under `resources/js/` or separate Vue SPA:
1. **Dynamic Variant Matrix Generator (`ProductCreateView.vue`):**
   - Base product fields: Name, Master Barcode, Purchase Price, Selling Price, Reorder Level.
   - Checkbox group for available attributes (e.g., Size, Color) with multi-select tag inputs.
   - Real-time reactive preview calculating variant SKUs and combinations before submit.
   - Form submission posting payload to `POST /api/products`.
2. **Stock & Movement Ledger (`InventoryLedgerView.vue`):**
   - Data table displaying real-time stock levels, low-stock warnings (`quantity_on_hand <= reorder_level`), and filterable audit trails (`stock_movements`).
3. **Sales & Orders Dashboard (`OrdersView.vue`):**
   - List orders with channel badges, payment status, customer info, and line-item breakdown modals.

### Task 5: Mobile POS Terminal App (React Native / Expo)
Implement `PosScreen.tsx` with the following workflow:
1. **Camera Scanner (`expo-camera`):**
   - Toggleable camera overlay with target viewfinder.
   - On barcode read: Trigger `GET /api/inventory/scan?code=${data}`.
   - Auto-add direct variant matches to the active cart.
   - Provide multi-variant picker modal if a master product barcode is returned.
2. **Cart Management:**
   - Display scanned items, SKU, quantity increment/decrement, and live price total.
   - Optional customer phone input field for loyalty matching.
3. **Idempotent Checkout Action:**
   - Generate `UUIDv4` mutation key.
   - Provide "Pay Cash" and "Pay ABA QR" buttons triggering `POST /api/orders/checkout`.
   - Clear cart and display order summary confirmation on success.

---

## 3. Production & Implementation Standards

* **Error Handling:** All API endpoints must return structured JSON errors:
  ```json
  {
    "success": false,
    "message": "Human-readable error description",
    "errors": { "field": ["Validation error details"] }
  }
  
* Performance: Ensure all foreign keys, unique constraint columns, and search columns (barcode, sku, phone, order_number) have database indexes.

* Code Cleanliness: Provide fully typed TypeScript interfaces for all payloads, and adhere to PSR-12 coding standards for all PHP classes.
