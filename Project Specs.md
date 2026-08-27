# Specs

# **📱 Complete Mobile App Feature Map & Design Specification**

## **System Overview**

This is a **comprehensive inventory management system** with sales/POS, customer management, accounting, permissions, and analytics. The architecture uses **Next.js (backend) + React (frontend)** with Prisma ORM and PostgreSQL.

---

## **🎯 Core Modules & Features for Mobile**

### **1. AUTHENTICATION & SECURITY**

#### **1.1 User Authentication**

- ✅ Email/Password login with validation
- ✅ Session management (7-day expiry, 1-day refresh)
- ✅ Role-based access control (SELLER, MANAGER, ADMIN, SUPER_ADMIN)
- ✅ Password reset functionality
- ✅ Account deactivation

**API Endpoints:**

Code

`POST   /api/auth/signin
POST   /api/auth/signup
POST   /api/auth/signout
POST   /api/auth/refresh`

**Mobile UI Components Needed:**

- Login Screen (email, password, error handling)
- Profile Screen (view/edit profile)
- Account Settings (password change, security)

---

### **2. SALES MODULE (POS - Point of Sale)**

#### **2.1 Point of Sale (POS) System**

**Features:**

- 🛒 Real-time product search & filter by category
- 📦 Product variant selection (Size, Color, Attributes)
- 🧾 Shopping cart management (add, remove, quantity control)
- 👥 Customer selection/creation during checkout
- 💳 Payment method selection
- 🏷️ Discount % & Tax % calculation
- 📄 Order status (COMPLETED, PENDING, CANCELLED)
- 🔖 Barcode/QR scanning support
- 📊 Real-time stock validation
- 💰 Amount paid calculation & change management

**API Endpoints:**

Code

`GET    /api/products?page=1&limit=200&isActive=true
GET    /api/customers
GET    /api/payment-methods
POST   /api/sales               # Create order
GET    /api/sales               # List orders
GET    /api/stock/adjust        # Stock movements`

**Mobile UI Components Needed:**

- **Product Grid** (image, name, price, stock)
- **Product Detail Modal** (variants, attributes, stock)
- **Cart Sidebar** (items, quantity controls, summary)
- **Checkout Form** (customer, payment, discount, tax)
- **Barcode Scanner** (camera overlay, detection)
- **Order Summary** (calculations, final total)

#### **2.2 Quotations**

- 📋 Create quotations (draft, sent, accepted, rejected)
- ✅ Convert quotation to order
- 📑 Quote versioning & revisions
- 📄 PDF export/print
- 🔄 Quotation status tracking

**API Endpoints:**

Code

`GET    /api/quotations?page=1
POST   /api/quotations                    # Create
PUT    /api/quotations/{id}               # Update
POST   /api/quotations/{id}/convert       # Convert to order`

**Mobile UI Components Needed:**

- Quotation List (status, date, customer)
- Quotation Form (items, pricing, validity)
- Quotation Preview (printable layout)

#### **2.3 Invoices**

- 📄 Auto-generated invoice numbers
- 💳 Invoice status (DRAFT, SENT, PAID, PARTIAL, OVERDUE)
- 💰 Payment recording
- 📑 Invoice line items (product, qty, price)
- 📊 Amount paid tracking

**API Endpoints:**

Code

`GET    /api/invoices?page=1
GET    /api/invoices/{id}
POST   /api/invoices/{id}/payments      # Record payment`

**Mobile UI Components Needed:**

- Invoice List (status badge, amount, date)
- Invoice Details (items, payment history)
- Payment Form (amount, method, date, reference)

---

### **3. INVENTORY MANAGEMENT**

#### **3.1 Product Management**

- 📦 Create/Edit/Delete products
- 🏷️ Product variants (size, color, attributes)
- 📸 Product images (upload via UploadThing)
- 🔢 SKU management
- 📊 Stock tracking (cost price, selling price)
- ⚠️ Reorder levels
- 🏷️ Categories & Units
- ✅ Active/Inactive status

**API Endpoints:**

Code

`GET    /api/products?page=1&limit=10&isActive=true
GET    /api/products/{id}
POST   /api/products
PUT    /api/products/{id}
DELETE /api/products/{id}
GET    /api/products/categories
GET    /api/products/units
GET    /api/attributes                   # Product attributes`

**Mobile UI Components Needed:**

- Product List (search, filter, pagination)
- Product Detail (variants, pricing, images)
- Product Form (all fields, image upload)
- Stock Level Badge
- Variant Selector

#### **3.2 Stock Management**

- 📥 Stock adjustments (INITIAL, SALE, PURCHASE, ADJUSTMENT, RETURN, DAMAGE)
- 📋 Stock movement history
- ⚠️ Low stock alerts
- 🔄 Bulk stock adjustments
- 📊 Stock valuation

**API Endpoints:**

Code

`POST   /api/stock/adjust
GET    /api/stock/adjust?page=1&movementType=PURCHASE
POST   /api/stock/adjust/batch            # Bulk adjust`

**Mobile UI Components Needed:**

- Stock Adjustment Form (variant, type, quantity)
- Stock Movement List (history, dates, reasons)
- Low Stock Alert Banner
- Bulk Adjustment Modal

#### **3.3 Purchase Orders**

- 📋 Create POs for suppliers
- 🔄 PO status tracking
- 📦 PO items (variant, qty, unit price)
- 💰 PO total calculation
- 🏢 Supplier management

**API Endpoints:**

Code

`GET    /api/purchase-orders?page=1
POST   /api/purchase-orders
GET    /api/suppliers
POST   /api/suppliers`

**Mobile UI Components Needed:**

- PO Form (supplier, items, pricing)
- PO List (status, date, supplier)
- Supplier Selector/Directory

---

### **4. CUSTOMER MANAGEMENT**

#### **4.1 Customer Directory**

- 👥 Create/Edit/Delete customers
- 📞 Phone, email, address storage
- 💳 Order history per customer
- 📊 Customer spending analytics
- 🔍 Search & filter

**API Endpoints:**

Code

`GET    /api/customers?phone={phone}
POST   /api/customers
PUT    /api/customers/{id}
GET    /api/customers/{id}`

**Mobile UI Components Needed:**

- Customer List (search, phone lookup)
- Customer Detail (contact info, order history)
- Customer Form (create/edit)
- Customer Selection Dropdown (in checkout)

---

### **5. ACCOUNTING & EXPENSES**

#### **5.1 Expense Management**

- 💸 Record expenses
- 🏷️ Expense categories
- 📅 Expense date tracking
- 💳 Payment method selection
- 📝 Description & notes
- 📊 Expense reports

**API Endpoints:**

Code

`GET    /api/expenses?page=1
POST   /api/expenses
PUT    /api/expenses/{id}
DELETE /api/expenses/{id}`

**Mobile UI Components Needed:**

- Expense Form (category, amount, date, method)
- Expense List (category badge, amount, date)
- Expense Category Manager

#### **5.2 Payment Methods**

- 💳 Create/manage payment methods
- 🏦 Payment tracking

**API Endpoints:**

Code

`GET    /api/payment-methods
POST   /api/payment-methods`

---

### **6. REPORTING & ANALYTICS**

#### **6.1 Dashboards (Role-Specific)**

**Admin Dashboard:**

- 📊 Monthly revenue & profit
- 📈 Today's revenue
- 🛒 Total orders, pending orders
- 📦 Product count, low stock alerts
- 💸 Monthly expenses, net profit
- 📊 Sale statistics chart (bar/line chart)
- 🔝 Top products

**Manager Dashboard:**

- 📊 Manager-specific metrics
- 📦 Inventory summary
- 🛒 Recent sales
- 📈 Sales chart

**Sales Dashboard:**

- 🛒 Today's sales
- 💰 Revenue tracking
- 📋 Recent quotations
- 🔗 Quick actions (POS, Customers, Invoices)

#### **6.2 Reports & Data Export**

- 📊 Sales reports (by date range)
- 📦 Inventory reports
- 💸 Expense summaries
- 📄 PDF export functionality
- 📊 Excel export (XLSX)

**Mobile UI Components Needed:**

- Dashboard Cards (metrics, trends)
- Chart Components (Bar, Line, Pie charts using Recharts)
- Report Filters (date range, status)
- Export Button

---

### **7. USER MANAGEMENT (Admin Only)**

#### **7.1 Employee Management**

- 👤 Create/Edit/Deactivate users
- 🔑 Role assignment (SUPER_ADMIN, ADMIN, MANAGER, SELLER)
- 🔐 Password reset
- 📊 User activity tracking
- 🚫 Last active user protection rule

**API Endpoints:**

Code

`GET    /api/users
POST   /api/users
PUT    /api/users/{id}
GET    /api/users/{id}
POST   /api/users/{id}/deactivate
POST   /api/users/{id}/reactivate
POST   /api/users/{id}/reset-password`

**Mobile UI Components Needed:**

- User List (role badge, status)
- User Detail (profile, permissions)
- User Form (create/edit)
- Role Selector

#### **7.2 Permission Management**

- 👥 Permission groups
- 🔑 Role-based permissions (CRUD + features)
- ⚙️ User permission overrides (grant/revoke)
- ⏰ Temporary permission expiry
- 📋 Permission audit log
- 🛡️ Role hierarchy enforcement (SUPER_ADMIN > ADMIN > MANAGER > SELLER)

**Permissions Structure:**

Code

`CRUD Permissions:
- product:create, product:read, product:update, product:delete
- order:create, order:read, order:update, order:delete
- customer:*, supplier:*, expense:*, etc.

Feature Permissions:
- dashboard:admin, dashboard:manager, dashboard:sale
- pos:read, barcode:read, export:read, import:read
- permission:admin`

**API Endpoints:**

Code

`GET    /api/permission-groups
POST   /api/permission-groups
GET    /api/users/{id}/permissions?type=effective|overrides
POST   /api/users/{id}/permissions       # Grant/revoke/assign`

**Mobile UI Components Needed:**

- Permission Group List
- Permission Matrix (feature x role)
- User Permission Override Form
- Permission Audit Log

---

### **8. SETTINGS & CONFIGURATION**

#### **8.1 User Settings**

- 👤 Profile update (name)
- 🔐 Change password
- 🎨 Theme preference (dark/light mode)
- 🔔 Notification preferences

**API Endpoints:**

Code

`PATCH  /api/user/profile
POST   /api/user/change-password`

**Mobile UI Components Needed:**

- Profile Form
- Security Settings
- Theme Toggle
- Logout Button

---

## **📊 Complete API Summary**

### **Authentication**

Code

`POST   /api/auth/[...all]          # Better-Auth catch-all`

### **Products**

Code

`GET    /api/products
POST   /api/products
GET    /api/products/{id}
PUT    /api/products/{id}
DELETE /api/products/{id}
PATCH  /api/products/{id}           # Reactivate
GET    /api/products/units
POST   /api/products/units
GET    /api/attributes
POST   /api/attributes`

### **Sales**

Code

`GET    /api/sales
POST   /api/sales
GET    /api/orders                  # Alias
POST   /api/quotations
GET    /api/quotations
PUT    /api/quotations/{id}
GET    /api/invoices
POST   /api/invoices
POST   /api/invoices/{id}/payments`

### **Inventory**

Code

`GET    /api/stock/adjust
POST   /api/stock/adjust
POST   /api/stock/adjust/batch
GET    /api/purchase-orders
POST   /api/purchase-orders`

### **Master Data**

Code

`GET    /api/customers
POST   /api/customers
PUT    /api/customers/{id}
GET    /api/suppliers
POST   /api/suppliers
PUT    /api/suppliers/{id}
GET    /api/payment-methods
POST   /api/payment-methods
GET    /api/expenses
POST   /api/expenses
PUT    /api/expenses/{id}
DELETE /api/expenses/{id}`

### **Admin**

Code

`GET    /api/users
POST   /api/users
PUT    /api/users/{id}
POST   /api/users/{id}/deactivate
POST   /api/users/{id}/reactivate
POST   /api/users/{id}/reset-password
POST   /api/users/{id}/permissions
GET    /api/users/{id}/permissions
GET    /api/permission-groups
POST   /api/permission-groups
PUT    /api/permission-groups/{id}`

---

## **🎨 Mobile UI/UX Architecture**

### **Navigation Structure**

Code

`┌─ Home/Dashboard (Role-specific)
├─ Sales
│  ├─ POS (Point of Sale)
│  ├─ All Sales
│  ├─ Quotations
│  └─ Invoices
├─ Products
│  ├─ Product List
│  ├─ Categories
│  ├─ Units
│  └─ Attributes
├─ Inventory
│  ├─ Stock Adjustment
│  ├─ Purchase Orders
│  └─ Stock Movement
├─ Customers
│  └─ Customer List
├─ Accounting
│  └─ Expenses
├─ Reporting
│  ├─ Dashboard
│  └─ Reports
├─ Admin (Super_Admin/Admin only)
│  ├─ Users
│  ├─ Permission Groups
│  └─ Audit Logs
└─ Settings
   ├─ Profile
   ├─ Security
   └─ Preferences`

### **Key Mobile Screens**

| **Screen** | **Purpose** | **Key Data** |
| --- | --- | --- |
| **Login** | Authentication | Email, Password |
| **Dashboard** | KPI overview | Revenue, Orders, Inventory |
| **POS** | Checkout experience | Cart, Customer, Payment |
| **Product List** | Inventory browse | Search, Filter, Pagination |
| **Sales List** | Order history | Status, Date, Customer |
| **Quotation List** | Quote management | Status, Validity, Amount |
| **Invoice List** | Billing records | Status, Amount Paid |
| **Customers** | Customer directory | Phone lookup, Order history |
| **Stock Adjust** | Inventory control | Movement type, Quantity |
| **Expenses** | Cost tracking | Category, Amount, Date |
| **Users** (Admin) | Team management | Role, Status, Permissions |
| **Reports** | Analytics | Charts, Date filters |
| **Settings** | User preferences | Profile, Password, Theme |

---

## **💾 Database Schema (Relevant Tables for Mobile)**

TypeScript

`// Core Models
User { id, name, email, role, isActive, permissionGroup }
Session { id, expiresAt, token, userId }

// Sales
Order { id, customerId, status, totalPrice, paymentMethod, invoice, quotation }
OrderDetail { id, orderId, productId, variantId, quantity, unitPrice }
Quotation { id, quotationNumber, status, customerId, items, validUntil }
Invoice { id, invoiceNumber, orderId, status, amountPaid, payments }

// Inventory
Product { id, sku, name, categoryId, unitId, variants, isActive }
ProductVariant { id, productId, sku, stock, sellingPrice, costPrice }
StockMovement { id, variantId, movementType, quantity, createdAt }
PurchaseOrder { id, supplierId, status, items }

// Master
Customer { id, name, email, phone, address, orders }
Supplier { id, name, email, phone, address }
PaymentMethod { id, name }

// Accounting
Expense { id, amount, category, paymentMethod, expenseDate }
ExpenseCategory { id, name }

// Permissions
Permission { id, name, resource, action }
PermissionGroup { id, name, permissions, users }
UserPermissionOverride { userId, permissionId, granted, expiresAt }
PermissionAuditLog { id, action, targetType, targetId, permission, reason }`

---

## **🔐 Role-Based Feature Access**

| **Feature** | **SELLER** | **MANAGER** | **ADMIN** | **SUPER_ADMIN** |
| --- | --- | --- | --- | --- |
| POS/Checkout | ✅ | ✅ | ✅ | ✅ |
| Create Order | ✅ | ✅ | ✅ | ✅ |
| View Own Sales | ✅ | ✅ | ✅ | ✅ |
| View All Sales | ❌ | ✅ | ✅ | ✅ |
| Create Quotation | ✅ | ✅ | ✅ | ✅ |
| Manage Products | ❌ | ✅ | ✅ | ✅ |
| Stock Adjustment | ❌ | ✅ | ✅ | ✅ |
| Manage Customers | ✅ | ✅ | ✅ | ✅ |
| View Reports | ❌ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ✅ | ✅ |
| Manage Permissions | ❌ | ❌ | ❌ | ✅ |
| Admin Dashboard | ❌ | ❌ | ✅ | ✅ |

---

## **🚀 Mobile App Tech Stack Recommendation**

### **Option 1: React Native (Cross-platform)**

Code

`Frontend:
- React Native / Expo
- React Navigation (routing)
- Redux/Zustand (state management)
- TanStack React Query (API caching)
- Zod (validation)
- React Hook Form (forms)

Backend Integration:
- Axios / fetch (HTTP)
- AsyncStorage (local caching)
- Camera (barcode scanning)`

### **Option 2: Flutter (Cross-platform)**

Code

`Frontend:
- Flutter
- Riverpod (state management)
- Dio (HTTP)
- Hive (local storage)

Backend: Same API endpoints`

### **Option 3: Native + Web (PWA)**

Code

`Frontend:
- Next.js (PWA)
- React 19.2.3 (already using)
- Tailwind CSS (styling)
- Tauri/Electron (desktop)

Backend: Existing Next.js API`

---

## **✅ Pre-Implementation Checklist**

- [ ]  **API Standardization**: Fix inconsistent error responses
- [ ]  **CORS Configuration**: Add mobile app domain
- [ ]  **Rate Limiting**: Add request throttling
- [ ]  **Request Validation**: Consistent Zod schemas
- [ ]  **Pagination**: Standardize to cursor-based
- [ ]  **Caching Headers**: Add ETags, Cache-Control
- [ ]  **Batch Endpoints**: Add bulk operations
- [ ]  **WebSocket**: Optional real-time updates
- [ ]  **File Upload Security**: Add size/type validation
- [ ]  **Offline Support**: Sync queue for mobile
- [ ]  **API Documentation**: Generate OpenAPI spec