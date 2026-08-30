<?php

use App\Http\Controllers\Api\V1\AttributeController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BankAccountController;
use App\Http\Controllers\Api\V1\BarcodeScannerController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DeliveryCompanyController;
use App\Http\Controllers\Api\V1\DeliveryZoneController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\MediaController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\PrinterController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\QuotationController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RestockController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SalesChannelController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StoreSettingController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VariantController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Omnichannel POS & Inventory Management System
|--------------------------------------------------------------------------
*/

// Top-level health check (no auth required)
Route::get('/health', function () {
    return response()->json([
        'success' => true,
        'data'    => [
            'status'    => 'healthy',
            'app'       => config('app.name'),
            'timestamp' => now()->toIso8601String(),
            'database'  => config('database.default'),
        ],
    ]);
});

Route::prefix('v1')->group(function () {

    // ----------------------------------------------------------------
    // Public Endpoints (No Authentication Required)
    // ----------------------------------------------------------------
    Route::get('/health', [HealthController::class, 'check']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::get('/settings/branding', [StoreSettingController::class, 'getBranding']);

    // ----------------------------------------------------------------
    // Authenticated API Pipeline (Requires Bearer Token via Sanctum)
    // ----------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function () {

        // ============================================================
        // 1. Account & Self-Service (All Authenticated Roles)
        // ============================================================
        Route::post('/auth/logout',    [AuthController::class, 'logout']);
        Route::patch('/auth/password', [AuthController::class, 'changePassword']);
        Route::get('/auth/me',         [AuthController::class, 'me']);

        // ============================================================
        // 2. POS & Point-of-Sale Core (All Authenticated Roles: Cashier/Seller, Manager, Admin)
        // ============================================================
        Route::get('/dashboard/summary',          [DashboardController::class, 'summary']);
        Route::get('/dashboard/staff-performance', [DashboardController::class, 'staffPerformance']);
        Route::get('/reports/analytics',           [ReportController::class, 'analytics']);
        Route::get('/products',             [ProductController::class, 'index']);
        Route::get('/products/{id}',        [ProductController::class, 'show']);
        Route::get('/variants',             [VariantController::class, 'index']);
        Route::get('/variants/{id}',        [VariantController::class, 'show']);
        Route::get('/inventory/scan',       [BarcodeScannerController::class, 'scan']);
        Route::get('/inventory/movements',  [StockAdjustmentController::class, 'index']);
        Route::post('/orders/checkout',     [OrderController::class, 'checkout']);
        Route::get('/orders',               [OrderController::class, 'index']);
        Route::get('/orders/{id}',          [OrderController::class, 'show']);
        Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);
        Route::match(['put', 'patch'], '/orders/{id}', [OrderController::class, 'update']);
        Route::get('/customers',            [CustomerController::class, 'index']);
        Route::get('/customers/{id}',       [CustomerController::class, 'show']);
        Route::get('/suppliers',            [SupplierController::class, 'index']);
        Route::get('/suppliers/{id}',       [SupplierController::class, 'show']);
        Route::get('/sales-channels',       [SalesChannelController::class, 'index']);
        Route::get('/delivery-companies',   [DeliveryCompanyController::class, 'index']);
        Route::get('/delivery-companies/{id}', [DeliveryCompanyController::class, 'show']);
        Route::get('/delivery-zones',       [DeliveryZoneController::class, 'index']);
        Route::get('/delivery-zones/{id}',  [DeliveryZoneController::class, 'show']);
        Route::get('/bank-accounts',        [BankAccountController::class, 'index']);
        Route::get('/bank-accounts/{id}',   [BankAccountController::class, 'show']);
        Route::get('/staff-members',        [UserController::class, 'staffList']);
        Route::post('/printer/raw-print',   [PrinterController::class, 'rawPrint']);

        // Quotations & Estimates Lifecycle
        Route::get('/quotations',                  [QuotationController::class, 'index']);
        Route::post('/quotations',                 [QuotationController::class, 'store']);
        Route::get('/quotations/{id}',             [QuotationController::class, 'show']);
        Route::patch('/quotations/{id}/status',    [QuotationController::class, 'updateStatus']);
        Route::post('/quotations/{id}/convert',    [QuotationController::class, 'convert']);

        // Invoices & Billing Lifecycle
        Route::get('/invoices',                    [InvoiceController::class, 'index']);
        Route::post('/invoices',                   [InvoiceController::class, 'store']);
        Route::get('/invoices/{id}',               [InvoiceController::class, 'show']);
        Route::post('/invoices/{id}/payments',     [InvoiceController::class, 'recordPayment']);

        // Privileged Invoice & Quotation Deletion (Manager, Admin, Super Admin or specific permission)
        Route::middleware('role:SUPER_ADMIN,ADMIN,MANAGER,invoices:delete,quotations:delete,invoices:*,quotations:*')->group(function () {
            Route::delete('/quotations/{id}',          [QuotationController::class, 'destroy']);
            Route::delete('/invoices/{id}',            [InvoiceController::class, 'destroy']);
        });

        // Individual Staff Personal Performance & Incentives
        Route::get('/my/performance',    [\App\Http\Controllers\Api\V1\StaffPerformanceController::class, 'myPerformance']);
        Route::get('/my/incentives',     [\App\Http\Controllers\Api\V1\StaffIncentiveController::class, 'myIncentives']);
        Route::get('/my/salary-history', [\App\Http\Controllers\Api\V1\PayrollController::class, 'mySalaryHistory']);
        Route::get('/my/savings',        [\App\Http\Controllers\Api\V1\PayrollController::class, 'mySavings']);

        // Seller Daily Settlement & Reconciliation Proof
        Route::get('/seller-settlements/summary',         [\App\Http\Controllers\Api\V1\SellerDailySettlementController::class, 'summary']);
        Route::get('/seller-settlements/team-daily',      [\App\Http\Controllers\Api\V1\SellerDailySettlementController::class, 'teamDailySummary']);
        Route::post('/seller-settlements/confirm',        [\App\Http\Controllers\Api\V1\SellerDailySettlementController::class, 'confirm']);
        Route::post('/seller-settlements/reassign-order', [\App\Http\Controllers\Api\V1\SellerDailySettlementController::class, 'reassignOrder']);

        // ============================================================
        // 3. Store Operations & Inventory Management (Manager, Admin, Super Admin)
        // ============================================================
        Route::middleware('role:SUPER_ADMIN,ADMIN,MANAGER,products:*,inventory:*,expenses:*,settings:*')->group(function () {
            // Media & Asset Uploads (Cloudflare R2 / Storage)
            Route::post('/media/upload',                         [MediaController::class, 'upload']);

            // Product Catalog Mutations
            Route::post('/products',                             [ProductController::class, 'store']);
            Route::match(['put', 'patch'], '/products/{id}',      [ProductController::class, 'update']);
            Route::delete('/products/{id}',                      [ProductController::class, 'destroy']);
            Route::match(['put', 'patch'], '/variants/{id}',      [VariantController::class, 'update']);

            // Physical Inventory Intake & Count Adjustment
            Route::post('/inventory/restock',                    [RestockController::class, 'store']);
            Route::post('/inventory/adjust',                     [StockAdjustmentController::class, 'adjust']);
            Route::post('/inventory/adjustment',                 [StockAdjustmentController::class, 'adjust']);

            // Operational Expenses
            Route::get('/expenses',                              [ExpenseController::class, 'index']);
            Route::post('/expenses',                             [ExpenseController::class, 'store']);
            Route::delete('/expenses/{id}',                      [ExpenseController::class, 'destroy']);

            // Suppliers Administration
            Route::post('/suppliers',                            [SupplierController::class, 'store']);
            Route::match(['put', 'patch'], '/suppliers/{id}',    [SupplierController::class, 'update']);
            Route::delete('/suppliers/{id}',                     [SupplierController::class, 'destroy']);

            // Categories Administration
            Route::get('/categories',                            [CategoryController::class, 'index']);
            Route::post('/categories',                           [CategoryController::class, 'store']);
            Route::match(['put', 'patch'], '/categories/{id}',   [CategoryController::class, 'update']);
            Route::delete('/categories/{id}',                    [CategoryController::class, 'destroy']);

            // Product Attributes & Taxonomy
            Route::get('/attributes',                            [AttributeController::class, 'index']);
            Route::post('/attributes',                           [AttributeController::class, 'store']);
            Route::delete('/attributes/{id}',                    [AttributeController::class, 'destroy']);

            // Sales Channels Administration
            Route::post('/sales-channels',                       [SalesChannelController::class, 'store']);
            Route::match(['put', 'patch'], '/sales-channels/{id}', [SalesChannelController::class, 'update']);
            Route::delete('/sales-channels/{id}',                [SalesChannelController::class, 'destroy']);

            // Delivery Companies Administration
            Route::post('/delivery-companies',                             [DeliveryCompanyController::class, 'store']);
            Route::match(['put', 'patch'], '/delivery-companies/{id}',      [DeliveryCompanyController::class, 'update']);
            Route::delete('/delivery-companies/{id}',                      [DeliveryCompanyController::class, 'destroy']);

            // Delivery Zones Administration
            Route::post('/delivery-zones',                                 [DeliveryZoneController::class, 'store']);
            Route::match(['put', 'patch'], '/delivery-zones/{id}',          [DeliveryZoneController::class, 'update']);
            Route::delete('/delivery-zones/{id}',                          [DeliveryZoneController::class, 'destroy']);

            // Bank Accounts & QR Administration
            Route::post('/bank-accounts',                                  [BankAccountController::class, 'store']);
            Route::match(['put', 'patch'], '/bank-accounts/{id}',          [BankAccountController::class, 'update']);
            Route::delete('/bank-accounts/{id}',                           [BankAccountController::class, 'destroy']);

            // Store Branding & Identity Settings
            Route::post('/settings/branding',                    [StoreSettingController::class, 'updateBranding']);
        });

        // ============================================================
        // 4. Administration & Security Auditing (Admin, Super Admin)
        // ============================================================
        Route::middleware('role:SUPER_ADMIN,ADMIN,users:manage,audit:view')->group(function () {
            // Staff User Account CRUD & Status Toggle
            Route::get('/users',               [UserController::class, 'index']);
            Route::post('/users',              [UserController::class, 'store']);
            Route::get('/users/{id}',          [UserController::class, 'show']);
            Route::patch('/users/{id}',        [UserController::class, 'update']);
            Route::patch('/users/{id}/status', [UserController::class, 'updateStatus']);
            Route::delete('/users/{id}',       [UserController::class, 'destroy']);

            // Security & System Audit Logs
            Route::get('/audit-logs',          [AuditLogController::class, 'index']);
        });

        // ============================================================
        // 5. Staff Payroll & Compensation (Admin, Super Admin, Manager)
        //    Reads require payroll:view — mutations require payroll:manage.
        //    Role holders pass directly; custom roles need the matching slug
        //    (payroll:* satisfies both via wildcard permission resolution).
        // ============================================================
        Route::middleware('role:SUPER_ADMIN,ADMIN,MANAGER,payroll:view,users:view')->group(function () {
            Route::get('/payrolls',                       [\App\Http\Controllers\Api\V1\PayrollController::class, 'index']);
            Route::get('/users/{userId}/salary',          [\App\Http\Controllers\Api\V1\PayrollController::class, 'getSalary']);
            Route::get('/users/{userId}/salary-history',  [\App\Http\Controllers\Api\V1\PayrollController::class, 'getSalaryHistory']);
            Route::get('/users/{userId}/savings',         [\App\Http\Controllers\Api\V1\PayrollController::class, 'getThirteenthMonthSavings']);
            Route::get('/users/{userId}/performance',     [\App\Http\Controllers\Api\V1\StaffPerformanceController::class, 'show']);
            Route::get('/users/{userId}/incentives',      [\App\Http\Controllers\Api\V1\StaffIncentiveController::class, 'show']);
        });

        Route::middleware('role:SUPER_ADMIN,ADMIN,MANAGER,payroll:manage')->group(function () {
            Route::post('/payrolls/generate',             [\App\Http\Controllers\Api\V1\PayrollController::class, 'generate']);
            Route::post('/payrolls/bulk-status',          [\App\Http\Controllers\Api\V1\PayrollController::class, 'bulkUpdateStatus']);
            Route::match(['put', 'patch'], '/payrolls/{id}', [\App\Http\Controllers\Api\V1\PayrollController::class, 'update']);
            Route::delete('/payrolls/{id}',              [\App\Http\Controllers\Api\V1\PayrollController::class, 'destroy']);
            Route::match(['post', 'put', 'patch'], '/users/{userId}/salary', [\App\Http\Controllers\Api\V1\PayrollController::class, 'setSalary']);
            Route::post('/users/{userId}/savings/payout',  [\App\Http\Controllers\Api\V1\PayrollController::class, 'recordStandalonePayout']);
        });

        // ============================================================
        // 5. Role & Permission Management (Super Admin only)
        // ============================================================
        Route::middleware('role:SUPER_ADMIN')->group(function () {
            Route::get('/roles',                        [RoleController::class, 'index']);
            Route::get('/roles/{id}',                   [RoleController::class, 'show']);
            Route::put('/roles/{id}/permissions',       [RoleController::class, 'updatePermissions']);
            Route::get('/permissions',                  [PermissionController::class, 'index']);
        });
    });
});
