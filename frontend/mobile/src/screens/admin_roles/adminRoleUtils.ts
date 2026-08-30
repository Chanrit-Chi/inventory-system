import { Ionicons } from '@expo/vector-icons'
import type { RoleItem, PermissionItem } from '../../types'

export interface PermissionModuleGroup {
  id: string
  name: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  permissions: PermissionItem[]
}

export const DEFAULT_ROLES: RoleItem[] = [
  {
    id: 'role-super-admin',
    name: 'Super Admin',
    slug: 'SUPER_ADMIN',
    description: 'Full unrestricted system-wide administrative access',
    permissions: ['*'],
    users_count: 0,
  },
  {
    id: 'role-admin',
    name: 'Admin',
    slug: 'ADMIN',
    description: 'Operations administrator with broad management access',
    permissions: [
      'products:*',
      'categories:manage',
      'attributes:manage',
      'inventory:*',
      'suppliers:*',
      'purchase-orders:*',
      'pos:*',
      'sales:*',
      'invoices:*',
      'quotations:*',
      'customers:*',
      'delivery:*',
      'payment-methods:*',
      'channels:*',
      'expenses:*',
      'payroll:*',
      'reports:view',
      'reports:export',
      'users:manage',
      'roles:manage',
      'audit:view',
      'settings:*',
    ],
    users_count: 0,
  },
  {
    id: 'role-manager',
    name: 'Manager',
    slug: 'MANAGER',
    description: 'Store manager handling inventory, sales, and daily operations',
    permissions: [
      'products:read',
      'categories:manage',
      'attributes:manage',
      'inventory:adjust',
      'inventory:restock',
      'inventory:scan',
      'suppliers:view',
      'purchase-orders:*',
      'pos:*',
      'sales:*',
      'invoices:*',
      'quotations:*',
      'customers:*',
      'delivery:view',
      'payment-methods:view',
      'channels:view',
      'expenses:*',
      'payroll:view',
      'reports:view',
      'reports:export',
    ],
    users_count: 0,
  },
  {
    id: 'role-seller',
    name: 'Seller',
    slug: 'SELLER',
    description: 'Cashier & floor sales associate with POS and catalog access',
    permissions: [
      'pos:checkout',
      'inventory:scan',
      'quotations:create',
      'invoices:view',
      'invoices:record-payment',
      'customers:view',
      'transactions:view',
      'delivery:view',
    ],
    users_count: 0,
  },
]

export const DEFAULT_PERMISSIONS: PermissionItem[] = [
  // Products & Catalog
  { id: 'p-prod-all', slug: 'products:*', name: 'Full Products Management', module: 'products', description: 'Unrestricted access to view, create, edit, and delete products' },
  { id: 'p-prod-read', slug: 'products:read', name: 'View Product Catalog', module: 'products', description: 'Browse products, categories, variants, and pricing' },
  { id: 'p-prod-create', slug: 'products:create', name: 'Create Products & Variants', module: 'products', description: 'Add new product listings and SKU variations' },
  { id: 'p-prod-update', slug: 'products:update', name: 'Edit Product Details', module: 'products', description: 'Modify prices, barcodes, categories, and inventory thresholds' },
  { id: 'p-prod-delete', slug: 'products:delete', name: 'Delete Products', module: 'products', description: 'Permanently remove products and variants from catalog' },
  { id: 'p-cat-manage', slug: 'categories:manage', name: 'Manage Categories', module: 'products', description: 'Organize product hierarchies, categories, and collections' },
  { id: 'p-attr-manage', slug: 'attributes:manage', name: 'Manage Attributes & Units', module: 'products', description: 'Configure product attributes, variants, and measurement units' },

  // Sales & POS
  { id: 'p-sales-all', slug: 'sales:*', name: 'Full Sales & Orders Access', module: 'sales', description: 'Complete management over orders, invoices, and sales channels' },
  { id: 'p-pos-all', slug: 'pos:*', name: 'Full POS Register', module: 'sales', description: 'Access register, barcode scanner, discounts, and payments' },
  { id: 'p-pos-checkout', slug: 'pos:checkout', name: 'Process Checkout', module: 'sales', description: 'Ring up sales, scan items, and collect cash or digital payments' },
  { id: 'p-quote-all', slug: 'quotations:*', name: 'Full Quotations Access', module: 'quotations', description: 'Create, edit, convert, and manage customer price quotes' },
  { id: 'p-quote-create', slug: 'quotations:create', name: 'Create Quotations', module: 'quotations', description: 'Generate price estimates and draft quotes for clients' },
  { id: 'p-trans-view', slug: 'transactions:view', name: 'View Order History', module: 'sales', description: 'Review receipts, historical orders, and transaction details' },

  // Invoices & Billing
  { id: 'p-invc-all', slug: 'invoices:*', name: 'Full Invoices Access', module: 'invoices', description: 'Full access to invoices, billing statements, and payments' },
  { id: 'p-invc-view', slug: 'invoices:view', name: 'View Invoices', module: 'invoices', description: 'View billing invoices, payment statuses, and balances due' },
  { id: 'p-invc-create', slug: 'invoices:create', name: 'Create Invoices', module: 'invoices', description: 'Generate billing invoices from sales orders or quotes' },
  { id: 'p-invc-pay', slug: 'invoices:record-payment', name: 'Record Invoice Payments', module: 'invoices', description: 'Collect customer installments and record payments' },

  // Suppliers & Vendors
  { id: 'p-sup-all', slug: 'suppliers:*', name: 'Full Suppliers Access', module: 'suppliers', description: 'Full access to vendor directory and supplier management' },
  { id: 'p-sup-view', slug: 'suppliers:view', name: 'View Suppliers', module: 'suppliers', description: 'Browse supplier profiles, catalogs, and vendor contacts' },
  { id: 'p-sup-manage', slug: 'suppliers:manage', name: 'Manage Suppliers', module: 'suppliers', description: 'Create, edit, and delete vendor profiles and terms' },
  { id: 'p-po-all', slug: 'purchase-orders:*', name: 'Full Purchase Orders Access', module: 'suppliers', description: 'Full access to procurement purchase orders' },
  { id: 'p-po-create', slug: 'purchase-orders:create', name: 'Create Purchase Orders', module: 'suppliers', description: 'Draft and issue procurement purchase orders to suppliers' },

  // Inventory & Stock Control
  { id: 'p-inv-all', slug: 'inventory:*', name: 'Full Inventory Control', module: 'inventory', description: 'Full access to stock counts, adjustments, and purchase receiving' },
  { id: 'p-inv-adjust', slug: 'inventory:adjust', name: 'Stock Adjustments', module: 'inventory', description: 'Record shrinkage, damage, and audit count variances' },
  { id: 'p-inv-restock', slug: 'inventory:restock', name: 'Stock Intake & Receiving', module: 'inventory', description: 'Receive vendor shipments and log restock purchase batches' },
  { id: 'p-inv-scan', slug: 'inventory:scan', name: 'Barcode & SKU Scanning', module: 'inventory', description: 'Use camera scanner for fast product lookup and validation' },

  // CRM & Customers
  { id: 'p-cust-all', slug: 'customers:*', name: 'Full Customers CRM Access', module: 'customers', description: 'Full access to customer profiles and purchase history' },
  { id: 'p-cust-view', slug: 'customers:view', name: 'View Customer Profiles', module: 'customers', description: 'Lookup customer contact details and transaction logs' },
  { id: 'p-cust-manage', slug: 'customers:manage', name: 'Manage Customers', module: 'customers', description: 'Create and update customer profiles and preferences' },

  // Logistics & Delivery
  { id: 'p-del-all', slug: 'delivery:*', name: 'Full Delivery & Logistics Access', module: 'delivery', description: 'Manage delivery couriers, fee zones, and shipping settings' },
  { id: 'p-del-view', slug: 'delivery:view', name: 'View Delivery Options', module: 'delivery', description: 'View courier companies and regional delivery zones' },
  { id: 'p-del-manage', slug: 'delivery:manage', name: 'Manage Logistics Settings', module: 'delivery', description: 'Configure courier companies, delivery zones, and fees' },

  // Payment & Banking
  { id: 'p-pay-all', slug: 'payment-methods:*', name: 'Full Payment Methods Access', module: 'banking', description: 'Configure bank transfer accounts, cash, and QR payment methods' },
  { id: 'p-pay-view', slug: 'payment-methods:view', name: 'View Payment Methods', module: 'banking', description: 'View configured bank accounts and payment accounts' },
  { id: 'p-pay-manage', slug: 'payment-methods:manage', name: 'Manage Bank Accounts', module: 'banking', description: 'Add, update, and manage bank accounts and QR configurations' },

  // Channels & Integration
  { id: 'p-chan-all', slug: 'channels:*', name: 'Full Sales Channels Access', module: 'channels', description: 'Configure online and offline omnichannel streams' },
  { id: 'p-chan-view', slug: 'channels:view', name: 'View Sales Channels', module: 'channels', description: 'Browse active sales channels and integrations' },
  { id: 'p-chan-manage', slug: 'channels:manage', name: 'Manage Sales Channels', module: 'channels', description: 'Add and configure social media and web store channels' },

  // Expenses
  { id: 'p-exp-all', slug: 'expenses:*', name: 'Full Expenses Management', module: 'expenses', description: 'View and log operational expenses, receipts, and categories' },
  { id: 'p-exp-view', slug: 'expenses:view', name: 'View Expense Logs', module: 'expenses', description: 'Browse company operational expenditure and receipts' },
  { id: 'p-exp-create', slug: 'expenses:create', name: 'Record Expenses', module: 'expenses', description: 'Log new operational and store expenditures' },

  // Payroll
  { id: 'p-payr-all', slug: 'payroll:*', name: 'Full Payroll Access', module: 'payroll', description: 'Manage employee compensation, commissions, and salary payouts' },
  { id: 'p-payr-view', slug: 'payroll:view', name: 'View Payroll & Staff', module: 'payroll', description: 'Browse staff compensation records and commission summaries' },
  { id: 'p-payr-manage', slug: 'payroll:manage', name: 'Process Payroll Runs', module: 'payroll', description: 'Calculate and process salary payments and staff disbursements' },

  // Analytics & Reports
  { id: 'p-rep-view', slug: 'reports:view', name: 'View Analytics & Dashboard', module: 'reports', description: 'Access revenue metrics, inventory turnover, and sales charts' },
  { id: 'p-rep-export', slug: 'reports:export', name: 'Export Reports (CSV/PDF)', module: 'reports', description: 'Download analytical datasets and financial summaries' },

  // System Administration
  { id: 'p-users-manage', slug: 'users:manage', name: 'Manage Staff Users', module: 'admin', description: 'Invite staff members, assign roles, and reset passwords' },
  { id: 'p-roles-manage', slug: 'roles:manage', name: 'Manage Roles & Permissions', module: 'admin', description: 'Configure granular permission sets and assign role privileges' },
  { id: 'p-audit-view', slug: 'audit:view', name: 'View Security Audit Logs', module: 'admin', description: 'Inspect timestamped staff activity and authentication events' },
  { id: 'p-settings-all', slug: 'settings:*', name: 'Manage Store Settings', module: 'admin', description: 'Configure thermal printers, store identity, branding, and system diagnostics' },
]

export const MODULE_META: Record<
  string,
  { name: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  products: { name: 'Products & Catalog', icon: 'cube-outline', color: '#6366F1' },
  sales: { name: 'Sales & POS', icon: 'cart-outline', color: '#10B981' },
  quotations: { name: 'Price Quotations', icon: 'document-text-outline', color: '#0EA5E9' },
  invoices: { name: 'Invoices & Billing', icon: 'receipt-outline', color: '#8B5CF6' },
  suppliers: { name: 'Suppliers & POs', icon: 'business-outline', color: '#F59E0B' },
  inventory: { name: 'Inventory & Stock', icon: 'layers-outline', color: '#EC4899' },
  customers: { name: 'CRM & Customers', icon: 'people-outline', color: '#14B8A6' },
  delivery: { name: 'Logistics & Delivery', icon: 'car-outline', color: '#F97316' },
  banking: { name: 'Payment & Banking', icon: 'card-outline', color: '#06B6D4' },
  channels: { name: 'Sales Channels', icon: 'share-social-outline', color: '#84CC16' },
  expenses: { name: 'Store Expenses', icon: 'wallet-outline', color: '#EF4444' },
  payroll: { name: 'Staff Payroll', icon: 'cash-outline', color: '#10B981' },
  reports: { name: 'Reports & Analytics', icon: 'bar-chart-outline', color: '#3B82F6' },
  admin: { name: 'System Administration', icon: 'shield-checkmark-outline', color: '#6366F1' },
}

export function buildPermissionGroups(permissions: PermissionItem[]): PermissionModuleGroup[] {
  const groups: Record<string, PermissionItem[]> = {}
  permissions.forEach((perm) => {
    const mod = perm.module || 'admin'
    if (!groups[mod]) groups[mod] = []
    groups[mod].push(perm)
  })

  return Object.entries(groups).map(([mod, perms]) => {
    const meta = MODULE_META[mod] || {
      name: mod.charAt(0).toUpperCase() + mod.slice(1),
      icon: 'key-outline',
      color: '#64748B',
    }
    return {
      id: mod,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      permissions: perms,
    }
  })
}
