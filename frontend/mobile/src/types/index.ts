// --- Nominal / Branded ID Types ---
declare const __brand: unique symbol
export type Brand<K, T> = K & { readonly [__brand]?: T }

export type ProductId = Brand<string, 'ProductId'>
export type VariantId = Brand<string, 'VariantId'>
export type OrderId = Brand<string, 'OrderId'>
export type CustomerId = Brand<string, 'CustomerId'>
export type UserId = Brand<string, 'UserId'>
export type InvoiceId = Brand<string, 'InvoiceId'>
export type QuotationId = Brand<string, 'QuotationId'>
export type SupplierId = Brand<string, 'SupplierId'>
export type ExpenseId = Brand<string, 'ExpenseId'>

export interface PaginationMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  meta?: PaginationMeta
  errors?: Record<string, string[]>
}

export interface PaginatedData<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export interface ScannedAttributeValue {
  id: string
  value_name: string
  attribute?: {
    id?: string
    name: string
  }
}

export interface ScannedProduct {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  selling_price: string
  image_url?: string | null
  purchase_price?: string | null
  reorder_level?: number | null
  is_active?: boolean
}

export interface ScannedVariant {
  id: string
  product_id?: string
  name?: string
  sku: string
  barcode: string | null
  quantity_on_hand: number
  selling_price_override: string | null
  selling_price: string | null
  is_active?: boolean
  product?: ScannedProduct
  attribute_values?: ScannedAttributeValue[]
}

export interface ScanResult {
  type: 'variant' | 'product'
  variant?: ScannedVariant
  product: ScannedProduct
  variants?: ScannedVariant[]
}

export interface ProductCategory {
  id: string
  name: string
  code: string
  description?: string | null
  image_url?: string | null
  productCount?: number
  created_at?: string
  updated_at?: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string
  barcode: string | null
  cost_price_override?: string | null
  selling_price_override?: string | null
  cost_price?: string | null
  selling_price?: string | null
  quantity_on_hand: number
  quantity_reserved?: number
  reorder_level?: number
  is_active: boolean
  product?: ScannedProduct | Product
  attribute_values?: ScannedAttributeValue[]
  created_at?: string
  updated_at?: string
}

export interface Product {
  id: string
  category_id?: string | null
  name: string
  sku: string
  barcode?: string | null
  description?: string | null
  purchase_price: string | number
  cost_price?: string | number
  selling_price: string | number
  default_reorder_level?: number
  image_url?: string | null
  is_active: boolean
  is_composite?: boolean
  category?: ProductCategory
  variants?: ProductVariant[]
  created_at?: string
  updated_at?: string
}

export interface PoGroup {
  groupKey: string
  parentName: string
  imageUrl?: string
  items: PurchaseOrderItem[]
  totalQty: number
  totalCost: number
}

export interface CartItem {
  variantId: string
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  availableStock: number
  attributesSummary?: string
  imageUrl?: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  preferred_delivery_company?: string
  total_purchased?: number
  total_spent?: string | number
  last_purchase_at?: string | null
  created_at?: string
  orders?: Order[]
}

export interface SalesChannel {
  id: string
  name: string
  platform?: string
  code?: string
  type?: string
  image_url?: string | null
  imageUrl?: string | null
  is_active?: boolean
  isActive?: boolean
  is_default?: boolean
  isDefault?: boolean
}

export type PaymentMethod = 'Cash' | 'Bank'

export interface CheckoutItem {
  variant_id: string
  quantity: number
  unit_price: number
}

export interface CheckoutPayload {
  client_mutation_id: string
  channel_id: string
  items: CheckoutItem[]
  payment_method: string
  payment_amount: number
  customer?: {
    name?: string
    phone?: string
  }
  discount?: number
  tax_type?: 'flat' | 'percentage'
  tax_rate?: number
  tax_amount?: number
  status?: 'paid' | 'pending' | 'completed' | string
  delivery_company?: string
  delivery_cost?: number
  delivery_address?: string
  region?: string
  note?: string
  transaction_ref?: string
  seller_id?: string
}

export interface OrderItem {
  id: string
  order_id?: string
  product_id?: string
  variant_id?: string
  quantity: number
  unit_price: string | number
  total_price?: string | number
  line_total?: string | number
  product_name?: string
  productName?: string
  sku?: string
  product?: {
    id?: string
    name?: string
    sku?: string
    unit?: string
    barcode?: string
  }
  variant?: ScannedVariant | ProductVariant | {
    id?: string
    sku?: string
    name?: string
    attribute_values?: ScannedAttributeValue[]
    option_values?: Record<string, string>
  }
}

export interface OrderPayment {
  id: string
  order_id: string
  payment_method: string
  amount: string | number
  status?: string
  transaction_ref?: string | null
}

export interface Order {
  id: string
  order_number: string
  client_mutation_id?: string
  channel_id: string
  channel?: SalesChannel
  salesChannel?: SalesChannel
  customer_id?: string | null
  customer?: Customer | null
  user_id?: string | null
  user?: { id: string; name: string; role?: string } | null
  seller_id?: string | null
  seller?: { id: string; name: string; role?: string } | null
  status: string
  payment_status?: string
  subtotal?: string | number
  tax_rate?: string | number
  tax_amount?: string | number
  total_amount: string | number
  discount?: string | number
  delivery_company?: string
  delivery_cost?: string | number
  delivery_address?: string
  region?: string
  note?: string
  notes?: string
  items?: OrderItem[]
  payments?: OrderPayment[]
  created_at: string
  updated_at?: string
}

export interface StaffPerformanceEntry {
  rank: number
  user_id: string
  staff_name: string
  staff_role: string
  orders_count: number
  total_revenue: number
  avg_basket: number
  units_sold: number
}

export interface StaffPerformanceSummary {
  period: 'today' | 'week' | 'month'
  leaderboard: StaffPerformanceEntry[]
}

export interface DeliveryCompany {
  id: string
  name: string
  phone?: string
  logoIcon?: string
  color?: string
  isActive: boolean
  isDefault?: boolean
  notes?: string
}

export interface DeliveryZone {
  id: string
  name: string
  cost: number
  isActive: boolean
  isDefault?: boolean
}

export interface RestockItemPayload {
  variant_id: string
  quantity: number
  unit_cost: number
  scanned_barcode?: string
}

export interface RestockPayload {
  session_date?: string
  notes?: string
  items: RestockItemPayload[]
}

export interface RestockDetail {
  id: string
  restock_session_id: string
  variant_id: string
  scanned_barcode?: string | null
  quantity: number
  unit_cost: string | number
  variant?: ProductVariant | ScannedVariant
}

export interface RestockResponse {
  id: string
  session_date?: string
  status: string
  notes?: string | null
  created_at: string
  updated_at?: string
  details?: RestockDetail[]
}

export type StockAdjustmentReason = 'Damaged' | 'Audit' | 'Restock' | 'Return' | 'Shrinkage'

export interface StockAdjustmentPayload {
  variant_id: string
  current_quantity: number
  new_quantity: number
  difference: number
  reason: StockAdjustmentReason
  notes?: string
  adjusted_at?: string
}

export interface BankAccount {
  id: string
  bankName: string // e.g. 'ABA Bank', 'Acleda Bank', 'Wing Bank', 'Canadia Bank'
  accountName: string
  accountNumber: string
  qrImageUrl?: string
  currency: 'USD' | 'KHR' | 'Dual'
  isDefault?: boolean
  isActive: boolean
  color?: string
  logoIcon?: string
}

export type TabType =
  | 'home'
  | 'pos'
  | 'transactions'
  | 'quotations'
  | 'invoices'
  | 'products'
  | 'purchase-orders'
  | 'categories'
  | 'inventory'
  | 'customers' | 'suppliers'
  | 'expenses'
  | 'reports'
  | 'admin'
  | 'roles'
  | 'bank-accounts'
  | 'delivery-companies'
  | 'delivery-zones'
  | 'sales-channels'
  | 'settings'
  | 'hub'
  | 'payroll'
  | 'daily-settlements'

export interface AttributeTaxonomy {
  id: string
  name: string
  code?: string
  values: string[]
  productCount?: number
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER'

export interface UserAccount {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  is_test_account?: boolean
  isTestAccount?: boolean
  must_change_password?: boolean
  mustChangePassword?: boolean
  avatarUrl?: string
  phone?: string
  hire_date?: string
  department?: string
  notes?: string
  lastActive?: string
  permissionGroup?: string
  overrides?: Record<string, boolean>
  permissions?: string[]
  base_salary?: number
  salary_reason?: string
  createdAt?: string
  created_at?: string
  stats?: {
    total_orders: number
    total_sales: number
    total_net_paid: number
  }
}

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED'

export interface QuotationItem {
  id: string
  variantId?: string
  variant_id?: string
  productName?: string
  product_name?: string
  sku?: string
  quantity: number
  unitPrice?: number
  unit_price?: number | string
  lineTotal?: number
  line_total?: number | string
}

export interface Quotation {
  id: string
  quotationNumber?: string
  quotation_number?: string
  customerId?: string
  customer_id?: string
  customerName?: string
  customer_name?: string
  customerPhone?: string
  customer_phone?: string
  customerEmail?: string
  customer_email?: string
  status: QuotationStatus
  items: QuotationItem[]
  subtotal: number | string
  discount: number | string
  totalAmount?: number | string
  total_amount?: number | string
  notes?: string
  validUntil?: string
  valid_until?: string
  createdAt?: string
  created_at?: string
  convertedOrderId?: string
  converted_order_id?: string
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'PARTIAL' | 'OVERDUE'

export interface InvoicePaymentRecord {
  id: string
  amount: number | string
  paymentMethod?: string
  payment_method?: string
  transactionRef?: string
  transaction_ref?: string
  paidAt?: string
  paid_at?: string
  recordedBy?: string
  recorded_by?: string
}

export interface InvoiceItem {
  id: string
  productName?: string
  product_name?: string
  sku?: string
  quantity: number
  unitPrice?: number
  unit_price?: number | string
  totalPrice?: number
  total_price?: number | string
}

export interface Invoice {
  id: string
  invoiceNumber?: string
  invoice_number?: string
  orderId?: string
  order_id?: string
  orderNumber?: string
  order_number?: string
  customerName?: string
  customer_name?: string
  customerPhone?: string
  customer_phone?: string
  status: InvoiceStatus
  items: InvoiceItem[]
  totalAmount?: number | string
  total_amount?: number | string
  amountPaid?: number | string
  amount_paid?: number | string
  balanceDue?: number | string
  balance_due?: number | string
  dueDate?: string
  due_date?: string
  notes?: string
  createdAt?: string
  created_at?: string
  payments: InvoicePaymentRecord[]
}

export interface Supplier {
  id: string
  name: string
  contactPerson?: string
  contact_person?: string
  email?: string
  phone: string
  address?: string
  leadTimeDays?: number
  lead_time_days?: number
  payment_terms?: string
  tax_id?: string
  notes?: string
  is_active?: boolean
  activeOrdersCount?: number
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderItem {
  id: string
  variantId: string
  productId?: string
  parentProductName?: string
  productName: string
  sku: string
  quantity: number
  unitCost: number
  totalCost: number
  imageUrl?: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplierName: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  totalCost: number
  expectedDeliveryDate: string
  orderDate: string
  notes?: string
}

export type MovementType =
  | 'INITIAL'
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'DAMAGE'
  | 'RESTOCK'
  | 'SHRINKAGE'
  | 'CANCELLATION_REVERSAL'

export interface StockMovementRecord {
  id: string
  variantId: string
  productName: string
  sku: string
  movementType: MovementType
  quantity: number
  balanceAfter: number
  referenceNumber?: string
  notes?: string
  createdAt: string
  recordedBy?: string
}

export interface ExpenseRecord {
  id: string
  title: string
  category: 'Rent' | 'Utilities' | 'Salary' | 'Logistics' | 'Marketing' | 'Supplies' | 'Maintenance' | 'Other'
  amount: number
  paymentMethod: 'Cash' | 'ABA QR' | 'Card' | 'Bank Transfer'
  expenseDate: string
  recordedBy: string
  notes?: string
  receiptUrl?: string
}

export interface ExpenseCategorySummary {
  category: string
  amount: number
  percentage: number
  count: number
  color: string
}

export interface PermissionDefinition {
  id: string
  name: string
  resource: string
  action: string
  description: string
}

export interface PermissionItem {
  id: string
  name: string
  slug: string
  module: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface RoleItem {
  id: string
  name: string
  slug: string
  description?: string
  permissions: string[]
  users_count?: number
  usersCount?: number
  created_at?: string
  updated_at?: string
}

export interface UpdateRolePermissionsPayload {
  permissions: string[]
}

export interface PermissionGroup {
  id: string
  name: string
  slug?: string
  description: string
  permissions: string[]
  userCount: number
}

export interface MetricStat {
  id: string
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  badge?: string
  badgeBg?: string
  badgeColor?: string
  icon?: string
  isWarning?: boolean
}

export interface StaffMember {
  id: string
  name: string
  role: string
  status: 'Clocked In' | 'Off Duty' | 'On Break'
  shiftHours?: string
  salesToday?: string | number
  avatarUrl?: string
}

export interface RecentTransaction {
  id: string
  orderNumber: string
  timeAgo: string
  itemCount: number
  totalAmount: number
  customerName?: string
  paymentMethod: string
  status: 'completed' | 'pending' | 'cancelled'
}

export interface DailySalesGoal {
  target: number
  current: number
  percentage: number
  remaining: number
}

export type OfflineMutationPayload =
  | { type: 'CHECKOUT'; data: CheckoutPayload }
  | {
      type: 'STOCK_ADJUSTMENT'
      data: {
        variant_id: string
        type: string
        quantity: number
        current_quantity?: number
        difference?: number
        reason: string
        notes?: string
        adjusted_at?: string
        client_mutation_id: string
      }
    }
  | {
      type: 'STOCK_IN'
      data: {
        items: Array<{ variant_id: string; quantity: number; cost_price?: number; unit_cost?: number }>
        notes?: string
        reference_number?: string
        client_mutation_id: string
      }
    }
  | { type: 'UPDATE_ORDER_STATUS'; data: { orderId: string; status: string; client_mutation_id?: string } }

export interface OfflineMutation {
  id: string
  timestamp: number
  endpoint: string
  payload: CheckoutPayload | OfflineMutationPayload
  retryCount: number
  status: 'pending' | 'syncing' | 'failed' | 'success'
  error?: string
}

export interface DashboardSummary {
  net_revenue: number
  orders_count: number
  avg_basket_value: number
  digital_payment_percentage: number
  units_sold: number
  low_stock_skus: number
  revenue_trend: number
  daily_target_progress: number
}

export interface StoreBranding {
  id?: string
  store_name: string
  tagline?: string
  logo_url?: string | null
  primary_color?: string
  store_address?: string | null
  store_phone?: string | null
  receipt_header?: string | null
  invoice_header?: string | null
  quotation_header?: string | null
  receipt_footer?: string | null
  invoice_footer?: string | null
  quotation_footer?: string | null
  show_tax?: boolean
  updated_at?: string
}

export interface UserSalary {
  id: string
  user_id: string
  base_salary: number | string
  created_at?: string
  updated_at?: string
}

export type PayrollStatus = 'DRAFT' | 'FINALIZED' | 'PAID'

export interface Payroll {
  id: string
  user_id: string
  period_month: number
  period_year: number
  base_salary: number | string
  working_days?: number | string
  incentive_amount: number | string
  /** Manual incentive amount; null/undefined = auto-calculated from completed orders */
  incentive_override?: number | string | null
  thirteenth_month_contribution: number | string
  thirteenth_month_payout?: number | string
  performance_benefit: number | string
  delivery_benefit: number | string
  overtime_days: number | string
  overtime_amount: number | string
  unpaid_leave_days: number | string
  unpaid_leave_deduction: number | string
  collective_benefit: number | string
  other_benefits: number | string
  total_net_pay: number | string
  status: PayrollStatus
  user?: UserAccount
  created_at?: string
  updated_at?: string
}

export interface ThirteenthMonthPayout {
  id: string
  user_id: string
  payroll_id?: string | null
  amount: number
  payout_date: string
  payment_method: string
  notes?: string | null
  created_at?: string
}

export interface ThirteenthMonthSummary {
  user_id: string
  year?: number | null
  total_accrued: number
  total_disbursed: number
  available_balance: number
  payouts: ThirteenthMonthPayout[]
}

export interface MonthlyReserveBreakdown {
  payroll_id: string
  month: number
  year: number
  amount: number
  status: string
}

export interface StaffThirteenthMonthReserve {
  user_id: string
  name: string
  email: string
  role: string
  department: string
  base_salary: number
  monthly_accrual: number
  months_accrued: number
  accrued_months?: number[]
  monthly_breakdown?: MonthlyReserveBreakdown[]
  month_specific_accrual?: number | null
  total_accrued: number
  total_disbursed: number
  available_balance: number
  payouts: ThirteenthMonthPayout[]
}

export interface CompanyThirteenthMonthReservesData {
  year?: number | null
  month?: number | null
  kpi: {
    company_total_accrued: number
    company_total_disbursed: number
    company_total_available_balance: number
    eligible_staff_count: number
  }
  staff: StaffThirteenthMonthReserve[]
}

export interface StaffPerformanceSummary {
  total_orders: number
  total_revenue: number
  avg_order_value: number
  total_incentive: number
}

export interface StaffPerformanceChannel {
  channel: string
  order_count: number
  total_revenue: number
  percentage: number
}

export interface StaffPerformanceDailyTrend {
  date: string
  order_count: number
  total_revenue: number
  total_incentive: number
}

export interface StaffPerformance {
  user: {
    id: string
    name: string
    role: string
    department?: string
    hire_date?: string
  }
  period: string
  date_from: string
  date_to: string
  summary: StaffPerformanceSummary
  channel_breakdown: StaffPerformanceChannel[]
  daily_trends: StaffPerformanceDailyTrend[]
  total_orders?: number
  total_revenue?: number
  total_incentive?: number
  avg_order_value?: number
}

export interface StaffIncentiveOrder {
  id: string
  order_number: string
  total_amount: number
  incentive: number
  completed_at: string
  channel_name: string
  customer_name: string
}

export interface StaffIncentiveDaily {
  date: string
  order_count: number
  total_sales: number
  total_incentive: number
  orders: StaffIncentiveOrder[]
}

export interface StaffIncentiveTier {
  label: string
  rate: number
}

export interface StaffIncentiveBreakdown {
  user: {
    id: string
    name: string
    role: string
  }
  period: {
    month: number
    year: number
    start_date: string
    end_date: string
  }
  summary: {
    total_orders: number
    total_sales: number
    total_incentive: number
  }
  tiers: StaffIncentiveTier[]
  daily_breakdown: StaffIncentiveDaily[]
}

export interface SalaryHistoryEntry {
  id: string
  base_salary: number
  effective_from?: string
  previous_salary?: number
  diff_amount: number
  diff_percent: number
  reason: string
  created_at: string
  created_by: string
}

export interface SalaryHistoryResponse {
  user: {
    id: string
    name: string
    role: string
  }
  current_salary: number
  history: SalaryHistoryEntry[]
}

export interface SellerSettlementOrderItem {
  id: string
  order_number: string
  status: string
  total_amount: number
  incentive: number
  items_count: number
  customer_name: string
  channel_name: string
  created_at: string
  input_by_user?: { id: string; name: string; role?: string } | null
  is_assisted: boolean
}

export interface SellerDailySettlementRecord {
  id: string
  seller_id: string
  confirmed_date: string
  total_orders_count: number
  total_sales_amount: number
  total_incentive_amount: number
  status: 'CONFIRMED' | 'REVISED' | string
  confirmed_at: string
  confirmed_by: string
  confirmer?: { id: string; name: string }
  order_ids?: string[]
  notes?: string
}

export interface SellerDailySettlementSummary {
  seller: { id: string; name: string; role?: string }
  date: string
  is_today: boolean
  total_orders_count: number
  direct_orders_count: number
  assisted_orders_count: number
  total_sales_amount: number
  total_incentive_amount: number
  direct_orders: SellerSettlementOrderItem[]
  assisted_orders: SellerSettlementOrderItem[]
  settlement: SellerDailySettlementRecord | null
  is_confirmed: boolean
}

export interface TeamSellerStatusItem {
  seller: {
    id: string
    name: string
    role: string
    email?: string
    department?: string
  }
  total_orders_count: number
  direct_orders_count: number
  assisted_orders_count: number
  total_sales_amount: number
  total_incentive_amount: number
  is_confirmed: boolean
  status: 'CONFIRMED' | 'PENDING' | 'REVISED' | 'NO_SALES' | string
  settlement?: {
    id: string
    status: string
    confirmed_at?: string
    confirmed_by?: { id: string; name: string } | null
    notes?: string | null
  } | null
}

export interface TeamDailySettlementSummary {
  date: string
  is_today: boolean
  total_sellers_count: number
  active_sellers_with_sales: number
  confirmed_sellers_count: number
  total_team_sales_amount: number
  total_team_incentive_amount: number
  total_team_orders_count: number
  sellers: TeamSellerStatusItem[]
}

