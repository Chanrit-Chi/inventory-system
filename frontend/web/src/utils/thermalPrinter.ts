/**
 * Thermal Printer Utilities for Web
 * Provides ESC/POS byte-stream construction and network thermal printing
 * via backend socket proxy (POST /api/v1/printer/raw-print).
 */

export interface PrinterDevice {
  id: string
  name: string
  connectionType: 'wifi' | 'bluetooth'
  ipAddress: string
  port: number
  bluetoothName?: string
  paperWidth: '80mm' | '58mm'
  role: 'receipt' | 'kitchen'
  isDefault: boolean
  autoCut: boolean
}

export interface StoreBranding {
  store_name?: string
  storeName?: string
  tagline?: string
  subHeader?: string
  store_phone?: string
  storePhone?: string
  store_address?: string
  storeAddress?: string
  receipt_header?: string
  receiptTitle?: string
  invoice_header?: string
  invoiceTitle?: string
  quotation_header?: string
  quotationTitle?: string
  receipt_footer?: string
  footerMessage?: string
  show_tax?: boolean
  showTax?: boolean
}

/**
 * ESC/POS Command Constants
 */
const ESC = '\x1B'
const GS = '\x1D'

export const ESC_POS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${ESC}!\x10`,
  DOUBLE_WIDTH_ON: `${ESC}!\x20`,
  DOUBLE_SIZE_ON: `${ESC}!\x30`,
  NORMAL_TEXT: `${ESC}!\x00`,
  CUT_PAPER: `${GS}V\x00`,
  CUT_PAPER_PARTIAL: `${GS}V\x01`,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
}

/**
 * Format a two-column line with spacing (e.g. "Item Name ........... $12.00")
 */
export function formatTwoColumn(left: string, right: string, maxCols: number): string {
  const leftMax = maxCols - right.length - 1
  const truncatedLeft = left.length > leftMax ? left.substring(0, Math.max(0, leftMax)) : left
  const spaceCount = Math.max(1, maxCols - truncatedLeft.length - right.length)
  return truncatedLeft + ' '.repeat(spaceCount) + right
}

/**
 * Format a horizontal divider line
 */
export function getDivider(maxCols: number, char = '-'): string {
  return char.repeat(maxCols)
}

/**
 * Clean any Unicode spaces (like \u202F narrow no-break space, \u00A0 non-breaking space)
 * and non-ASCII invisible characters that cause garbage characters on thermal printers.
 */
export function sanitizeThermalText(text: string): string {
  if (!text) return ''
  return text
    // Replace non-breaking spaces, narrow no-break spaces, and other Unicode spaces with standard ASCII space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Remove zero-width characters and directional formatting marks
    .replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, '')
}

/**
 * Format a Date object or timestamp into clean ASCII format for thermal receipts
 * e.g., "Sep 5, 2026, 01:39 PM" with standard ASCII space before AM/PM.
 */
export function formatReceiptDateTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return formatReceiptDateTime(new Date())
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return formatReceiptDateTime(new Date())

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[d.getMonth()]
  const day = d.getDate()
  const year = d.getFullYear()

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const hoursStr = String(hours).padStart(2, '0')

  return `${month} ${day}, ${year}, ${hoursStr}:${minutes} ${ampm}`
}

/**
 * Format a Date object or timestamp into clean ASCII time for thermal receipts
 * e.g., "01:39 PM" with standard ASCII space before AM/PM.
 */
export function formatReceiptTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return formatReceiptTime(new Date())
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return formatReceiptTime(new Date())

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const hoursStr = String(hours).padStart(2, '0')

  return `${hoursStr}:${minutes} ${ampm}`
}

/**
 * Format a Date object or timestamp into clean ASCII date
 * e.g., "Sep 5, 2026"
 */
export function formatReceiptDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return formatReceiptDate(new Date())
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return formatReceiptDate(new Date())

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[d.getMonth()]
  const day = d.getDate()
  const year = d.getFullYear()

  return `${month} ${day}, ${year}`
}

/**
 * Convert an ESC/POS string with binary control bytes to a safe Base64 string
 */
export function encodeEscPosBase64(data: string): string {
  const cleanData = sanitizeThermalText(data)
  return btoa(
    encodeURIComponent(cleanData).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
}

/**
 * Retrieve active store branding from localStorage with defaults
 */
export function getActiveBranding(): StoreBranding {
  try {
    const raw = localStorage.getItem('omnipos_branding')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const storeName = parsed.store_name || localStorage.getItem('omnipos_store_name') || 'KC Shop'
        const tagline = parsed.tagline ?? localStorage.getItem('omnipos_tagline') ?? 'High-Velocity POS & ERP Platform'
        return {
          store_name: storeName,
          storeName: storeName,
          tagline: tagline,
          subHeader: tagline,
          store_address: parsed.store_address || 'Phnom Penh, Cambodia',
          storeAddress: parsed.store_address || 'Phnom Penh, Cambodia',
          store_phone: parsed.store_phone || '+855 12 345 678',
          storePhone: parsed.store_phone || '+855 12 345 678',
          receipt_header: parsed.receipt_header || 'TAX INVOICE / RECEIPT',
          receiptTitle: parsed.receipt_header || 'TAX INVOICE / RECEIPT',
          invoice_header: parsed.invoice_header || 'COMMERCIAL INVOICE',
          invoiceTitle: parsed.invoice_header || 'COMMERCIAL INVOICE',
          quotation_header: parsed.quotation_header || 'PRICE QUOTATION / ESTIMATE',
          quotationTitle: parsed.quotation_header || 'PRICE QUOTATION / ESTIMATE',
          receipt_footer: parsed.receipt_footer || 'Thank you for your business! Please visit again.',
          footerMessage: parsed.receipt_footer || 'Thank you for your business! Please visit again.',
          show_tax: Boolean(parsed.show_tax),
          showTax: Boolean(parsed.show_tax),
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }

  const legacyName = localStorage.getItem('omnipos_store_name')
  const defaultName = legacyName || 'KC Shop'
  return {
    store_name: defaultName,
    storeName: defaultName,
    tagline: localStorage.getItem('omnipos_tagline') || 'High-Velocity POS & ERP Platform',
    subHeader: localStorage.getItem('omnipos_tagline') || 'High-Velocity POS & ERP Platform',
    store_address: 'Phnom Penh, Cambodia',
    storeAddress: 'Phnom Penh, Cambodia',
    store_phone: '+855 12 345 678',
    storePhone: '+855 12 345 678',
    receipt_header: 'TAX INVOICE / RECEIPT',
    receiptTitle: 'TAX INVOICE / RECEIPT',
    invoice_header: 'COMMERCIAL INVOICE',
    invoiceTitle: 'COMMERCIAL INVOICE',
    quotation_header: 'PRICE QUOTATION / ESTIMATE',
    quotationTitle: 'PRICE QUOTATION / ESTIMATE',
    receipt_footer: 'Thank you for your business! Please visit again.',
    footerMessage: 'Thank you for your business! Please visit again.',
    show_tax: false,
    showTax: false,
  }
}

/**
 * Retrieve the active or default receipt thermal printer from localStorage
 */
export function getConfiguredReceiptPrinter(): PrinterDevice | null {
  try {
    const raw = localStorage.getItem('omnipos_printers')
    if (!raw) return null
    const list: PrinterDevice[] = JSON.parse(raw)
    if (!Array.isArray(list) || list.length === 0) return null

    // 1. Look for default receipt printer
    const defaultReceipt = list.find((p) => p.isDefault && p.role === 'receipt' && p.connectionType === 'wifi' && p.ipAddress)
    if (defaultReceipt) return defaultReceipt

    // 2. Look for any default printer
    const defaultPrinter = list.find((p) => p.isDefault && p.connectionType === 'wifi' && p.ipAddress)
    if (defaultPrinter) return defaultPrinter

    // 3. Look for any receipt printer
    const receiptPrinter = list.find((p) => p.role === 'receipt' && p.connectionType === 'wifi' && p.ipAddress)
    if (receiptPrinter) return receiptPrinter

    // 4. Return first wifi printer with an IP address
    const firstWifi = list.find((p) => p.connectionType === 'wifi' && Boolean(p.ipAddress))
    return firstWifi || null
  } catch {
    return null
  }
}

export function resolveBranding(storeInfo: StoreBranding = {}): {
  storeName: string
  subHeader: string
  address: string
  phone: string
  receiptHeader: string
  invoiceHeader: string
  quotationHeader: string
  footerMessage: string
  showTax: boolean
} {
  const active = getActiveBranding()
  return {
    storeName: storeInfo.store_name || storeInfo.storeName || active.store_name || active.storeName || 'KC Shop',
    subHeader: storeInfo.tagline ?? storeInfo.subHeader ?? active.tagline ?? active.subHeader ?? '',
    address: storeInfo.store_address ?? storeInfo.storeAddress ?? active.store_address ?? active.storeAddress ?? '',
    phone: storeInfo.store_phone ?? storeInfo.storePhone ?? active.store_phone ?? active.storePhone ?? '',
    receiptHeader: storeInfo.receipt_header || storeInfo.receiptTitle || active.receipt_header || active.receiptTitle || 'TAX INVOICE / RECEIPT',
    invoiceHeader: storeInfo.invoice_header || storeInfo.invoiceTitle || active.invoice_header || active.invoiceTitle || 'COMMERCIAL INVOICE',
    quotationHeader: storeInfo.quotation_header || storeInfo.quotationTitle || active.quotation_header || active.quotationTitle || 'PRICE QUOTATION / ESTIMATE',
    footerMessage: storeInfo.receipt_footer || storeInfo.footerMessage || active.receipt_footer || active.footerMessage || 'Thank you for your business! Please visit again.',
    showTax: Boolean(storeInfo.show_tax ?? storeInfo.showTax ?? active.show_tax ?? active.showTax),
  }
}

/**
 * Build ESC/POS Byte Stream for an Order Receipt
 */
export function buildEscPosCommands(
  order: any,
  printer: PrinterDevice,
  storeInfo: StoreBranding = {}
): string {
  const branding = resolveBranding(storeInfo)
  const maxCols = printer.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  // 1. Initialize
  buffer += ESC_POS.INIT

  // 2. Store Header (Centered, Bold)
  buffer += ESC_POS.ALIGN_CENTER
  buffer += ESC_POS.DOUBLE_SIZE_ON + ESC_POS.BOLD_ON
  buffer += `${branding.storeName.trim()}\n`
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  if (branding.subHeader && branding.subHeader.trim().length > 0) {
    buffer += `${branding.subHeader.trim()}\n`
  }
  if (branding.address && branding.address.trim().length > 0) {
    buffer += `${branding.address.trim()}\n`
  }
  if (branding.phone && branding.phone.trim().length > 0) {
    buffer += `Tel: ${branding.phone.trim()}\n`
  }

  buffer += ESC_POS.BOLD_ON
  buffer += `${branding.receiptHeader}\n`
  buffer += ESC_POS.BOLD_OFF
  buffer += `${getDivider(maxCols, '=')}\n`

  // 3. Order Metadata (Left aligned)
  buffer += ESC_POS.ALIGN_LEFT
  const orderDate = formatReceiptDateTime(order.created_at)

  const orderNum = order.order_number || order.orderNumber || order.id?.substring(0, 8) || 'N/A'
  buffer += `Order #: #${orderNum}\n`
  buffer += `Date   : ${orderDate}\n`

  const cashierName = order.user?.name || order.cashier_name || order.cashierName || 'Staff'
  buffer += `Cashier: ${cashierName}\n`

  if (order.customer?.name) {
    const custPhone = order.customer.phone ? ` (${order.customer.phone})` : ''
    buffer += `Customer: ${order.customer.name}${custPhone}\n`
  }
  if (order.channel?.name) {
    buffer += `Channel: ${order.channel.name}\n`
  }
  buffer += `${getDivider(maxCols, '-')}\n`

  // 4. Line Items Table
  buffer += formatTwoColumn('ITEM', 'TOTAL', maxCols) + '\n'
  buffer += `${getDivider(maxCols, '-')}\n`

  const items = order.items || []
  items.forEach((it: any, idx: number) => {
    const name = it.product?.name || it.name || it.variant?.sku || `Item #${idx + 1}`
    const qty = Number(it.quantity) || 1
    const price = typeof it.unit_price === 'number'
      ? it.unit_price
      : parseFloat(String(it.unit_price || it.price || '0')) || 0
    const total = typeof it.total_price === 'number'
      ? it.total_price
      : typeof it.line_total === 'number'
      ? it.line_total
      : parseFloat(String(it.total_price || it.line_total || it.final_amount || '0')) || qty * price

    buffer += `${name}\n`
    const qtyPriceStr = `${qty} x $${price.toFixed(2)}`
    const totalStr = `$${total.toFixed(2)}`
    buffer += formatTwoColumn(`  ${qtyPriceStr}`, totalStr, maxCols) + '\n'
  })
  buffer += `${getDivider(maxCols, '-')}\n`

  // 5. Financial Totals
  const subtotal = order.subtotal !== undefined
    ? parseFloat(String(order.subtotal))
    : items.reduce((s: number, it: any) => {
        const p = parseFloat(String(it.unit_price || it.price || 0)) || 0
        const q = Number(it.quantity) || 1
        return s + (parseFloat(String(it.total_price || it.line_total || 0)) || q * p)
      }, 0)

  const discount = parseFloat(String(order.discount_amount || order.discount || '0')) || 0
  const delivery = parseFloat(String(order.delivery_cost || '0')) || 0
  const tax = parseFloat(String(order.tax_amount || '0')) || 0
  const totalPaid = typeof order.total_amount === 'number'
    ? order.total_amount
    : typeof order.final_amount === 'number'
    ? order.final_amount
    : parseFloat(String(order.total_amount || order.final_amount || '0')) || 0

  const paymentMethod = order.payments?.[0]?.payment_method || order.payment_method || order.paymentMethod || 'Cash'

  buffer += formatTwoColumn('Subtotal:', `$${subtotal.toFixed(2)}`, maxCols) + '\n'
  if (discount > 0) {
    buffer += formatTwoColumn('Discount:', `-$${discount.toFixed(2)}`, maxCols) + '\n'
  }
  if (delivery > 0) {
    buffer += formatTwoColumn('Delivery:', `$${delivery.toFixed(2)}`, maxCols) + '\n'
  }
  if (tax > 0 || branding.showTax) {
    buffer += formatTwoColumn('Tax:', `$${tax.toFixed(2)}`, maxCols) + '\n'
  }

  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.BOLD_ON + ESC_POS.DOUBLE_HEIGHT_ON
  buffer += formatTwoColumn('TOTAL PAID:', `$${totalPaid.toFixed(2)}`, maxCols) + '\n'
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  buffer += formatTwoColumn('Payment Method:', String(paymentMethod), maxCols) + '\n'
  buffer += formatTwoColumn('Status:', String(order.status || 'COMPLETED').toUpperCase(), maxCols) + '\n'

  if (order.note || order.notes) {
    buffer += `${getDivider(maxCols, '-')}\n`
    buffer += `Note: ${order.note || order.notes}\n`
  }

  // 6. Footer (Centered)
  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.ALIGN_CENTER
  buffer += `${branding.footerMessage}\n`
  buffer += `* * * * *\n`

  // 7. Feed & Cut
  buffer += ESC_POS.FEED_LINES(4)
  if (printer.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}

/**
 * Build ESC/POS Byte Stream for an Invoice
 */
export function buildInvoiceEscPosCommands(
  invoice: any,
  printer: PrinterDevice,
  storeInfo: StoreBranding = {}
): string {
  const branding = resolveBranding(storeInfo)
  const maxCols = printer.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  // 1. Initialize
  buffer += ESC_POS.INIT

  // 2. Header
  buffer += ESC_POS.ALIGN_CENTER
  buffer += ESC_POS.DOUBLE_SIZE_ON + ESC_POS.BOLD_ON
  buffer += `${branding.storeName.trim()}\n`
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  if (branding.subHeader && branding.subHeader.trim().length > 0) buffer += `${branding.subHeader.trim()}\n`
  if (branding.address && branding.address.trim().length > 0) buffer += `${branding.address.trim()}\n`
  if (branding.phone && branding.phone.trim().length > 0) buffer += `Tel: ${branding.phone.trim()}\n`

  buffer += ESC_POS.BOLD_ON
  buffer += `${branding.invoiceHeader}\n`
  buffer += ESC_POS.BOLD_OFF
  buffer += `${getDivider(maxCols, '=')}\n`

  // 3. Metadata
  buffer += ESC_POS.ALIGN_LEFT
  const invNum = invoice.invoice_number || invoice.id?.substring(0, 8) || 'N/A'
  buffer += `Invoice #: #${invNum}\n`
  if (invoice.order_number) {
    buffer += `Order Ref: #${invoice.order_number}\n`
  }
  const dateStr = formatReceiptDate(invoice.created_at)
  buffer += `Date     : ${dateStr}\n`

  const dueDate = invoice.due_date ? formatReceiptDate(invoice.due_date) : 'Due on Receipt'
  buffer += `Due Date : ${dueDate}\n`

  const custName = invoice.customer_name || invoice.customer?.name
  if (custName) {
    const custPhone = invoice.customer_phone || invoice.customer?.phone ? ` (${invoice.customer_phone || invoice.customer?.phone})` : ''
    buffer += `Customer : ${custName}${custPhone}\n`
  }
  if (invoice.user?.name) {
    buffer += `Issued By: ${invoice.user.name}\n`
  }
  buffer += `${getDivider(maxCols, '-')}\n`

  // 4. Line Items Table
  buffer += formatTwoColumn('ITEM', 'TOTAL', maxCols) + '\n'
  buffer += `${getDivider(maxCols, '-')}\n`

  const items = invoice.items || []
  items.forEach((it: any, idx: number) => {
    const name = it.product_name || it.name || it.sku || `Item #${idx + 1}`
    const qty = Number(it.quantity) || 1
    const price = typeof it.unit_price === 'number'
      ? it.unit_price
      : parseFloat(String(it.unit_price || '0')) || 0
    const total = typeof it.total_price === 'number'
      ? it.total_price
      : typeof it.line_total === 'number'
      ? it.line_total
      : qty * price

    buffer += `${name}\n`
    const qtyPriceStr = `${qty} x $${price.toFixed(2)}`
    const totalStr = `$${total.toFixed(2)}`
    buffer += formatTwoColumn(`  ${qtyPriceStr}`, totalStr, maxCols) + '\n'
  })
  buffer += `${getDivider(maxCols, '-')}\n`

  // 5. Financials
  const total = parseFloat(String(invoice.total_amount || 0)) || 0
  const paid = parseFloat(String(invoice.amount_paid || 0)) || 0
  const balanceDue = Math.max(0, total - paid)

  buffer += formatTwoColumn('Total Amount:', `$${total.toFixed(2)}`, maxCols) + '\n'
  buffer += formatTwoColumn('Amount Paid:', `$${paid.toFixed(2)}`, maxCols) + '\n'

  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.BOLD_ON + ESC_POS.DOUBLE_HEIGHT_ON
  buffer += formatTwoColumn('BALANCE DUE:', `$${balanceDue.toFixed(2)}`, maxCols) + '\n'
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  buffer += formatTwoColumn('Status:', String(invoice.status || 'UNPAID').toUpperCase(), maxCols) + '\n'

  // 6. Footer
  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.ALIGN_CENTER
  buffer += `${branding.footerMessage}\n`
  buffer += `* * * * *\n`

  // 7. Cut
  buffer += ESC_POS.FEED_LINES(4)
  if (printer.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}

/**
 * Build ESC/POS Byte Stream for a Quotation
 */
export function buildQuotationEscPosCommands(
  quotation: any,
  printer: PrinterDevice,
  storeInfo: StoreBranding = {}
): string {
  const branding = resolveBranding(storeInfo)
  const maxCols = printer.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  // 1. Initialize
  buffer += ESC_POS.INIT

  // 2. Header
  buffer += ESC_POS.ALIGN_CENTER
  buffer += ESC_POS.DOUBLE_SIZE_ON + ESC_POS.BOLD_ON
  buffer += `${branding.storeName.trim()}\n`
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  if (branding.subHeader && branding.subHeader.trim().length > 0) buffer += `${branding.subHeader.trim()}\n`
  if (branding.address && branding.address.trim().length > 0) buffer += `${branding.address.trim()}\n`
  if (branding.phone && branding.phone.trim().length > 0) buffer += `Tel: ${branding.phone.trim()}\n`

  buffer += ESC_POS.BOLD_ON
  buffer += `${branding.quotationHeader}\n`
  buffer += ESC_POS.BOLD_OFF
  buffer += `${getDivider(maxCols, '=')}\n`

  // 3. Metadata
  buffer += ESC_POS.ALIGN_LEFT
  const qtNum = quotation.quotation_number || quotation.id?.substring(0, 8) || 'N/A'
  buffer += `Quote #: #${qtNum}\n`
  const dateStr = formatReceiptDate(quotation.created_at)
  buffer += `Date   : ${dateStr}\n`

  const validUntil = quotation.valid_until ? formatReceiptDate(quotation.valid_until) : 'Valid for 30 days'
  buffer += `Valid  : ${validUntil}\n`

  const custName = quotation.customer_name || quotation.customer?.name
  if (custName) {
    const custPhone = quotation.customer_phone || quotation.customer?.phone ? ` (${quotation.customer_phone || quotation.customer?.phone})` : ''
    buffer += `Client : ${custName}${custPhone}\n`
  }
  if (quotation.user?.name) {
    buffer += `Rep    : ${quotation.user.name}\n`
  }
  buffer += `${getDivider(maxCols, '-')}\n`

  // 4. Line Items Table
  buffer += formatTwoColumn('ITEM', 'TOTAL', maxCols) + '\n'
  buffer += `${getDivider(maxCols, '-')}\n`

  const items = quotation.items || []
  items.forEach((it: any, idx: number) => {
    const name = it.product_name || it.name || it.sku || `Item #${idx + 1}`
    const qty = Number(it.quantity) || 1
    const price = typeof it.unit_price === 'number'
      ? it.unit_price
      : parseFloat(String(it.unit_price || '0')) || 0
    const total = typeof it.line_total === 'number'
      ? it.line_total
      : qty * price

    buffer += `${name}\n`
    const qtyPriceStr = `${qty} x $${price.toFixed(2)}`
    const totalStr = `$${total.toFixed(2)}`
    buffer += formatTwoColumn(`  ${qtyPriceStr}`, totalStr, maxCols) + '\n'
  })
  buffer += `${getDivider(maxCols, '-')}\n`

  // 5. Financials
  const subtotal = parseFloat(String(quotation.subtotal || 0)) || 0
  const discount = parseFloat(String(quotation.discount || 0)) || 0
  const totalAmount = parseFloat(String(quotation.total_amount || 0)) || 0

  buffer += formatTwoColumn('Subtotal:', `$${subtotal.toFixed(2)}`, maxCols) + '\n'
  if (discount > 0) {
    buffer += formatTwoColumn('Discount:', `-$${discount.toFixed(2)}`, maxCols) + '\n'
  }

  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.BOLD_ON + ESC_POS.DOUBLE_HEIGHT_ON
  buffer += formatTwoColumn('PROPOSED TOTAL:', `$${totalAmount.toFixed(2)}`, maxCols) + '\n'
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  buffer += formatTwoColumn('Status:', String(quotation.status || 'SENT').toUpperCase(), maxCols) + '\n'

  if (quotation.notes) {
    buffer += `${getDivider(maxCols, '-')}\n`
    buffer += `Notes: ${quotation.notes}\n`
  }

  // 6. Footer
  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.ALIGN_CENTER
  buffer += `${branding.footerMessage}\n`
  buffer += `* * * * *\n`

  // 7. Cut
  buffer += ESC_POS.FEED_LINES(4)
  if (printer.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}
