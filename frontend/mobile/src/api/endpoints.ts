import apiClient from './client'
import type {
  ApiResponse,
  PaginatedData,
  ScanResult,
  Customer,
  SalesChannel,
  CheckoutPayload,
  Order,
  Product,
  RestockPayload,
  RestockResponse,
  UserAccount,
  DashboardSummary,
  StaffPerformanceSummary,
  RoleItem,
  PermissionItem,
  Quotation,
  QuotationStatus,
  QuotationItem,
  Invoice,
  InvoiceStatus,
  InvoicePaymentRecord,
  StoreBranding,
  Supplier,
  BankAccount,
  DeliveryCompany,
  DeliveryZone,
  StockMovementRecord,
  Payroll,
  ProductVariant,
  ProductCategory,
  AttributeTaxonomy,
  SellerDailySettlementSummary,
  SellerDailySettlementRecord,
  TeamDailySettlementSummary,
} from '../types'
import { getDeviceIdentifier } from '../utils/device'

export async function loginUser(
  email: string,
  password: string,
  deviceName?: string
): Promise<{ token: string; user: UserAccount }> {
  const resolvedDeviceName = deviceName || (await getDeviceIdentifier())
  const response = await apiClient.post<ApiResponse<{ token: string; user: UserAccount }>>('/auth/login', {
    email,
    password,
    device_name: resolvedDeviceName,
  })
  return response.data.data
}

/**
 * Fetch authenticated user profile and latest permissions
 * GET /api/v1/auth/me
 */
export async function fetchCurrentUser(): Promise<UserAccount> {
  const response = await apiClient.get<ApiResponse<UserAccount>>('/auth/me')
  return response.data.data
}

/**
 * Logout authenticated user
 * POST /api/v1/auth/logout
 */
export async function logoutUser(): Promise<{ status: string; message: string }> {
  const response = await apiClient.post('/auth/logout')
  return response.data
}

/**
 * Change the authenticated user's password
 * PATCH /api/v1/auth/password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/auth/password', { current_password: currentPassword, new_password: newPassword })
}

/**
 * Fetch all staff users (admin only)
 * GET /api/v1/users
 */
export async function fetchUsers(): Promise<UserAccount[]> {
  const response = await apiClient.get<ApiResponse<UserAccount[]>>('/users')
  return response.data.data ?? []
}

/**
 * Fetch all active staff members for operational assignment & POS seller attribution
 * GET /api/v1/staff-members
 */
export async function fetchStaffMembers(): Promise<UserAccount[]> {
  const response = await apiClient.get<ApiResponse<UserAccount[]>>('/staff-members')
  return response.data.data ?? []
}

/**
 * Fetch a single staff user by ID
 * GET /api/v1/users/:id
 */
export async function fetchUser(id: string): Promise<UserAccount | null> {
  const response = await apiClient.get<ApiResponse<UserAccount>>(`/users/${id}`)
  return response.data.data ?? null
}

/**
 * Create a new staff user
 * POST /api/v1/users
 */
export async function createUser(payload: {
  name: string
  email: string
  phone?: string
  role: string
  password: string
  department?: string
  hire_date?: string
  notes?: string
  base_salary?: number
  salary_reason?: string
}): Promise<UserAccount> {
  const response = await apiClient.post<ApiResponse<UserAccount>>('/users', payload)
  return response.data.data
}

/**
 * Update an existing staff user
 * PATCH /api/v1/users/:id
 */
export async function updateUser(id: string, payload: Partial<{
  name: string
  email: string
  phone: string
  role: string
  department: string
  hire_date: string
  notes: string
  base_salary: number
  salary_reason: string
  isActive: boolean
}>): Promise<UserAccount> {
  const response = await apiClient.patch<ApiResponse<UserAccount>>(`/users/${id}`, payload)
  return response.data.data
}

/**
 * Toggle user active/inactive status
 * PATCH /api/v1/users/:id/status
 */
export async function toggleUserStatus(id: string, isActive: boolean): Promise<UserAccount> {
  const response = await apiClient.patch<ApiResponse<UserAccount>>(`/users/${id}/status`, { is_active: isActive })
  return response.data.data
}

/**
 * Delete staff user (admin only)
 * DELETE /api/v1/users/:id
 */
export async function deleteUser(id: string): Promise<{ status: string; message: string }> {
  const response = await apiClient.delete(`/users/${id}`)
  return response.data
}

/**
 * Fetch audit log entries
 * GET /api/v1/audit-logs
 */
export interface AuditLogEntry {
  id: string
  action: string
  category?: string
  target: string
  by?: string
  actor_name?: string
  actor_role?: string
  time?: string
  occurred_at?: string
  created_at?: string
  details?: string
  ip?: string
  device?: string
  metadata?: {
    ip?: string
    device?: string
    user_agent?: string
    [key: string]: any
  } | null
}

export interface FetchAuditLogsParams {
  page?: number
  per_page?: number
  search?: string
  category?: string
  date_from?: string
  date_to?: string
}

export async function fetchAuditLogs(params?: FetchAuditLogsParams): Promise<ApiResponse<AuditLogEntry[]>> {
  const response = await apiClient.get<ApiResponse<AuditLogEntry[]>>('/audit-logs', { params })
  return response.data
}

/**
 * Scan barcode or SKU (2-tier resolution: direct variant or master product)
 * GET /api/v1/inventory/scan?code={code}
 */
export async function scanBarcode(code: string): Promise<ScanResult> {
  const trimmed = code.trim()
  try {
    const response = await apiClient.get<ApiResponse<ScanResult>>('/inventory/scan', {
      params: { code: trimmed },
    })
    if (response.data?.data) {
      return response.data.data
    }
  } catch {
    // If backend endpoint is unreachable or 404, fallback to local catalog resolution
  }

  // Fallback: search products endpoint with scoped query
  try {
    const prodRes = await apiClient.get<ApiResponse<Product[] | { data: Product[] }>>('/products', {
      params: { search: trimmed, limit: 10 },
    })
    const rawData = prodRes.data?.data
    const list: Product[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray(prodRes.data)
      ? (prodRes.data as unknown as Product[])
      : (rawData as { data?: Product[] })?.data || []

    const q = trimmed.toLowerCase()
    // 1. Look for variant match by barcode or sku
    for (const p of list) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (
            (v.barcode && v.barcode.toLowerCase() === q) ||
            (v.sku && v.sku.toLowerCase() === q)
          ) {
            return {
              type: 'variant',
              variant: {
                id: v.id,
                sku: v.sku,
                barcode: v.barcode ?? null,
                quantity_on_hand: v.quantity_on_hand ?? 0,
                selling_price: v.selling_price_override || v.selling_price || String(p.selling_price),
                selling_price_override: v.selling_price_override || null,
                attribute_values: v.attribute_values,
              },
              product: {
                id: p.id,
                name: p.name,
                selling_price: String(p.selling_price),
                barcode: p.barcode,
                image_url: p.image_url,
              },
            }
          }
        }
      }
    }

    // 2. Look for product match by barcode or sku
    for (const p of list) {
      if (
        (p.barcode && p.barcode.toLowerCase() === q) ||
        (p.sku && p.sku.toLowerCase() === q)
      ) {
        if (p.variants && p.variants.length === 1) {
          const v = p.variants[0]
          return {
            type: 'variant',
            variant: {
              id: v.id,
              sku: v.sku,
              barcode: v.barcode ?? null,
              quantity_on_hand: v.quantity_on_hand ?? 0,
              selling_price: v.selling_price_override || v.selling_price || String(p.selling_price),
              selling_price_override: v.selling_price_override || null,
              attribute_values: v.attribute_values,
            },
            product: {
              id: p.id,
              name: p.name,
              selling_price: String(p.selling_price),
              barcode: p.barcode,
              image_url: p.image_url,
            },
          }
        }
        return {
          type: 'product',
          product: {
            id: p.id,
            name: p.name,
            selling_price: String(p.selling_price),
            barcode: p.barcode,
            image_url: p.image_url,
          },
          variants: (p.variants || []).map((v) => ({
            id: v.id,
            sku: v.sku,
            barcode: v.barcode ?? null,
            quantity_on_hand: v.quantity_on_hand ?? 0,
            selling_price: v.selling_price_override || v.selling_price || String(p.selling_price),
            selling_price_override: v.selling_price_override || null,
            attribute_values: v.attribute_values,
          })),
        }
      }
    }
  } catch {
    // Fallback search finished
  }

  throw new Error(`No product found matching barcode or SKU "${code}"`)
}

/**
 * Search customers by phone number or name (high performance autocomplete)
 * GET /api/v1/customers?search={search}&limit={limit}
 */
export async function searchCustomers(search: string, limit = 10, signal?: AbortSignal): Promise<Customer[]> {
  const response = await apiClient.get<ApiResponse<PaginatedData<Customer> | Customer[]>>('/customers', {
    params: { search: search.trim(), limit },
    signal,
  })
  const responseData = response.data.data
  if (Array.isArray(responseData)) {
    return responseData
  }
  return (responseData as PaginatedData<Customer>)?.data ?? []
}

/**
 * Fetch sales channels (optionally include inactive)
 * GET /api/v1/sales-channels
 */
export async function getSalesChannels(params?: { include_inactive?: boolean; search?: string }): Promise<SalesChannel[]> {
  const response = await apiClient.get<ApiResponse<SalesChannel[]>>('/sales-channels', { params })
  return response.data.data ?? []
}

/**
 * Create sales channel
 * POST /api/v1/sales-channels
 */
export async function createSalesChannel(payload: Partial<SalesChannel>): Promise<SalesChannel> {
  const response = await apiClient.post<ApiResponse<SalesChannel>>('/sales-channels', payload)
  return response.data.data
}

/**
 * Update sales channel
 * PUT /api/v1/sales-channels/{id}
 */
export async function updateSalesChannel(id: string, payload: Partial<SalesChannel>): Promise<SalesChannel> {
  const response = await apiClient.put<ApiResponse<SalesChannel>>(`/sales-channels/${id}`, payload)
  return response.data.data
}

/**
 * Delete sales channel
 * DELETE /api/v1/sales-channels/{id}
 */
export async function deleteSalesChannel(id: string): Promise<ApiResponse<SalesChannel | null>> {
  const response = await apiClient.delete<ApiResponse<SalesChannel | null>>(`/sales-channels/${id}`)
  return response.data
}

/**
 * Submit checkout payload
 * POST /api/v1/orders/checkout
 */
export async function checkoutOrder(payload: CheckoutPayload): Promise<Order> {
  const response = await apiClient.post<ApiResponse<Order>>('/orders/checkout', payload)
  return response.data.data
}

/**
 * Get order details by ID
 * GET /api/v1/orders/{id}
 */
export async function getOrderDetails(id: string): Promise<Order> {
  const response = await apiClient.get<ApiResponse<Order>>(`/orders/${id}`)
  return response.data.data
}

/**
 * Update order status (COMPLETED, PENDING, CANCELLED)
 * PATCH /api/v1/orders/{id}/status
 */
export async function updateOrderStatus(
  id: string,
  status: 'completed' | 'pending' | 'cancelled' | string,
  paymentMethod?: string,
  notes?: string
): Promise<Order> {
  const response = await apiClient.patch<ApiResponse<Order>>(`/orders/${id}/status`, {
    status,
    payment_method: paymentMethod,
    notes,
  })
  return response.data.data
}

/**
 * Update order details (notes, delivery address, region, payment method)
 * PATCH /api/v1/orders/{id}
 */
export async function updateOrder(
  id: string,
  payload: {
    status?: string
    payment_method?: string
    notes?: string
    delivery_address?: string
    region?: string
    seller_id?: string | null
  }
): Promise<Order> {
  const response = await apiClient.patch<ApiResponse<Order>>(`/orders/${id}`, payload)
  return response.data.data
}

/**
 * Fetch paginated product catalog with category and search filters
 * GET /api/v1/products
 */
export async function getProducts(params?: {
  search?: string
  category_id?: string
  is_active?: boolean | string
  include_inactive?: boolean
  page?: number
  per_page?: number
}): Promise<ApiResponse<Product[]>> {
  const response = await apiClient.get<ApiResponse<Product[]>>('/products', {
    params,
  })
  return response.data
}

/**
 * Fetch paginated variants with filters
 * GET /api/v1/variants
 */
export async function getVariants(params?: {
  search?: string
  product_id?: string
  category_id?: string
  is_active?: boolean | string
  include_inactive?: boolean
  page?: number
  per_page?: number
}): Promise<ApiResponse<ProductVariant[]>> {
  const response = await apiClient.get<ApiResponse<ProductVariant[]>>('/variants', {
    params,
  })
  return response.data
}

/**
 * Update single variant
 * PATCH /api/v1/variants/{id}
 */
export async function updateVariant(
  id: string,
  payload: Partial<ProductVariant>
): Promise<ApiResponse<ProductVariant>> {
  const response = await apiClient.patch<ApiResponse<ProductVariant>>(`/variants/${id}`, payload)
  return response.data
}

/**
 * Fetch searchable and filterable order history
 * GET /api/v1/orders
 */
export async function getOrders(params?: {
  search?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}): Promise<ApiResponse<Order[]>> {
  const response = await apiClient.get<ApiResponse<Order[]>>('/orders', {
    params,
  })
  return response.data
}

/**
 * Batch restock inventory / receiving intake
 * POST /api/v1/inventory/restock
 */
export async function restockInventory(payload: RestockPayload): Promise<ApiResponse<RestockResponse>> {
  const response = await apiClient.post<ApiResponse<RestockResponse>>('/inventory/restock', payload)
  return response.data
}

/**
 * Check backend system health and diagnostics
 * GET /api/v1/health
 */
export async function getHealth(): Promise<
  ApiResponse<{ status: string; version: string; app: string; database?: string }>
> {
  const response = await apiClient.get<
    ApiResponse<{ status: string; version: string; app: string; database?: string }>
  >('/health')
  return response.data
}

/**
 * Fetch live dashboard summary metrics for today
 * GET /api/v1/dashboard/summary
 */
export async function getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
  const response = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary')
  return response.data
}

/**
 * Fetch staff performance leaderboard
 * GET /api/v1/dashboard/staff-performance?period=today|week|month
 */
export async function getStaffPerformance(period: 'today' | 'week' | 'month' = 'today'): Promise<ApiResponse<StaffPerformanceSummary>> {
  const response = await apiClient.get<ApiResponse<StaffPerformanceSummary>>('/dashboard/staff-performance', { params: { period } })
  return response.data
}

/**
 * Fetch all roles with their assigned permissions (Super Admin only)
 * GET /api/v1/roles
 */
export async function fetchRoles(): Promise<ApiResponse<RoleItem[]>> {
  const response = await apiClient.get<ApiResponse<RoleItem[]>>('/roles')
  return response.data
}

/**
 * Fetch all system permissions catalog (Super Admin only)
 * GET /api/v1/permissions
 */
export async function fetchPermissions(): Promise<ApiResponse<PermissionItem[]>> {
  const response = await apiClient.get<ApiResponse<PermissionItem[]>>('/permissions')
  return response.data
}

/**
 * Update assigned permissions for a role (Super Admin only)
 * PUT /api/v1/roles/:roleId/permissions
 */
export async function updateRolePermissions(
  roleId: string,
  permissions: string[]
): Promise<ApiResponse<RoleItem>> {
  const response = await apiClient.put<ApiResponse<RoleItem>>(`/roles/${roleId}/permissions`, {
    permissions,
  })
  return response.data
}

/**
 * Fetch operational expenses with date and category filters
 * GET /api/v1/expenses
 */
export interface BackendExpense {
  id: string
  title?: string | null
  expense_date: string
  category: string
  amount: number | string
  payment_method: string
  notes?: string | null
  user_id?: string | null
  created_by?: string | null
  user?: {
    id: string
    name: string
    role?: string
  } | null
  created_at?: string
  updated_at?: string
}

export async function fetchExpenses(params?: {
  search?: string
  category?: string
  date_from?: string
  date_to?: string
  payment_method?: string
  page?: number
  per_page?: number
}): Promise<ApiResponse<PaginatedData<BackendExpense> | BackendExpense[]>> {
  const response = await apiClient.get<ApiResponse<PaginatedData<BackendExpense> | BackendExpense[]>>('/expenses', { params })
  return response.data
}

/**
 * Record a new operational expense
 * POST /api/v1/expenses
 */
export async function createExpense(payload: {
  title?: string
  expense_date: string
  category: string
  amount: number
  payment_method: string
  notes?: string
}): Promise<ApiResponse<BackendExpense>> {
  const response = await apiClient.post<ApiResponse<BackendExpense>>('/expenses', payload)
  return response.data
}

/**
 * Delete an expense record
 * DELETE /api/v1/expenses/:id
 */
export async function deleteExpense(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/expenses/${id}`)
  return response.data
}

/**
 * Fetch customers directory
 * GET /api/v1/customers
 */
export async function fetchCustomers(params?: { search?: string; page?: number }): Promise<ApiResponse<PaginatedData<Customer> | Customer[]>> {
  const response = await apiClient.get<ApiResponse<PaginatedData<Customer> | Customer[]>>('/customers', { params })
  return response.data
}

/**
 * Get customer details by ID
 * GET /api/v1/customers/:id
 */
export async function getCustomerDetails(id: string): Promise<ApiResponse<Customer>> {
  const response = await apiClient.get<ApiResponse<Customer>>(`/customers/${id}`)
  return response.data
}

/**
 * Fetch product categories
 * GET /api/v1/categories
 */
export async function fetchCategories(): Promise<ApiResponse<ProductCategory[]>> {
  const response = await apiClient.get<ApiResponse<ProductCategory[]>>('/categories')
  return response.data
}

/**
 * Create a new product category
 * POST /api/v1/categories
 */
export async function createCategory(payload: { name: string; code?: string; description?: string }): Promise<ApiResponse<ProductCategory>> {
  const response = await apiClient.post<ApiResponse<ProductCategory>>('/categories', payload)
  return response.data
}

/**
 * Update an existing product category
 * PUT /api/v1/categories/:id
 */
export async function updateCategory(id: string, payload: { name: string; code?: string; description?: string }): Promise<ApiResponse<ProductCategory>> {
  const response = await apiClient.put<ApiResponse<ProductCategory>>(`/categories/${id}`, payload)
  return response.data
}

/**
 * Delete an unlinked product category
 * DELETE /api/v1/categories/:id
 */
export async function deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete(`/categories/${id}`)
  return response.data
}

/**
 * Fetch product attributes and taxonomy
 * GET /api/v1/attributes
 */
export async function fetchAttributes(): Promise<ApiResponse<AttributeTaxonomy[]>> {
  const response = await apiClient.get<ApiResponse<AttributeTaxonomy[]>>('/attributes')
  return response.data
}

/**
 * Create a new product attribute
 * POST /api/v1/attributes
 */
export async function createAttribute(payload: { name: string; code?: string; values?: string[] }): Promise<ApiResponse<AttributeTaxonomy>> {
  const response = await apiClient.post<ApiResponse<AttributeTaxonomy>>('/attributes', payload)
  return response.data
}

/**
 * Delete an unlinked attribute
 * DELETE /api/v1/attributes/:id
 */
export async function deleteAttribute(id: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete(`/attributes/${id}`)
  return response.data
}


/**
 * Adjust variant inventory stock count
 * POST /api/v1/inventory/adjust
 */
export async function adjustStock(payload: {
  variant_id: string
  new_quantity: number
  current_quantity?: number
  difference?: number
  reason: string
  notes?: string
  adjusted_at?: string
  client_mutation_id?: string
}): Promise<ApiResponse<{ variant_id: string; new_quantity: number; difference: number; reason: string }>> {
  const response = await apiClient.post<ApiResponse<{ variant_id: string; new_quantity: number; difference: number; reason: string }>>('/inventory/adjust', payload)
  return response.data
}

/**
 * Fetch cursor-paginated stock movement log
 * GET /api/v1/inventory/movements
 *
 * @param params.product_id - optional: filter to a single product
 * @param params.cursor     - optional: opaque cursor from the previous page response
 * @param params.per_page   - optional: records per page (default 30, max 100)
 */
export async function fetchStockMovements(params?: {
  product_id?: string
  cursor?: string | null
  per_page?: number
}): Promise<{
  data: StockMovementRecord[]
  next_cursor: string | null
  has_more: boolean
}> {
  const query: Record<string, string | number> = {
    per_page: params?.per_page ?? 30,
  }
  if (params?.product_id) query.product_id = params.product_id
  if (params?.cursor)     query.cursor      = params.cursor

  const response = await apiClient.get<ApiResponse<{
    data: StockMovementRecord[]
    next_cursor: string | null
    has_more: boolean
  }>>('/inventory/movements', { params: query })

  return response.data.data as {
    data: StockMovementRecord[]
    next_cursor: string | null
    has_more: boolean
  }
}

/**
 * Create product catalog entry
 * POST /api/v1/products
 */
export async function createProduct(payload: FormData | Record<string, unknown>): Promise<ApiResponse<Product>> {
  const response = await apiClient.post<ApiResponse<Product>>('/products', payload)
  return response.data
}

/**
 * Update existing product
 * PUT /api/v1/products/:id
 */
export async function updateProduct(id: string, payload: FormData | Record<string, unknown>): Promise<ApiResponse<Product>> {
  const response = await apiClient.put<ApiResponse<Product>>(`/products/${id}`, payload)
  return response.data
}

/**
 * Delete product from catalog
 * DELETE /api/v1/products/:id
 */
export async function deleteProduct(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/products/${id}`)
  return response.data
}

/**
 * Fetch comprehensive real-time analytics report with custom range or single date
 * GET /api/v1/reports/analytics
 */
export interface AnalyticsReportData {
  period: string
  date_from: string
  date_to: string
  revenue: number
  ordersCount: number
  avgTicket: number
  profit: number
  expenses: number
  netProfit: number
  topProducts: Array<{ name: string; sales: number; revenue: number }>
  chartBars: Array<{ label: string; val: number }>
}

export async function fetchAnalyticsReport(params?: {
  period?: 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'
  date?: string
  date_from?: string
  date_to?: string
}): Promise<ApiResponse<AnalyticsReportData>> {
  const response = await apiClient.get<ApiResponse<AnalyticsReportData>>('/reports/analytics', { params })
  return response.data
}

/**
 * Fetch all quotations with optional search & status filter
 * GET /api/v1/quotations
 */
export async function fetchQuotations(params?: {
  search?: string
  status?: string
  page?: number
  per_page?: number
}): Promise<ApiResponse<PaginatedData<Quotation> | Quotation[]>> {
  const response = await apiClient.get<ApiResponse<PaginatedData<Quotation> | Quotation[]>>('/quotations', { params })
  return response.data
}

/**
 * Create a new quotation / price estimate
 * POST /api/v1/quotations
 */
export async function createQuotation(payload: {
  customer_id?: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  discount?: number
  notes?: string
  valid_until?: string
  items: Array<{
    variant_id?: string
    product_name: string
    sku?: string
    quantity: number
    unit_price: number
  }>
}): Promise<ApiResponse<Quotation>> {
  const response = await apiClient.post<ApiResponse<Quotation>>('/quotations', payload)
  return response.data
}

/**
 * Update quotation status (DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED)
 * PATCH /api/v1/quotations/:id/status
 */
export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus
): Promise<ApiResponse<Quotation>> {
  const response = await apiClient.patch<ApiResponse<Quotation>>(`/quotations/${id}/status`, { status })
  return response.data
}

/**
 * Convert quotation to sale order
 * POST /api/v1/quotations/:id/convert
 */
export async function convertQuotation(
  id: string
): Promise<ApiResponse<{ quotation: Quotation; items: QuotationItem[] }>> {
  const response = await apiClient.post<ApiResponse<{ quotation: Quotation; items: QuotationItem[] }>>(`/quotations/${id}/convert`)
  return response.data
}

/**
 * Delete quotation
 * DELETE /api/v1/quotations/:id
 */
export async function deleteQuotation(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/quotations/${id}`)
  return response.data
}

/**
 * Fetch all invoices with optional search & status filter
 * GET /api/v1/invoices
 */
export async function fetchInvoices(params?: {
  search?: string
  status?: string
  page?: number
  per_page?: number
}): Promise<ApiResponse<PaginatedData<Invoice> | Invoice[]>> {
  const response = await apiClient.get<ApiResponse<PaginatedData<Invoice> | Invoice[]>>('/invoices', { params })
  return response.data
}

/**
 * Create a new invoice
 * POST /api/v1/invoices
 */
export async function createInvoice(payload: {
  order_id?: string
  order_number?: string
  customer_id?: string
  customer_name: string
  customer_phone?: string
  due_date?: string
  notes?: string
  items: Array<{
    product_name: string
    sku?: string
    quantity: number
    unit_price: number
  }>
}): Promise<ApiResponse<Invoice>> {
  const response = await apiClient.post<ApiResponse<Invoice>>('/invoices', payload)
  return response.data
}

/**
 * Record a payment against an outstanding invoice
 * POST /api/v1/invoices/:id/payments
 */
export async function recordInvoicePayment(
  invoiceId: string,
  payload: {
    amount: number
    payment_method: string
    transaction_ref?: string
    recorded_by?: string
    notes?: string
  }
): Promise<ApiResponse<{ payment: InvoicePaymentRecord; invoice: Invoice }>> {
  const response = await apiClient.post<ApiResponse<{ payment: InvoicePaymentRecord; invoice: Invoice }>>(
    `/invoices/${invoiceId}/payments`,
    payload
  )
  return response.data
}

/**
 * Update invoice status
 * PATCH /api/v1/invoices/:id/status
 */
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<ApiResponse<Invoice>> {
  const response = await apiClient.patch<ApiResponse<Invoice>>(`/invoices/${id}/status`, { status })
  return response.data
}

/**
 * Delete invoice
 * DELETE /api/v1/invoices/:id
 */
export async function deleteInvoice(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/invoices/${id}`)
  return response.data
}

/**
 * Send raw ESC/POS binary data to thermal network printer on Port 9100.
 * Data is Base64-encoded so ESC/POS control bytes (\x1B, \x1D, etc.) survive
 * JSON serialization without being stripped or corrupted.
 * POST /api/v1/printer/raw-print
 */
export async function sendRawPrint(payload: {
  ip: string
  port?: number
  data: string
}): Promise<ApiResponse<{ message: string }>> {
  // Convert the ESC/POS string (which contains raw bytes) to Base64
  // so control characters survive the JSON round-trip intact.
  const encoded = btoa(
    encodeURIComponent(payload.data).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
  const response = await apiClient.post<ApiResponse<{ message: string }>>('/printer/raw-print', {
    ...payload,
    data: encoded,
    encoding: 'base64',
  })
  return response.data
}



/**
 * Fetch current store branding configuration
 * GET /api/v1/settings/branding
 */
export async function getStoreBranding(): Promise<StoreBranding> {
  const response = await apiClient.get<ApiResponse<StoreBranding>>('/settings/branding')
  return response.data.data
}

/**
 * Update store branding configuration
 * POST /api/v1/settings/branding
 */
export async function updateStoreBranding(
  payload: Partial<StoreBranding> & { logoFile?: { uri: string; name: string; type: string }; remove_logo?: boolean }
): Promise<StoreBranding> {
  if (payload.logoFile) {
    const formData = new FormData()
    if (payload.store_name) formData.append('store_name', payload.store_name)
    if (payload.tagline !== undefined) formData.append('tagline', payload.tagline || '')
    if (payload.store_address !== undefined) formData.append('store_address', payload.store_address || '')
    if (payload.store_phone !== undefined) formData.append('store_phone', payload.store_phone || '')
    if (payload.primary_color !== undefined) formData.append('primary_color', payload.primary_color || '#005F83')
    if (payload.receipt_header !== undefined) formData.append('receipt_header', payload.receipt_header || '')
    if (payload.invoice_header !== undefined) formData.append('invoice_header', payload.invoice_header || '')
    if (payload.quotation_header !== undefined) formData.append('quotation_header', payload.quotation_header || '')
    if (payload.receipt_footer !== undefined) formData.append('receipt_footer', payload.receipt_footer || '')

    formData.append('logo', {
      uri: payload.logoFile.uri,
      name: payload.logoFile.name || 'store_logo.png',
      type: payload.logoFile.type || 'image/png',
    } as any)

    const response = await apiClient.post<ApiResponse<StoreBranding>>('/settings/branding', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.data
  } else {
    const response = await apiClient.post<ApiResponse<StoreBranding>>('/settings/branding', payload)
    return response.data.data
  }
}

/**
 * Fetch all registered suppliers
 * GET /api/v1/suppliers
 */
export async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  const response = await apiClient.get<ApiResponse<Supplier[]>>('/suppliers', {
    params: search ? { search } : undefined,
  })
  return response.data.data ?? []
}

/**
 * Create a new supplier
 * POST /api/v1/suppliers
 */
export async function createSupplier(payload: {
  name: string
  contact_person?: string
  phone: string
  email?: string
  address?: string
  lead_time_days?: number
  payment_terms?: string
  tax_id?: string
  notes?: string
}): Promise<Supplier> {
  const response = await apiClient.post<ApiResponse<Supplier>>('/suppliers', payload)
  return response.data.data
}

/**
 * Update an existing supplier
 * PUT/PATCH /api/v1/suppliers/:id
 */
export async function updateSupplier(id: string, payload: Partial<{
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
  lead_time_days: number
  payment_terms: string
  tax_id: string
  notes: string
  is_active: boolean
}>): Promise<Supplier> {
  const response = await apiClient.patch<ApiResponse<Supplier>>(`/suppliers/${id}`, payload)
  return response.data.data
}

/**
 * Delete a supplier
 * DELETE /api/v1/suppliers/:id
 */
export async function deleteSupplier(id: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete(`/suppliers/${id}`)
  return response.data
}

/**
 * Fetch payrolls for a given month and year
 * GET /api/v1/payrolls
 */
export async function fetchPayrolls(params?: { month?: number, year?: number }): Promise<ApiResponse<import('../types').Payroll[]>> {
  const response = await apiClient.get<ApiResponse<import('../types').Payroll[]>>('/payrolls', { params })
  return response.data
}

/**
 * Generate payroll draft for single or multiple users / batch
 * POST /api/v1/payrolls/generate
 */
export async function generatePayroll(payload: {
  user_id?: string
  user_ids?: string[]
  all_staff?: boolean
  batch?: boolean
  month: number
  year: number
}): Promise<ApiResponse<Payroll[]>> {
  const response = await apiClient.post<ApiResponse<Payroll[]>>('/payrolls/generate', payload)
  return response.data
}

/**
 * Update draft payroll manually
 * PUT /api/v1/payrolls/:id
 */
export async function updatePayroll(id: string, payload: Partial<Payroll>): Promise<ApiResponse<Payroll>> {
  const response = await apiClient.put<ApiResponse<Payroll>>(`/payrolls/${id}`, payload)
  return response.data
}

/**
 * Delete a DRAFT payroll (FINALIZED/PAID are rejected by the backend)
 * DELETE /api/v1/payrolls/:id
 */
export async function deletePayroll(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/payrolls/${id}`)
  return response.data
}

/**
 * Bulk transition payrolls to a status in one atomic request
 * POST /api/v1/payrolls/bulk-status
 */
export async function bulkUpdatePayrollStatus(payload: {
  ids: string[]
  status: 'DRAFT' | 'FINALIZED' | 'PAID'
}): Promise<ApiResponse<{ updated: number; failed: Array<{ id: string; reason: string }> }>> {
  const response = await apiClient.post<ApiResponse<{ updated: number; failed: Array<{ id: string; reason: string }> }>>(
    '/payrolls/bulk-status',
    payload
  )
  return response.data
}

/**
 * Fetch user base salary configuration
 * GET /api/v1/users/:userId/salary
 */
export async function fetchUserSalary(userId: string): Promise<ApiResponse<import('../types').UserSalary>> {
  const response = await apiClient.get<ApiResponse<import('../types').UserSalary>>(`/users/${userId}/salary`)
  return response.data
}

/**
 * Fetch salary raise history timeline for staff member
 * GET /api/v1/users/:userId/salary-history
 */
export async function fetchSalaryHistory(userId: string): Promise<ApiResponse<import('../types').SalaryHistoryResponse>> {
  const response = await apiClient.get<ApiResponse<import('../types').SalaryHistoryResponse>>(`/users/${userId}/salary-history`)
  return response.data
}

/**
 * Set user base salary configuration or schedule raise
 * POST /api/v1/users/:userId/salary
 */
export async function setUserSalary(
  userId: string,
  payload: { base_salary: number; effective_from?: string; reason?: string }
): Promise<ApiResponse<import('../types').UserSalary>> {
  const response = await apiClient.post<ApiResponse<import('../types').UserSalary>>(`/users/${userId}/salary`, payload)
  return response.data
}

/**
 * Fetch staff performance analytics & metrics
 * GET /api/v1/users/:userId/performance
 */
export async function fetchStaffPerformance(
  userId: string,
  params?: {
    period?: 'today' | '7d' | '30d' | 'month' | 'year' | 'custom'
    month?: number
    year?: number
    date_from?: string
    date_to?: string
  }
): Promise<ApiResponse<import('../types').StaffPerformance>> {
  const response = await apiClient.get<ApiResponse<import('../types').StaffPerformance>>(`/users/${userId}/performance`, {
    params,
  })
  return response.data
}

/**
 * Fetch authenticated staff member's personal performance analytics & metrics
 * GET /api/v1/my/performance
 */
export async function fetchMyPerformance(
  params?: {
    period?: 'today' | '7d' | '30d' | 'month' | 'year' | 'custom'
    month?: number
    year?: number
    date_from?: string
    date_to?: string
  }
): Promise<ApiResponse<import('../types').StaffPerformance>> {
  const response = await apiClient.get<ApiResponse<import('../types').StaffPerformance>>('/my/performance', {
    params,
  })
  return response.data
}

/**
 * Fetch authenticated staff member's personal order incentive & commission breakdown
 * GET /api/v1/my/incentives
 */
export async function fetchMyIncentives(
  params?: { month?: number; year?: number }
): Promise<ApiResponse<import('../types').StaffIncentiveBreakdown>> {
  const response = await apiClient.get<ApiResponse<import('../types').StaffIncentiveBreakdown>>('/my/incentives', {
    params,
  })
  return response.data
}

/**
 * Fetch staff order incentive & commission breakdown
 * GET /api/v1/users/:userId/incentives
 */
export async function fetchStaffIncentives(
  userId: string,
  params?: { month?: number; year?: number }
): Promise<ApiResponse<import('../types').StaffIncentiveBreakdown>> {
  const response = await apiClient.get<ApiResponse<import('../types').StaffIncentiveBreakdown>>(`/users/${userId}/incentives`, {
    params,
  })
  return response.data
}

/**
 * Fetch authenticated staff member's personal salary history
 * GET /api/v1/my/salary-history
 */
export async function fetchMySalaryHistory(): Promise<ApiResponse<import('../types').SalaryHistoryResponse>> {
  const response = await apiClient.get<ApiResponse<import('../types').SalaryHistoryResponse>>('/my/salary-history')
  return response.data
}

/**
 * Fetch authenticated staff member's personal 13th month / seniority reserve summary
 * GET /api/v1/my/savings
 */
export async function fetchMy13thMonthSavings(year?: number): Promise<ApiResponse<import('../types').ThirteenthMonthSummary>> {
  const response = await apiClient.get<ApiResponse<import('../types').ThirteenthMonthSummary>>('/my/savings', { params: { year } })
  return response.data
}

/**
 * Fetch 13th month / seniority reserve summary (accruals, payouts, available balance)
 * GET /api/v1/users/:userId/savings
 */
export async function fetch13thMonthSavings(userId: string, year?: number): Promise<ApiResponse<import('../types').ThirteenthMonthSummary>> {
  const response = await apiClient.get<ApiResponse<import('../types').ThirteenthMonthSummary>>(`/users/${userId}/savings`, { params: { year } })
  return response.data
}

/**
 * Record a standalone 13th month / seniority bonus disbursement
 * POST /api/v1/users/:userId/savings/payout
 */
export async function record13thMonthPayout(
  userId: string,
  payload: { amount: number; payout_date?: string; payment_method?: string; notes?: string }
): Promise<ApiResponse<{ payout: import('../types').ThirteenthMonthPayout; summary: import('../types').ThirteenthMonthSummary }>> {
  const response = await apiClient.post<ApiResponse<{ payout: import('../types').ThirteenthMonthPayout; summary: import('../types').ThirteenthMonthSummary }>>(
    `/users/${userId}/savings/payout`,
    payload
  )
  return response.data
}

/**
 * Upload media file (photo/image) to Cloudflare R2 / public storage
 * POST /api/v1/media/upload
 */
export async function uploadMedia(
  file: { uri: string; name: string; type: string },
  folder = 'products'
): Promise<ApiResponse<{ url: string; path: string; disk: string; filename: string }>> {
  const formData = new FormData()
  formData.append('image', file as any)
  formData.append('folder', folder)
  const response = await apiClient.post<ApiResponse<{ url: string; path: string; disk: string; filename: string }>>(
    '/media/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}

// ============================================================================
// DELIVERY COMPANIES API
// ============================================================================

export async function fetchDeliveryCompanies(params?: { include_inactive?: boolean; search?: string }): Promise<ApiResponse<DeliveryCompany[]>> {
  const response = await apiClient.get<ApiResponse<DeliveryCompany[]>>('/delivery-companies', { params })
  return response.data
}

export async function createDeliveryCompany(payload: Partial<DeliveryCompany>): Promise<ApiResponse<DeliveryCompany>> {
  const response = await apiClient.post<ApiResponse<DeliveryCompany>>('/delivery-companies', payload)
  return response.data
}

export async function updateDeliveryCompany(id: string, payload: Partial<DeliveryCompany>): Promise<ApiResponse<DeliveryCompany>> {
  const response = await apiClient.put<ApiResponse<DeliveryCompany>>(`/delivery-companies/${id}`, payload)
  return response.data
}

export async function deleteDeliveryCompany(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/delivery-companies/${id}`)
  return response.data
}

// ============================================================================
// DELIVERY ZONES API
// ============================================================================

export async function fetchDeliveryZones(params?: { include_inactive?: boolean; search?: string }): Promise<ApiResponse<DeliveryZone[]>> {
  const response = await apiClient.get<ApiResponse<DeliveryZone[]>>('/delivery-zones', { params })
  return response.data
}

export async function createDeliveryZone(payload: Partial<DeliveryZone>): Promise<ApiResponse<DeliveryZone>> {
  const response = await apiClient.post<ApiResponse<DeliveryZone>>('/delivery-zones', payload)
  return response.data
}

export async function updateDeliveryZone(id: string, payload: Partial<DeliveryZone>): Promise<ApiResponse<DeliveryZone>> {
  const response = await apiClient.put<ApiResponse<DeliveryZone>>(`/delivery-zones/${id}`, payload)
  return response.data
}

export async function deleteDeliveryZone(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/delivery-zones/${id}`)
  return response.data
}

// ============================================================================
// BANK ACCOUNTS & QR API
// ============================================================================

export async function fetchBankAccounts(params?: { include_inactive?: boolean; search?: string }): Promise<ApiResponse<BankAccount[]>> {
  const response = await apiClient.get<ApiResponse<BankAccount[]>>('/bank-accounts', { params })
  return response.data
}

export async function createBankAccount(payload: Partial<BankAccount>): Promise<ApiResponse<BankAccount>> {
  const response = await apiClient.post<ApiResponse<BankAccount>>('/bank-accounts', payload)
  return response.data
}

export async function updateBankAccount(id: string, payload: Partial<BankAccount>): Promise<ApiResponse<BankAccount>> {
  const response = await apiClient.put<ApiResponse<BankAccount>>(`/bank-accounts/${id}`, payload)
  return response.data
}

export async function deleteBankAccount(id: string): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/bank-accounts/${id}`)
  return response.data
}

/**
 * Fetch seller daily settlement summary & breakdown
 * GET /api/v1/seller-settlements/summary
 */
export async function fetchSellerSettlementSummary(
  date?: string,
  sellerId?: string
): Promise<ApiResponse<SellerDailySettlementSummary>> {
  const response = await apiClient.get<ApiResponse<SellerDailySettlementSummary>>(
    '/seller-settlements/summary',
    { params: { date, seller_id: sellerId } }
  )
  return response.data
}

/**
 * Confirm / sign off on seller daily sales
 * POST /api/v1/seller-settlements/confirm
 */
export async function confirmSellerSettlement(payload: {
  seller_id?: string
  confirmed_date: string
  notes?: string
}): Promise<ApiResponse<SellerDailySettlementRecord>> {
  const response = await apiClient.post<ApiResponse<SellerDailySettlementRecord>>(
    '/seller-settlements/confirm',
    payload
  )
  return response.data
}

/**
 * Reassign an order to another seller
 * POST /api/v1/seller-settlements/reassign-order
 */
export async function reassignOrderSeller(payload: {
  order_id: string
  new_seller_id: string
  reason?: string
}): Promise<ApiResponse<Order>> {
  const response = await apiClient.post<ApiResponse<Order>>(
    '/seller-settlements/reassign-order',
    payload
  )
  return response.data
}

/**
 * Fetch manager reconciliation summary across all team sellers for a given date
 * GET /api/v1/seller-settlements/team-daily?date=YYYY-MM-DD
 */
export async function fetchTeamDailySettlementSummary(
  date?: string
): Promise<ApiResponse<TeamDailySettlementSummary>> {
  const params = date ? { date } : {}
  const response = await apiClient.get<ApiResponse<TeamDailySettlementSummary>>(
    '/seller-settlements/team-daily',
    { params }
  )
  return response.data
}


