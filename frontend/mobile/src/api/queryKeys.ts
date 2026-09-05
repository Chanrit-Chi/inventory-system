/**
 * Hierarchical Query Key Factory for TanStack Query
 * Ensures predictable cache keys, type safety, and granular invalidation.
 */
const EMPTY_FILTERS = Object.freeze({})

export const queryKeys = {
  // Authentication & Profile
  auth: {
    me: ['auth', 'me'] as const,
    permissions: ['auth', 'permissions'] as const,
  },

  // Products & Categories
  products: {
    all: ['products'] as const,
    list: (filters?: any) => ['products', 'list', filters ?? EMPTY_FILTERS] as const,
    infinite: (filters?: any) => ['products', 'infinite', filters ?? EMPTY_FILTERS] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    search: (term: string) => ['products', 'search', term] as const,
    barcode: (barcode: string) => ['products', 'barcode', barcode] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },
  attributes: {
    all: ['attributes'] as const,
    list: () => ['attributes', 'list'] as const,
  },

  // Sales Channels & Branding
  channels: {
    all: ['channels'] as const,
    list: () => ['channels', 'list'] as const,
  },
  branding: {
    current: ['branding', 'current'] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    list: (filters?: any) => ['customers', 'list', filters ?? EMPTY_FILTERS] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    search: (query: string) => ['customers', 'search', query] as const,
  },

  // Orders & POS Transactions
  orders: {
    all: ['orders'] as const,
    list: (filters?: any) => ['orders', 'list', filters ?? EMPTY_FILTERS] as const,
    infinite: (filters?: any) => ['orders', 'infinite', filters ?? EMPTY_FILTERS] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },

  // Invoices & Quotations
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: any) => ['invoices', 'list', filters ?? EMPTY_FILTERS] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  },
  quotations: {
    all: ['quotations'] as const,
    list: (filters?: any) => ['quotations', 'list', filters ?? EMPTY_FILTERS] as const,
    detail: (id: string) => ['quotations', 'detail', id] as const,
  },

  // Inventory & Stock Movements
  inventory: {
    all: ['inventory'] as const,
    movements: (filters?: any) => ['inventory', 'movements', filters ?? EMPTY_FILTERS] as const,
    stockLevels: (productId?: string) => ['inventory', 'stock-levels', productId ?? 'all'] as const,
  },

  // Financials (Expenses & Payroll)
  expenses: {
    all: ['expenses'] as const,
    list: (filters?: any) => ['expenses', 'list', filters ?? EMPTY_FILTERS] as const,
  },
  payroll: {
    all: ['payroll'] as const,
    list: (filters?: any) => ['payroll', 'list', filters ?? EMPTY_FILTERS] as const,
    period: (period: string) => ['payroll', 'period', period] as const,
  },

  // Administration, Staff & RBAC
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  roles: {
    all: ['roles'] as const,
    list: () => ['roles', 'list'] as const,
    permissions: () => ['roles', 'permissions'] as const,
  },
  staff: {
    performance: (filters?: any) => ['staff', 'performance', filters ?? EMPTY_FILTERS] as const,
    incentives: (filters?: any) => ['staff', 'incentives', filters ?? EMPTY_FILTERS] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
  },

  // Reports & Analytics
  reports: {
    all: ['reports'] as const,
    analytics: (filters?: any) => ['reports', 'analytics', filters ?? EMPTY_FILTERS] as const,
  },
} as const
