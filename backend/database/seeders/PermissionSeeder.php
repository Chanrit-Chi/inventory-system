<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Global System Wildcard
            [
                'name'        => 'Super Administrator All Permissions',
                'slug'        => '*',
                'module'      => 'system',
                'description' => 'Unrestricted super administrative access to all endpoints and operations',
            ],

            // Products & Catalog
            [
                'name'        => 'All Products Permissions',
                'slug'        => 'products:*',
                'module'      => 'products',
                'description' => 'Full access to create, view, update, and delete products and categories',
            ],
            [
                'name'        => 'Create Products',
                'slug'        => 'products:create',
                'module'      => 'products',
                'description' => 'Create new products, categories, and attributes',
            ],
            [
                'name'        => 'Read Products',
                'slug'        => 'products:read',
                'module'      => 'products',
                'description' => 'View products and catalog items',
            ],
            [
                'name'        => 'Update Products',
                'slug'        => 'products:update',
                'module'      => 'products',
                'description' => 'Update existing products, variants, and pricing',
            ],
            [
                'name'        => 'Delete Products',
                'slug'        => 'products:delete',
                'module'      => 'products',
                'description' => 'Delete products and categories',
            ],
            [
                'name'        => 'Manage Categories',
                'slug'        => 'categories:manage',
                'module'      => 'products',
                'description' => 'Organize product hierarchies, categories, and collections',
            ],
            [
                'name'        => 'Manage Attributes & Units',
                'slug'        => 'attributes:manage',
                'module'      => 'products',
                'description' => 'Configure product attributes, variants, and measurement units',
            ],

            // Inventory & Procurement
            [
                'name'        => 'All Inventory Permissions',
                'slug'        => 'inventory:*',
                'module'      => 'inventory',
                'description' => 'Full access to stock operations, adjustments, and restock sessions',
            ],
            [
                'name'        => 'Adjust Inventory',
                'slug'        => 'inventory:adjust',
                'module'      => 'inventory',
                'description' => 'Perform physical stock adjustments and reconciliation',
            ],
            [
                'name'        => 'Scan Inventory',
                'slug'        => 'inventory:scan',
                'module'      => 'inventory',
                'description' => 'Scan barcodes for inventory verification and lookup',
            ],
            [
                'name'        => 'Restock Inventory',
                'slug'        => 'inventory:restock',
                'module'      => 'inventory',
                'description' => 'Create and confirm stock restock sessions',
            ],
            // Suppliers & Vendors
            [
                'name'        => 'All Suppliers Permissions',
                'slug'        => 'suppliers:*',
                'module'      => 'suppliers',
                'description' => 'Full access to vendor directory and supplier management',
            ],
            [
                'name'        => 'View Suppliers',
                'slug'        => 'suppliers:view',
                'module'      => 'suppliers',
                'description' => 'Browse supplier profiles, catalogs, and vendor contacts',
            ],
            [
                'name'        => 'Manage Suppliers',
                'slug'        => 'suppliers:manage',
                'module'      => 'suppliers',
                'description' => 'Create, edit, and delete vendor profiles and terms',
            ],
            [
                'name'        => 'All Purchase Orders Permissions',
                'slug'        => 'purchase-orders:*',
                'module'      => 'suppliers',
                'description' => 'Full access to procurement purchase orders',
            ],
            [
                'name'        => 'Create Purchase Orders',
                'slug'        => 'purchase-orders:create',
                'module'      => 'suppliers',
                'description' => 'Draft and issue procurement purchase orders to suppliers',
            ],

            // Point of Sale (POS)
            [
                'name'        => 'All POS Permissions',
                'slug'        => 'pos:*',
                'module'      => 'pos',
                'description' => 'Full access to point of sale terminal operations',
            ],
            [
                'name'        => 'POS Checkout',
                'slug'        => 'pos:checkout',
                'module'      => 'pos',
                'description' => 'Process customer sales orders and accept payments',
            ],

            // Sales & Transactions
            [
                'name'        => 'All Sales Permissions',
                'slug'        => 'sales:*',
                'module'      => 'sales',
                'description' => 'Manage sales orders, returns, and sales channels',
            ],
            [
                'name'        => 'View Transactions',
                'slug'        => 'transactions:view',
                'module'      => 'sales',
                'description' => 'View order transactions and payment receipts',
            ],

            // Invoices & Billing
            [
                'name'        => 'All Invoices Permissions',
                'slug'        => 'invoices:*',
                'module'      => 'invoices',
                'description' => 'Full access to invoices, billing statements, and payments',
            ],
            [
                'name'        => 'View Invoices',
                'slug'        => 'invoices:view',
                'module'      => 'invoices',
                'description' => 'View billing invoices, payment statuses, and balances due',
            ],
            [
                'name'        => 'Create Invoices',
                'slug'        => 'invoices:create',
                'module'      => 'invoices',
                'description' => 'Generate billing invoices from sales orders or quotes',
            ],
            [
                'name'        => 'Record Invoice Payments',
                'slug'        => 'invoices:record-payment',
                'module'      => 'invoices',
                'description' => 'Collect customer installments and record invoice payment transactions',
            ],

            // Quotations
            [
                'name'        => 'All Quotations Permissions',
                'slug'        => 'quotations:*',
                'module'      => 'quotations',
                'description' => 'Manage all sales quotations and estimates',
            ],
            [
                'name'        => 'Create Quotations',
                'slug'        => 'quotations:create',
                'module'      => 'quotations',
                'description' => 'Draft and issue price quotations to customers',
            ],

            // Customers
            [
                'name'        => 'All Customers Permissions',
                'slug'        => 'customers:*',
                'module'      => 'customers',
                'description' => 'Full access to customer management',
            ],
            [
                'name'        => 'View Customers',
                'slug'        => 'customers:view',
                'module'      => 'customers',
                'description' => 'View customer profiles and order histories',
            ],
            [
                'name'        => 'Manage Customers',
                'slug'        => 'customers:manage',
                'module'      => 'customers',
                'description' => 'Create, edit, and delete customer records',
            ],

            // Logistics & Delivery
            [
                'name'        => 'All Delivery Permissions',
                'slug'        => 'delivery:*',
                'module'      => 'delivery',
                'description' => 'Full access to delivery companies, shipping zones, and rates',
            ],
            [
                'name'        => 'View Delivery Options',
                'slug'        => 'delivery:view',
                'module'      => 'delivery',
                'description' => 'Browse delivery companies, zones, and dispatch methods',
            ],
            [
                'name'        => 'Manage Delivery Setup',
                'slug'        => 'delivery:manage',
                'module'      => 'delivery',
                'description' => 'Configure delivery partners, fee structures, and service zones',
            ],

            // Bank Accounts & Payment Methods
            [
                'name'        => 'All Payment Methods Permissions',
                'slug'        => 'payment-methods:*',
                'module'      => 'finance',
                'description' => 'Full access to bank accounts and payment gateway methods',
            ],
            [
                'name'        => 'View Payment Methods',
                'slug'        => 'payment-methods:view',
                'module'      => 'finance',
                'description' => 'View bank accounts, QR payment configs, and cash drawers',
            ],
            [
                'name'        => 'Manage Payment Methods',
                'slug'        => 'payment-methods:manage',
                'module'      => 'finance',
                'description' => 'Configure bank accounts, ABA QR, and payment terminals',
            ],

            // Sales Channels (Omnichannel)
            [
                'name'        => 'All Sales Channels Permissions',
                'slug'        => 'channels:*',
                'module'      => 'channels',
                'description' => 'Full access to manage omnichannel sales integrations',
            ],
            [
                'name'        => 'View Sales Channels',
                'slug'        => 'channels:view',
                'module'      => 'channels',
                'description' => 'View active sales channels and integration statuses',
            ],
            [
                'name'        => 'Manage Sales Channels',
                'slug'        => 'channels:manage',
                'module'      => 'channels',
                'description' => 'Create, configure, and sync sales channel integrations',
            ],

            // Expenses & Finance
            [
                'name'        => 'All Expenses Permissions',
                'slug'        => 'expenses:*',
                'module'      => 'expenses',
                'description' => 'Create, view, and manage operational expenses',
            ],
            [
                'name'        => 'View Expenses',
                'slug'        => 'expenses:view',
                'module'      => 'expenses',
                'description' => 'View operational expense records',
            ],
            [
                'name'        => 'Manage Expenses',
                'slug'        => 'expenses:manage',
                'module'      => 'expenses',
                'description' => 'Record, edit, and categorize company expenses',
            ],

            // Staff Payroll
            [
                'name'        => 'All Staff Payroll Permissions',
                'slug'        => 'payroll:*',
                'module'      => 'payroll',
                'description' => 'Full access to view, generate, and manage staff payroll',
            ],
            [
                'name'        => 'View Staff Payroll',
                'slug'        => 'payroll:view',
                'module'      => 'payroll',
                'description' => 'Browse staff salary periods, benefits, deductions, and net pay',
            ],
            [
                'name'        => 'Manage Staff Payroll',
                'slug'        => 'payroll:manage',
                'module'      => 'payroll',
                'description' => 'Generate payroll periods, adjust overtime, leave, and benefits',
            ],

            // Reports & Analytics
            [
                'name'        => 'View Reports',
                'slug'        => 'reports:view',
                'module'      => 'reports',
                'description' => 'Access revenue, profit, inventory, and sales analytics',
            ],
            [
                'name'        => 'Export Reports Data',
                'slug'        => 'reports:export',
                'module'      => 'reports',
                'description' => 'Export sales, inventory, and expense ledgers to Excel / PDF',
            ],

            // Users & Security
            [
                'name'        => 'All Users Permissions',
                'slug'        => 'users:*',
                'module'      => 'users',
                'description' => 'Full unrestricted access to staff profiles, permissions, performance, and raises',
            ],
            [
                'name'        => 'View Users',
                'slug'        => 'users:view',
                'module'      => 'users',
                'description' => 'View staff user profiles, performance metrics, and salary history',
            ],
            [
                'name'        => 'Manage Users',
                'slug'        => 'users:manage',
                'module'      => 'users',
                'description' => 'Create, edit, view, and delete staff accounts and grant salary raises',
            ],
            [
                'name'        => 'Manage Roles',
                'slug'        => 'roles:manage',
                'module'      => 'roles',
                'description' => 'Inspect and configure role dynamic permissions',
            ],
            [
                'name'        => 'View Audit Logs',
                'slug'        => 'audit:view',
                'module'      => 'audit',
                'description' => 'View administrative and security audit trail',
            ],

            // Settings
            [
                'name'        => 'All Settings Permissions',
                'slug'        => 'settings:*',
                'module'      => 'settings',
                'description' => 'Manage store settings and global configurations',
            ],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                ['slug' => $permission['slug']],
                $permission
            );
        }
    }
}
