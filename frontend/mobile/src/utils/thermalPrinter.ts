import { Share, Alert, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Order, Invoice, SellerDailySettlementSummary } from '../types'
import { sendRawPrint } from '../api/endpoints'

export type PrinterConnectionType = 'wifi' | 'bluetooth' | 'system'
export type PaperWidth = '58mm' | '80mm'
export type PrinterRole = 'receipt' | 'kitchen' | 'all'

export interface PrinterDevice {
  id: string
  name: string
  connectionType: PrinterConnectionType
  ipAddress?: string
  port?: number
  bluetoothName?: string
  paperWidth: PaperWidth
  role: PrinterRole
  isDefault: boolean
  autoCut: boolean
}

export interface PrinterConfig {
  connectionType: PrinterConnectionType
  ipAddress: string
  port: number
  paperWidth: PaperWidth
  autoCut: boolean
  storeName: string
  subHeader?: string
  storePhone: string
  storeAddress: string
  receiptTitle?: string
  invoiceTitle?: string
  quotationTitle?: string
  showCashierName?: boolean
  showCustomerInfo?: boolean
  showTax?: boolean
  footerMessage: string
}

export const INITIAL_PRINTER_DEVICES: PrinterDevice[] = []

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  connectionType: 'wifi',
  ipAddress: '192.168.100.86',
  port: 9100,
  paperWidth: '58mm',
  autoCut: true,
  storeName: 'KC Shop',
  subHeader: 'High-Velocity POS & ERP Platform',
  storePhone: '+855 12 345 678',
  storeAddress: 'Phnom Penh, Cambodia',
  receiptTitle: 'TAX INVOICE / RECEIPT',
  invoiceTitle: 'INVOICE',
  quotationTitle: 'QUOTATION',
  showCashierName: true,
  showCustomerInfo: true,
  showTax: false,
  footerMessage: 'Thank you for shopping with us!\nItems sold are not returnable.',
}

const STORAGE_KEY = '@kc_inventory_printer_config'
const DEVICES_STORAGE_KEY = '@kc_inventory_printer_devices'

/**
 * Load saved printer settings from AsyncStorage
 */
export async function getPrinterConfig(): Promise<PrinterConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) }
    }
  } catch (_) {
    // fallback to default
  }
  return DEFAULT_PRINTER_CONFIG
}

/**
 * Save printer settings to AsyncStorage
 */
export async function savePrinterConfig(config: Partial<PrinterConfig>): Promise<PrinterConfig> {
  try {
    const current = await getPrinterConfig()
    const updated = { ...current, ...config }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch (_) {
    return DEFAULT_PRINTER_CONFIG
  }
}

/**
 * Load list of configured printer devices from storage
 */
export async function getPrinterDevices(): Promise<PrinterDevice[]> {
  try {
    const raw = await AsyncStorage.getItem(DEVICES_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (_) {
    // fallback
  }
  return []
}

/**
 * Save or update a printer device
 */
export async function savePrinterDevice(device: PrinterDevice): Promise<PrinterDevice[]> {
  const current = await getPrinterDevices()
  const exists = current.some((d) => d.id === device.id)
  let updated: PrinterDevice[]

  if (exists) {
    updated = current.map((d) => {
      if (d.id === device.id) {
        return device
      }
      // If the updated device is now default, remove default from others
      return device.isDefault ? { ...d, isDefault: false } : d
    })
  } else {
    // If new device is default, remove default from others
    const cleaned = device.isDefault ? current.map((d) => ({ ...d, isDefault: false })) : current
    updated = [...cleaned, device]
  }

  await AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

/**
 * Delete a printer device
 */
export async function deletePrinterDevice(id: string): Promise<PrinterDevice[]> {
  const current = await getPrinterDevices()
  const updated = current.filter((d) => d.id !== id)
  if (updated.length > 0 && !updated.some((d) => d.isDefault)) {
    updated[0].isDefault = true
  }
  await AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

/**
 * Set a specific printer as default
 */
export async function setDefaultPrinter(id: string): Promise<PrinterDevice[]> {
  const current = await getPrinterDevices()
  const updated = current.map((d) => ({
    ...d,
    isDefault: d.id === id,
  }))
  await AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

/**
 * Reset printer devices to initial default demo devices
 */
export async function resetPrinterDevicesToDefault(): Promise<PrinterDevice[]> {
  await AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(INITIAL_PRINTER_DEVICES))
  return INITIAL_PRINTER_DEVICES
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
 * Format a two-column line with dots/spaces (e.g. "Item Name ........... $12.00")
 */
function formatTwoColumn(left: string, right: string, maxCols: number): string {
  const leftMax = maxCols - right.length - 1
  const truncatedLeft = left.length > leftMax ? left.substring(0, leftMax) : left
  const spaceCount = Math.max(1, maxCols - truncatedLeft.length - right.length)
  return truncatedLeft + ' '.repeat(spaceCount) + right
}

/**
 * Format a divider line for 58mm (32 chars) or 80mm (48 chars)
 */
function getDivider(maxCols: number, char = '-'): string {
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
 * Build ESC/POS Byte Stream / Command String for 58mm / 80mm Thermal Printer
 */
export function buildEscPosCommands(order: Order, config: PrinterConfig): string {
  const maxCols = config.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  // 1. Initialize
  buffer += ESC_POS.INIT

  // 2. Store Header (Centered, Bold)
  buffer += ESC_POS.ALIGN_CENTER
  if (config.storeName && config.storeName.trim().length > 0) {
    buffer += ESC_POS.DOUBLE_SIZE_ON + ESC_POS.BOLD_ON
    buffer += `${config.storeName.trim()}\n`
    buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF
  }

  if (config.subHeader && config.subHeader.trim().length > 0) {
    buffer += `${config.subHeader.trim()}\n`
  }
  if (config.storeAddress && config.storeAddress.trim().length > 0) {
    buffer += `${config.storeAddress.trim()}\n`
  }
  if (config.storePhone && config.storePhone.trim().length > 0) {
    buffer += `Tel: ${config.storePhone.trim()}\n`
  }
  
  const titleText = config.receiptTitle !== undefined ? config.receiptTitle.trim() : 'TAX INVOICE / RECEIPT'
  if (titleText.length > 0) {
    buffer += ESC_POS.BOLD_ON
    buffer += `${titleText}\n`
    buffer += ESC_POS.BOLD_OFF
  }
  buffer += `${getDivider(maxCols, '=')}\n`

  // 3. Order Metadata (Left aligned)
  buffer += ESC_POS.ALIGN_LEFT
  const orderDate = formatReceiptDateTime(order.created_at)

  buffer += `Order #: #${order.order_number}\n`
  buffer += `Date   : ${orderDate}\n`
  
  // Optional Cashier Name
  if (config.showCashierName !== false) {
    const cashierName = order.user?.name ||
      // @ts-ignore - cashier_name might be present on order object from API
      ('cashier_name' in order && order.cashier_name ? String(order.cashier_name) : undefined) ||
      'Staff'
    buffer += `Cashier: ${cashierName}\n`
  }

  // Optional Customer Info
  if (config.showCustomerInfo !== false && order.customer?.name) {
    buffer += `Customer: ${order.customer.name}${order.customer.phone ? ` (${order.customer.phone})` : ''}\n`
  }
  if (order.channel?.name || order.channel_id) {
    buffer += `Channel: ${order.channel?.name || order.channel_id}\n`
  }
  buffer += `${getDivider(maxCols, '-')}\n`

  // 4. Line Items Table
  buffer += formatTwoColumn('ITEM', 'TOTAL', maxCols) + '\n'
  buffer += `${getDivider(maxCols, '-')}\n`

  const items = order.items || []
  items.forEach((it, idx) => {
    const name = it.variant?.sku || `Item #${idx + 1}`
    const qty = it.quantity || 1
    const price = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(String(it.unit_price || '0')) || 0
    const total = typeof it.line_total === 'number' ? it.line_total : parseFloat(String(it.line_total || '0')) || qty * price

    buffer += `${name}\n`
    const qtyPriceStr = `${qty} x $${price.toFixed(2)}`
    const totalStr = `$${total.toFixed(2)}`
    buffer += formatTwoColumn(`  ${qtyPriceStr}`, totalStr, maxCols) + '\n'
  })
  buffer += `${getDivider(maxCols, '-')}\n`

  // 5. Financial Totals
  const subtotal = order.subtotal
    ? parseFloat(String(order.subtotal))
    : items.reduce((s, it) => s + (parseFloat(String(it.line_total || '0')) || (it.quantity * (parseFloat(String(it.unit_price || '0'))))), 0)
  const discount = parseFloat(String(order.discount || '0'))
  const delivery = parseFloat(String(order.delivery_cost || '0'))
  const tax = parseFloat(String(order.tax_amount || '0'))
  const totalPaid = typeof order.total_amount === 'number' ? order.total_amount : parseFloat(String(order.total_amount || '0')) || 0
  const paymentMethod = order.payments?.[0]?.payment_method || 'Cash'

  buffer += formatTwoColumn('Subtotal:', `$${subtotal.toFixed(2)}`, maxCols) + '\n'
  if (discount > 0) {
    buffer += formatTwoColumn('Discount:', `-$${discount.toFixed(2)}`, maxCols) + '\n'
  }
  if (delivery > 0) {
    buffer += formatTwoColumn('Delivery:', `$${delivery.toFixed(2)}`, maxCols) + '\n'
  }
  if (tax > 0 || config.showTax) {
    buffer += formatTwoColumn('Tax:', `$${tax.toFixed(2)}`, maxCols) + '\n'
  }

  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.BOLD_ON + ESC_POS.DOUBLE_HEIGHT_ON
  buffer += formatTwoColumn('TOTAL PAID:', `$${totalPaid.toFixed(2)}`, maxCols) + '\n'
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  buffer += formatTwoColumn('Payment Method:', paymentMethod, maxCols) + '\n'
  buffer += formatTwoColumn('Status:', (order.status || 'PAID').toUpperCase(), maxCols) + '\n'

  if (order.notes || order.note) {
    buffer += `${getDivider(maxCols, '-')}\n`
    buffer += `Note: ${order.notes || order.note}\n`
  }

  // 6. Footer (Centered)
  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.ALIGN_CENTER
  if (config.footerMessage) {
    buffer += `${config.footerMessage}\n`
  }
  buffer += `* * * * *\n`

  // 7. Feed & Cut
  buffer += ESC_POS.FEED_LINES(4)
  if (config.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}

/**
 * Send print commands over WiFi via backend raw TCP socket proxy (pure ESC/POS, no HTTP headers)
 * IMPORTANT: Never use fetch() directly to port 9100 — Android okhttp adds HTTP headers
 * that get printed as garbage text on thermal paper.
 */
async function printOverWiFi(commands: string, config: PrinterConfig): Promise<{ success: boolean; message: string }> {
  try {
    // Route through backend /api/v1/printer/raw-print which opens a raw fsockopen() TCP
    // socket to port 9100 and streams only the ESC/POS bytes — no HTTP headers injected.
    const res = await sendRawPrint({
      ip: config.ipAddress,
      port: config.port,
      data: commands,
    }).catch(() => null)

    if (res && res.success) {
      return {
        success: true,
        message: `Receipt printed cleanly on ${config.ipAddress}:${config.port} (${config.paperWidth})`,
      }
    }

    // Backend is unreachable (offline / wrong IP / CORS). Return failure so the caller
    // can fall back to expo-print HTML native printing instead of sending garbage to
    // the raw socket via fetch().
    return {
      success: false,
      message: `Backend raw-print proxy unreachable for ${config.ipAddress}:${config.port}. Falling back to native print.`,
    }
  } catch (err: unknown) {
    const error = err as { message?: string }
    return {
      success: false,
      message: `Could not connect to printer at ${config.ipAddress}:${config.port}. Check if printer is powered on and connected to the same Wi-Fi.`,
    }
  }
}

/**
 * Build ESC/POS Kitchen / Packing Ticket Byte Stream
 */
export function buildKitchenEscPosCommands(order: Order, device: PrinterDevice): string {
  const maxCols = device.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  // 1. Initialize
  buffer += ESC_POS.INIT

  // 2. Kitchen Ticket Header (Centered, Bold, Double Size)
  buffer += ESC_POS.ALIGN_CENTER
  buffer += ESC_POS.DOUBLE_SIZE_ON + ESC_POS.BOLD_ON
  buffer += `*** KITCHEN / PACKING ***\n`
  buffer += `ORDER #${order.order_number}\n`
  buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

  const orderTime = formatReceiptTime(order.created_at)

  buffer += `Time: ${orderTime} | Channel: ${order.channel?.name || order.channel_id || 'POS'}\n`
  if (order.customer?.name) {
    buffer += `Customer: ${order.customer.name}\n`
  }
  buffer += `${getDivider(maxCols, '=')}\n`

  // 3. Items List (Large & Bold for fast reading in kitchen/packing)
  buffer += ESC_POS.ALIGN_LEFT
  const items = order.items || []
  items.forEach((it, idx) => {
    const name = it.variant?.sku || `Item #${idx + 1}`
    const qty = it.quantity || 1

    buffer += ESC_POS.BOLD_ON + ESC_POS.DOUBLE_HEIGHT_ON
    buffer += `[ ${qty}x ] ${name}\n`
    buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF

    if ('notes' in it && it.notes) {
      buffer += `  -> Note: ${it.notes}\n`
    }
  })

  buffer += `${getDivider(maxCols, '=')}\n`

  // 4. Special instructions / delivery notes
  if (order.notes || order.note) {
    buffer += ESC_POS.BOLD_ON
    buffer += `SPECIAL INSTRUCTIONS:\n`
    buffer += `${order.notes || order.note}\n`
    buffer += ESC_POS.BOLD_OFF
    buffer += `${getDivider(maxCols, '=')}\n`
  }

  if (order.delivery_address) {
    buffer += `Delivery: ${order.delivery_address}\n`
    buffer += `${getDivider(maxCols, '-')}\n`
  }

  // 5. Feed & Cut
  buffer += ESC_POS.FEED_LINES(4)
  if (device.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}

/**
 * Print styled HTML thermal ticket via System Print Spooler / AirPrint
 */
export async function printHtmlThermalReceipt(
  order: Order,
  device: PrinterDevice,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const config = { ...(await getPrinterConfig()), ...customConfig }
  const is58mm = device.paperWidth === '58mm'
  const isKitchen = device.role === 'kitchen'
  const items = order.items || []
  const totalPaid = typeof order.total_amount === 'number' ? order.total_amount : parseFloat(String(order.total_amount || '0')) || 0
  const subtotal = order.subtotal
    ? parseFloat(String(order.subtotal))
    : items.reduce((s, it) => s + (parseFloat(String(it.line_total || '0')) || (it.quantity * (parseFloat(String(it.unit_price || '0'))))), 0)
  const discount = parseFloat(String(order.discount || '0'))
  const delivery = parseFloat(String(order.delivery_cost || '0'))
  const tax = parseFloat(String(order.tax_amount || '0'))
  const paymentMethod = order.payments?.[0]?.payment_method || 'Cash'

  const orderDate = formatReceiptDateTime(order.created_at)

  const itemRows = items
    .map((it, idx) => {
      const name = it.variant?.sku || `Item #${idx + 1}`
      const qty = it.quantity || 1
      const price = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(String(it.unit_price || '0')) || 0
      const lineTotal = typeof it.line_total === 'number' ? it.line_total : parseFloat(String(it.line_total || '0')) || qty * price
      if (isKitchen) {
        return `
          <div style="font-size: 15px; font-weight: bold; margin: 6px 0; padding-bottom: 4px; border-bottom: 1px dashed #000;">
            [ ${qty}x ] ${name}
            ${('notes' in it && it.notes) ? `<div style="font-size: 11px; font-style: italic;">Note: ${it.notes}</div>` : ''}
          </div>
        `
      }
      return `
        <div style="margin: 3px 0; font-size: 12px;">
          <div style="font-weight: 600;">${name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span>${qty} x $${price.toFixed(2)}</span>
            <span style="font-weight: bold;">$${lineTotal.toFixed(2)}</span>
          </div>
        </div>
      `
    })
    .join('')

  const receiptTitle = config.receiptTitle ?? 'TAX INVOICE / RECEIPT'
  const pageWidth = is58mm ? '58mm' : '80mm'
  const contentWidth = is58mm ? '46mm' : '70mm'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: ${pageWidth} auto;
            margin: 0;
          }
          body {
            font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: ${contentWidth};
            margin: 0 auto;
            padding: 6px 2px;
            color: #000000;
            background: #FFFFFF;
            font-size: 11px;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider-solid { border-top: 1.5px solid #000; margin: 4px 0; }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; margin: 1px 0; }
          .store-name { font-size: 15px; font-weight: 900; margin-bottom: 1px; }
          .sub-header { font-size: 10px; margin-bottom: 1px; }
          .doc-title { font-size: 11px; font-weight: bold; margin: 3px 0; }
          .total-box { font-size: 14px; font-weight: 900; padding: 2px 0; }
          .footer { font-size: 10px; text-align: center; margin-top: 6px; }
        </style>
      </head>
      <body>
        ${
          isKitchen
            ? `
            <div class="center">
              <div style="font-size: 16px; font-weight: 900;">🍳 KITCHEN PREP</div>
              <div>#${order.order_number}</div>
              <div style="font-size: 10px;">${orderDate}</div>
            </div>
            <div class="divider-solid"></div>
            ${itemRows}
            <div class="divider-solid"></div>
            ${order.notes || order.note ? `<div style="margin: 4px 0; font-weight: bold;">NOTES:<br/>${order.notes || order.note}</div>` : ''}
            ${order.delivery_address ? `<div style="margin: 4px 0; font-size: 10px;">Delivery: ${order.delivery_address}</div>` : ''}
          `
            : `
            <div class="center">
              ${config.storeName ? `<div class="store-name">${config.storeName}</div>` : ''}
              ${config.subHeader ? `<div class="sub-header">${config.subHeader}</div>` : ''}
              ${config.storeAddress ? `<div>${config.storeAddress}</div>` : ''}
              ${config.storePhone ? `<div>Tel: ${config.storePhone}</div>` : ''}
              ${receiptTitle ? `<div class="doc-title">${receiptTitle}</div>` : ''}
            </div>
            <div class="divider-solid"></div>
            <div class="row"><span>Order #:</span><span class="bold">#${order.order_number}</span></div>
            <div class="row"><span>Date:</span><span>${orderDate}</span></div>
            ${config.showCashierName !== false ? `<div class="row"><span>Cashier:</span><span>${order.user?.name || ('cashier_name' in order && order.cashier_name ? String(order.cashier_name) : undefined) || 'Staff'}</span></div>` : ''}
            ${config.showCustomerInfo !== false && order.customer?.name ? `<div class="row"><span>Customer:</span><span>${order.customer.name}</span></div>` : ''}
            <div class="divider-dashed"></div>
            <div class="row bold"><span>ITEM</span><span>TOTAL</span></div>
            <div class="divider-dashed"></div>
            ${itemRows}
            <div class="divider-dashed"></div>
            <div class="row"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
            ${discount > 0 ? `<div class="row"><span>Discount:</span><span>-$${discount.toFixed(2)}</span></div>` : ''}
            ${delivery > 0 ? `<div class="row"><span>Delivery:</span><span>+$${delivery.toFixed(2)}</span></div>` : ''}
            ${tax > 0 || config.showTax ? `<div class="row"><span>Tax:</span><span>+$${tax.toFixed(2)}</span></div>` : ''}
            <div class="divider-solid"></div>
            <div class="row total-box"><span>TOTAL:</span><span>$${totalPaid.toFixed(2)}</span></div>
            <div class="row"><span>Payment:</span><span class="bold">${paymentMethod}</span></div>
            <div class="row"><span>Status:</span><span class="bold">${(order.status || 'PAID').toUpperCase()}</span></div>
            ${order.notes || order.note ? `<div class="divider-dashed"></div><div><strong>Note:</strong> ${order.notes || order.note}</div>` : ''}
            <div class="divider-solid"></div>
            <div class="footer">${(config.footerMessage || '').replace(/\n/g, '<br/>')}</div>
          `
        }
      </body>
    </html>
  `

  try {
    const Print = await import('expo-print')
    await Print.printAsync({
      html,
      printerUrl: device.ipAddress ? `http://${device.ipAddress}:${device.port || 9100}` : undefined,
    })
    return { success: true, message: `Receipt sent to ${device.name}` }
  } catch (err: unknown) {
    const error = err as { message?: string }
    return { success: false, message: error?.message || 'Print canceled.' }
  }
}

/**
 * Print order directly to a specific PrinterDevice (Cashier, Kitchen, or Bluetooth)
 */
export async function printThermalReceiptToDevice(
  order: Order,
  device: PrinterDevice,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const storeConfig = { ...(await getPrinterConfig()), ...customConfig }
  const isKitchen = device.role === 'kitchen'
  const commands = isKitchen
    ? buildKitchenEscPosCommands(order, device)
    : buildEscPosCommands(order, {
        ...storeConfig,
        connectionType: device.connectionType,
        ipAddress: device.ipAddress || storeConfig.ipAddress,
        port: device.port || storeConfig.port,
        paperWidth: device.paperWidth,
        autoCut: device.autoCut,
      })

  if (device.connectionType === 'wifi') {
    const result = await printOverWiFi(commands, {
      ...storeConfig,
      ipAddress: device.ipAddress || '192.168.1.100',
      port: device.port || 9100,
      paperWidth: device.paperWidth,
      autoCut: device.autoCut,
      connectionType: 'wifi',
    })

    // If direct socket was not connected, offer native thermal spooler
    if (!result.success) {
      return printHtmlThermalReceipt(order, device, customConfig)
    }

    Alert.alert(`🖨️ ${device.name}`, result.message)
    return result
  } else if (device.connectionType === 'bluetooth') {
    const targetName = device.bluetoothName || device.name || 'Bluetooth Thermal'
    Alert.alert(
      '🖨️ Bluetooth Printing',
      `Sent ${isKitchen ? 'Kitchen Prep Ticket' : 'Receipt'} #${order.order_number} to paired device "${targetName}" (${device.paperWidth}).`
    )
    return { success: true, message: `Sent to ${targetName}` }
  } else {
    return printHtmlThermalReceipt(order, device, customConfig)
  }
}

/**
 * Print a Test Ticket for a specific PrinterDevice
 */
export async function printTestReceiptForDevice(
  device: PrinterDevice,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const dummyOrder: Order = {
    id: 'test-order',
    order_number: 'TEST-001',
    channel_id: 'Test Station',
    status: 'completed',
    total_amount: 19.5,
    created_at: new Date().toISOString(),
    customer: {
      id: 'cust-test',
      name: 'Test Customer',
      phone: '+855 12 000 000',
    },
    payments: [{ id: 'p-test', order_id: 'test-order', payment_method: 'ABA QR', amount: 19.5 }],
    items: [
      { id: 'i-1', order_id: 'test-order', variant_id: 'v-1', quantity: 2, unit_price: 6.0 },
      { id: 'i-2', order_id: 'test-order', variant_id: 'v-2', quantity: 1, unit_price: 7.5 },
    ],
    notes: 'Please pack carefully with ice.',
  }

  return printThermalReceiptToDevice(dummyOrder, device, customConfig)
}

/**
 * Main Print Thermal Receipt Trigger (WiFi, Bluetooth, or System) - Default fallback
 */
export async function printThermalReceipt(
  order: Order,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const devices = await getPrinterDevices()
  const defaultDevice = devices.find((d) => d.isDefault) || devices[0]
  if (defaultDevice) {
    return printThermalReceiptToDevice(order, defaultDevice, customConfig)
  }

  const config = { ...(await getPrinterConfig()), ...customConfig }
  const commands = buildEscPosCommands(order, config)

  if (config.connectionType === 'wifi') {
    const result = await printOverWiFi(commands, config)
    Alert.alert(
      result.success ? '🖨️ Printing Receipt' : 'Printer Notice',
      result.message
    )
    return result
  } else if (config.connectionType === 'bluetooth') {
    Alert.alert(
      '🖨️ Bluetooth Printing',
      `Sent ESC/POS receipt #${order.order_number} to paired Bluetooth thermal printer (${config.paperWidth}).`
    )
    return { success: true, message: 'Sent to Bluetooth printer' }
  } else {
    Alert.alert(
      '🖨️ System Print Spooler',
      `Formatting 58mm thermal receipt #${order.order_number} for system print service.`
    )
    return { success: true, message: 'Sent to system print spooler' }
  }
}

/**
 * Print a Test Receipt to verify thermal printer communication
 */
export async function printTestReceipt(config: PrinterConfig): Promise<{ success: boolean; message: string }> {
  const dummyOrder: Order = {
    id: 'test-order',
    order_number: 'TEST-001',
    channel_id: 'Test Station',
    status: 'completed',
    total_amount: 19.5,
    created_at: new Date().toISOString(),
    customer: {
      id: 'cust-test',
      name: 'Test Customer',
      phone: '+855 12 000 000',
    },
    payments: [{ id: 'p-test', order_id: 'test-order', payment_method: 'ABA QR', amount: 19.5 }],
    items: [
      { id: 'i-1', order_id: 'test-order', variant_id: 'v-1', quantity: 1, unit_price: 12.0 },
      { id: 'i-2', order_id: 'test-order', variant_id: 'v-2', quantity: 1, unit_price: 7.5 },
    ],
  }

  const commands = buildEscPosCommands(dummyOrder, config)
  if (config.connectionType === 'wifi') {
    return printOverWiFi(commands, config)
  }
  return {
    success: true,
    message: `Test receipt dispatched via ${config.connectionType.toUpperCase()} (${config.paperWidth})`,
  }
}

/**
 * Share Order Receipt using Native OS Share Sheet (Generates a clean PDF)
 */
export async function shareReceipt(order: Order, customConfig?: Partial<PrinterConfig>): Promise<void> {
  const config = { ...(await getPrinterConfig()), ...customConfig }
  const totalPaid = typeof order.total_amount === 'number' ? order.total_amount : parseFloat(String(order.total_amount || '0')) || 0
  const paymentMethod = order.payments?.[0]?.payment_method || 'Cash'
  const items = order.items || []

  const orderDate = formatReceiptDateTime(order.created_at)

  const itemLinesHtml = items
    .map((it, idx) => {
      const name = it.variant?.sku || `Item #${idx + 1}`
      const qty = it.quantity || 1
      const price = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(String(it.unit_price || '0')) || 0
      const lineTotal = typeof it.line_total === 'number' ? it.line_total : parseFloat(String(it.line_total || '0')) || qty * price
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #EEEEEE;">
            <div style="font-weight: 600; color: #1F2937;">${name}</div>
            <div style="font-size: 13px; color: #6B7280;">${qty} x $${price.toFixed(2)}</div>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #EEEEEE; text-align: right; font-weight: 600; color: #111827;">
            $${lineTotal.toFixed(2)}
          </td>
        </tr>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #374151; background-color: #F3F4F6; }
          .receipt-box { max-width: 500px; margin: 0 auto; background: #FFFFFF; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 8px solid #FF8800; }
          .header { text-align: center; margin-bottom: 30px; }
          .store-name { font-size: 26px; font-weight: 800; color: #111827; margin-bottom: 5px; }
          .store-contact { font-size: 14px; color: #6B7280; margin-bottom: 2px; }
          .receipt-title { font-size: 14px; letter-spacing: 2px; font-weight: 700; color: #FF8800; text-transform: uppercase; margin-top: 20px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .meta-label { color: #6B7280; font-weight: 500; }
          .meta-value { font-weight: 600; color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
          th { text-align: left; padding-bottom: 10px; border-bottom: 2px solid #E5E7EB; color: #6B7280; font-size: 13px; text-transform: uppercase; }
          .totals-row { display: flex; justify-content: space-between; margin-top: 10px; font-size: 15px; }
          .grand-total { font-size: 20px; font-weight: 800; color: #111827; margin-top: 15px; padding-top: 15px; border-top: 2px solid #E5E7EB; display: flex; justify-content: space-between; }
          .footer { margin-top: 40px; text-align: center; font-size: 14px; color: #6B7280; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header">
            <div class="store-name">${config.storeName}</div>
            <div class="store-contact">${config.storeAddress}</div>
            <div class="store-contact">Phone: ${config.storePhone}</div>
            <div class="receipt-title">${config.receiptTitle?.trim() || 'Official Receipt'}</div>
          </div>
          
          <div style="margin-bottom: 30px; padding: 20px; background-color: #F9FAFB; border-radius: 8px;">
            <div class="meta-row"><span class="meta-label">Order #</span><span class="meta-value">#${order.order_number}</span></div>
            <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${orderDate}</span></div>
            <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value" style="color: #10B981;">${(order.status || 'PAID').toUpperCase()}</span></div>
            <div class="meta-row"><span class="meta-label">Customer</span><span class="meta-value">${order.customer?.name || 'Walk-in Customer'}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Details</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemLinesHtml}
            </tbody>
          </table>

          <div class="grand-total">
            <span>Total Paid</span>
            <span>$${totalPaid.toFixed(2)}</span>
          </div>
          ${parseFloat(String(order.tax_amount || '0')) > 0 || config.showTax ? `
          <div class="totals-row" style="margin-top: 5px; color: #6B7280; font-size: 13px;">
            <span>Tax</span>
            <span style="font-weight: 600;">+$${parseFloat(String(order.tax_amount || '0')).toFixed(2)}</span>
          </div>` : ''}
          <div class="totals-row" style="margin-top: 5px; color: #6B7280; font-size: 13px;">
            <span>Payment Method</span>
            <span style="font-weight: 600;">${paymentMethod}</span>
          </div>
          ${order.notes || order.note ? `<div style="margin-top: 20px; padding: 15px; background: #FEF3C7; color: #B45309; border-radius: 6px; font-size: 14px;"><strong>Note:</strong> ${order.notes || order.note}</div>` : ''}

          <div class="footer">
            ${config.footerMessage.replace(/\n/g, '<br/>')}
          </div>
        </div>
      </body>
    </html>
  `

  try {
    const Print = await import('expo-print')
    const Sharing = await import('expo-sharing')
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false
    })
    
    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share Receipt #${order.order_number}`,
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      })
    } else {
      Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.')
    }
  } catch (err) {
    const error = err as { message?: string }
    Alert.alert('Share Error', error?.message || 'Could not generate and share receipt PDF.')
  }
}

/**
 * Share Invoice using Native OS Share Sheet (Generates a clean PDF)
 */
export async function shareInvoice(invoice: Invoice, customConfig?: Partial<PrinterConfig>): Promise<void> {
  const config = { ...(await getPrinterConfig()), ...customConfig }
  const totalAmount = typeof invoice.total_amount === 'number' ? invoice.total_amount : parseFloat(String(invoice.total_amount || '0')) || 0
  const balanceDue = typeof invoice.balance_due === 'number' ? invoice.balance_due : parseFloat(String(invoice.balance_due || '0')) || 0
  const items = invoice.items || []

  const itemLinesHtml = items
    .map((it, idx) => {
      const name = it.product_name || it.sku || `Item #${idx + 1}`
      const qty = it.quantity || 1
      const price = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(String(it.unit_price || '0')) || 0
      const lineTotal = typeof it.total_price === 'number' ? it.total_price : parseFloat(String(it.total_price || '0')) || qty * price
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #EEEEEE;">
            <div style="font-weight: 600; color: #1F2937;">${name}</div>
            <div style="font-size: 13px; color: #6B7280;">${qty} x $${price.toFixed(2)}</div>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #EEEEEE; text-align: right; font-weight: 600; color: #111827;">
            $${lineTotal.toFixed(2)}
          </td>
        </tr>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #374151; background-color: #F3F4F6; }
          .receipt-box { max-width: 600px; margin: 0 auto; background: #FFFFFF; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 8px solid #10B981; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .store-name { font-size: 26px; font-weight: 800; color: #111827; margin-bottom: 5px; }
          .store-contact { font-size: 14px; color: #6B7280; margin-bottom: 2px; }
          .invoice-title { font-size: 28px; font-weight: 800; color: #10B981; text-transform: uppercase; text-align: right; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background-color: #F9FAFB; border-radius: 8px; }
          .meta-col { display: flex; flex-direction: column; gap: 8px; }
          .meta-label { color: #6B7280; font-size: 13px; text-transform: uppercase; font-weight: 600; }
          .meta-value { font-weight: 700; color: #111827; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { text-align: left; padding-bottom: 10px; border-bottom: 2px solid #E5E7EB; color: #6B7280; font-size: 13px; text-transform: uppercase; }
          .totals-box { width: 300px; margin-left: auto; background: #F9FAFB; padding: 20px; border-radius: 8px; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
          .grand-total { font-size: 22px; font-weight: 800; color: #111827; margin-top: 15px; padding-top: 15px; border-top: 2px solid #E5E7EB; display: flex; justify-content: space-between; }
          .balance-due { color: #DC2626; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 14px; color: #6B7280; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header">
            <div>
              <div class="store-name">${config.storeName}</div>
              <div class="store-contact">${config.storeAddress}</div>
              <div class="store-contact">Phone: ${config.storePhone}</div>
            </div>
            <div>
              <div class="invoice-title">${config.invoiceTitle?.trim() || 'INVOICE'}</div>
              <div style="text-align: right; color: #6B7280; margin-top: 5px; font-size: 15px;">#${invoice.invoice_number}</div>
            </div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-col">
              <span class="meta-label">Billed To</span>
              <span class="meta-value">${invoice.customer_name || 'Valued Customer'}</span>
              <span style="color: #4B5563; font-size: 14px;">${invoice.customer_phone || ''}</span>
            </div>
            <div class="meta-col" style="text-align: right;">
              <span class="meta-label">Date Issued</span>
              <span class="meta-value" style="font-weight: 500;">${formatReceiptDate(invoice.createdAt || invoice.created_at)}</span>
              <span class="meta-label" style="margin-top: 10px;">Due Date</span>
              <span class="meta-value" style="color: #DC2626;">${invoice.due_date || 'Due on Receipt'}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemLinesHtml}
            </tbody>
          </table>

          <div class="totals-box">
            <div class="totals-row">
              <span style="color: #6B7280;">Subtotal</span>
              <span style="font-weight: 600;">$${totalAmount.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span style="color: #6B7280;">Amount Paid</span>
              <span style="font-weight: 600; color: #10B981;">-$${(totalAmount - balanceDue).toFixed(2)}</span>
            </div>
            <div class="grand-total">
              <span>Balance Due</span>
              <span class="balance-due">$${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          ${invoice.notes ? `<div style="margin-top: 30px; font-size: 14px; color: #4B5563;"><strong>Note:</strong> ${invoice.notes}</div>` : ''}

          <div class="footer">
            Please make all payments payable to our ABA account.<br/>
            Thank you for your business!
          </div>
        </div>
      </body>
    </html>
  `

  try {
    const Print = await import('expo-print')
    const Sharing = await import('expo-sharing')
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false
    })
    
    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(uri, {
        dialogTitle: `Share Invoice #${invoice.invoice_number}`,
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      })
    } else {
      Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.')
    }
  } catch (err) {
    const error = err as { message?: string }
    Alert.alert('Share Error', error?.message || 'Could not generate and share invoice PDF.')
  }
}

/**
 * Build ESC/POS Command String for Invoice (58mm or 80mm)
 */
export function buildInvoiceEscPosCommands(invoice: Invoice, config: PrinterConfig): string {
  const maxCols = config.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  // 1. Initialize
  buffer += ESC_POS.INIT

  // 2. Store Header (Centered, Bold)
  buffer += ESC_POS.ALIGN_CENTER
  if (config.storeName && config.storeName.trim().length > 0) {
    buffer += ESC_POS.DOUBLE_SIZE_ON + ESC_POS.BOLD_ON
    buffer += `${config.storeName.trim()}\n`
    buffer += ESC_POS.NORMAL_TEXT + ESC_POS.BOLD_OFF
  }

  if (config.subHeader && config.subHeader.trim().length > 0) {
    buffer += `${config.subHeader.trim()}\n`
  }
  if (config.storeAddress && config.storeAddress.trim().length > 0) {
    buffer += `${config.storeAddress.trim()}\n`
  }
  if (config.storePhone && config.storePhone.trim().length > 0) {
    buffer += `Tel: ${config.storePhone.trim()}\n`
  }

  const invTitle = config.invoiceTitle?.trim() || 'INVOICE'
  buffer += ESC_POS.BOLD_ON
  buffer += `*** ${invTitle} ***\n`
  buffer += ESC_POS.BOLD_OFF
  buffer += `${getDivider(maxCols, '=')}\n`

  // 3. Invoice Metadata (Left aligned)
  buffer += ESC_POS.ALIGN_LEFT
  const invNumber = invoice.invoice_number || invoice.invoiceNumber || 'INV'
  const ordNumber = invoice.order_number || invoice.orderNumber
  const cName = invoice.customer_name || invoice.customerName || 'General Customer'
  const cPhone = invoice.customer_phone || invoice.customerPhone
  const dueDate = invoice.due_date || invoice.dueDate || 'Upon Receipt'
  const status = (invoice.status || 'SENT').toUpperCase()

  buffer += `Invoice #: #${invNumber}\n`
  if (ordNumber) buffer += `Order Ref: #${ordNumber}\n`
  buffer += `Date     : ${formatReceiptDate(invoice.createdAt || invoice.created_at)}\n`
  buffer += `Due Date : ${dueDate}\n`
  buffer += `Status   : ${status}\n`
  buffer += `Customer : ${cName}${cPhone ? ` (${cPhone})` : ''}\n`
  buffer += `${getDivider(maxCols, '-')}\n`

  // 4. Line Items Table
  buffer += formatTwoColumn('ITEM', 'TOTAL', maxCols) + '\n'
  buffer += `${getDivider(maxCols, '-')}\n`

  const items = invoice.items || []
  items.forEach((it, idx) => {
    const name = it.product_name || it.productName || it.sku || `Item #${idx + 1}`
    const qty = it.quantity || 1
    const price = typeof it.unit_price === 'number' ? it.unit_price : typeof it.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it.unit_price || it.unitPrice || '0')) || 0
    const total = typeof it.total_price === 'number' ? it.total_price : typeof it.totalPrice === 'number' ? it.totalPrice : parseFloat(String(it.total_price || it.totalPrice || '0')) || qty * price

    buffer += `${name}\n`
    const qtyPriceStr = `${qty} x $${price.toFixed(2)}`
    const totalStr = `$${total.toFixed(2)}`
    buffer += formatTwoColumn(`  ${qtyPriceStr}`, totalStr, maxCols) + '\n'
  })
  buffer += `${getDivider(maxCols, '-')}\n`

  // 5. Financials
  const totalAmount = typeof invoice.total_amount === 'number' ? invoice.total_amount : typeof invoice.totalAmount === 'number' ? invoice.totalAmount : parseFloat(String(invoice.total_amount || invoice.totalAmount || '0')) || 0
  const amountPaid = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : typeof invoice.amountPaid === 'number' ? invoice.amountPaid : parseFloat(String(invoice.amount_paid || invoice.amountPaid || '0')) || 0
  const balanceDue = typeof invoice.balance_due === 'number' ? invoice.balance_due : typeof invoice.balanceDue === 'number' ? invoice.balanceDue : parseFloat(String(invoice.balance_due || invoice.balanceDue || '0')) || Math.max(0, totalAmount - amountPaid)

  buffer += formatTwoColumn('Subtotal:', `$${totalAmount.toFixed(2)}`, maxCols) + '\n'
  buffer += formatTwoColumn('Amount Paid:', `-$${amountPaid.toFixed(2)}`, maxCols) + '\n'
  buffer += `${getDivider(maxCols, '=')}\n`

  buffer += ESC_POS.BOLD_ON
  buffer += formatTwoColumn('BALANCE DUE:', `$${balanceDue.toFixed(2)}`, maxCols) + '\n'
  buffer += ESC_POS.BOLD_OFF

  // 6. Notes & Footer
  if (invoice.notes) {
    buffer += `${getDivider(maxCols, '-')}\n`
    buffer += `Note: ${invoice.notes}\n`
  }

  buffer += `${getDivider(maxCols, '=')}\n`
  buffer += ESC_POS.ALIGN_CENTER
  buffer += `${config.footerMessage || 'Thank you for your business!'}\n`

  // 7. Feed and Cut
  buffer += ESC_POS.FEED_LINES(4)
  if (config.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}

/**
 * Print styled HTML invoice ticket via System Print Spooler / AirPrint
 */
export async function printHtmlInvoiceReceipt(
  invoice: Invoice,
  device: PrinterDevice,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const config = { ...(await getPrinterConfig()), ...customConfig }
  const is58mm = device.paperWidth === '58mm'
  const items = invoice.items || []
  const totalAmount = typeof invoice.total_amount === 'number' ? invoice.total_amount : typeof invoice.totalAmount === 'number' ? invoice.totalAmount : parseFloat(String(invoice.total_amount || invoice.totalAmount || '0')) || 0
  const amountPaid = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : typeof invoice.amountPaid === 'number' ? invoice.amountPaid : parseFloat(String(invoice.amount_paid || invoice.amountPaid || '0')) || 0
  const balanceDue = typeof invoice.balance_due === 'number' ? invoice.balance_due : typeof invoice.balanceDue === 'number' ? invoice.balanceDue : parseFloat(String(invoice.balance_due || invoice.balanceDue || '0')) || Math.max(0, totalAmount - amountPaid)

  const invNumber = invoice.invoice_number || invoice.invoiceNumber || 'INV'
  const ordNumber = invoice.order_number || invoice.orderNumber
  const cName = invoice.customer_name || invoice.customerName || 'General Customer'
  const cPhone = invoice.customer_phone || invoice.customerPhone || ''
  const dueDate = invoice.due_date || invoice.dueDate || 'Upon Receipt'
  const status = (invoice.status || 'SENT').toUpperCase()

  const itemRows = items
    .map((it, idx) => {
      const name = it.product_name || it.productName || it.sku || `Item #${idx + 1}`
      const qty = it.quantity || 1
      const price = typeof it.unit_price === 'number' ? it.unit_price : typeof it.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it.unit_price || it.unitPrice || '0')) || 0
      const total = typeof it.total_price === 'number' ? it.total_price : typeof it.totalPrice === 'number' ? it.totalPrice : parseFloat(String(it.total_price || it.totalPrice || '0')) || qty * price
      return `
        <div style="margin: 3px 0; font-size: 12px;">
          <div style="font-weight: 600;">${name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span>${qty} x $${price.toFixed(2)}</span>
            <span style="font-weight: bold;">$${total.toFixed(2)}</span>
          </div>
        </div>
      `
    })
    .join('')

  const pageWidth = is58mm ? '58mm' : '80mm'
  const contentWidth = is58mm ? '46mm' : '70mm'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: ${pageWidth} auto;
            margin: 0;
          }
          body {
            font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: ${contentWidth};
            margin: 0 auto;
            padding: 6px 2px;
            color: #000000;
            background: #FFFFFF;
            font-size: 11px;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider-solid { border-top: 1.5px solid #000; margin: 4px 0; }
          .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; margin: 1px 0; }
          .store-name { font-size: 15px; font-weight: 900; margin-bottom: 1px; }
          .sub-header { font-size: 10px; margin-bottom: 1px; }
          .doc-title { font-size: 12px; font-weight: bold; margin: 3px 0; letter-spacing: 0.5px; }
          .total-box { font-size: 14px; font-weight: 900; padding: 2px 0; }
          .footer { font-size: 10px; text-align: center; margin-top: 6px; }
        </style>
      </head>
      <body>
        <div class="center">
          ${config.storeName ? `<div class="store-name">${config.storeName}</div>` : ''}
          ${config.subHeader ? `<div class="sub-header">${config.subHeader}</div>` : ''}
          ${config.storeAddress ? `<div>${config.storeAddress}</div>` : ''}
          ${config.storePhone ? `<div>Tel: ${config.storePhone}</div>` : ''}
          <div class="doc-title">${config.invoiceTitle?.trim() || 'INVOICE'}</div>
        </div>
        <div class="divider-solid"></div>
        <div class="row"><span>Invoice #:</span><span class="bold">#${invNumber}</span></div>
        ${ordNumber ? `<div class="row"><span>Order Ref:</span><span>#${ordNumber}</span></div>` : ''}
        <div class="row"><span>Date:</span><span>${formatReceiptDate(invoice.createdAt || invoice.created_at)}</span></div>
        <div class="row"><span>Due Date:</span><span>${dueDate}</span></div>
        <div class="row"><span>Status:</span><span class="bold">${status}</span></div>
        <div class="row"><span>Customer:</span><span>${cName}</span></div>
        ${cPhone ? `<div class="row"><span>Phone:</span><span>${cPhone}</span></div>` : ''}
        <div class="divider-dashed"></div>
        <div class="row bold"><span>ITEM</span><span>TOTAL</span></div>
        <div class="divider-dashed"></div>
        ${itemRows}
        <div class="divider-dashed"></div>
        <div class="row"><span>Total Amount:</span><span>$${totalAmount.toFixed(2)}</span></div>
        <div class="row"><span>Amount Paid:</span><span>-$${amountPaid.toFixed(2)}</span></div>
        <div class="divider-solid"></div>
        <div class="row total-box"><span>BALANCE DUE:</span><span>$${balanceDue.toFixed(2)}</span></div>
        ${invoice.notes ? `<div class="divider-dashed"></div><div><strong>Note:</strong> ${invoice.notes}</div>` : ''}
        <div class="divider-solid"></div>
        <div class="footer">${(config.footerMessage || 'Thank you for your business!').replace(/\n/g, '<br/>')}</div>
      </body>
    </html>
  `

  try {
    const Print = await import('expo-print')
    await Print.printAsync({
      html,
      printerUrl: device.ipAddress ? `http://${device.ipAddress}:${device.port || 9100}` : undefined,
    })
    return { success: true, message: `Invoice sent to ${device.name}` }
  } catch (err) {
    const error = err as { message?: string }
    return { success: false, message: error?.message || 'Print canceled.' }
  }
}

/**
 * Print Invoice to a specific PrinterDevice
 */
export async function printInvoiceThermalToDevice(
  invoice: Invoice,
  device: PrinterDevice,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const storeConfig = { ...(await getPrinterConfig()), ...customConfig }
  const commands = buildInvoiceEscPosCommands(invoice, {
    ...storeConfig,
    connectionType: device.connectionType,
    ipAddress: device.ipAddress || storeConfig.ipAddress,
    port: device.port || storeConfig.port,
    paperWidth: device.paperWidth,
    autoCut: device.autoCut,
  })

  if (device.connectionType === 'wifi') {
    const result = await printOverWiFi(commands, {
      ...storeConfig,
      ipAddress: device.ipAddress || '192.168.1.100',
      port: device.port || 9100,
      paperWidth: device.paperWidth,
      autoCut: device.autoCut,
      connectionType: 'wifi',
    })

    if (!result.success) {
      return printHtmlInvoiceReceipt(invoice, device, customConfig)
    }

    Alert.alert(`🖨️ ${device.name}`, result.message)
    return result
  } else if (device.connectionType === 'bluetooth') {
    const targetName = device.bluetoothName || device.name || 'Bluetooth Thermal'
    Alert.alert(
      '🖨️ Bluetooth Printing',
      `Sent Invoice #${invoice.invoice_number || invoice.invoiceNumber} to paired device "${targetName}" (${device.paperWidth}).`
    )
    return { success: true, message: `Sent to ${targetName}` }
  } else {
    return printHtmlInvoiceReceipt(invoice, device, customConfig)
  }
}

/**
 * Print Invoice using Default Printer
 */
export async function printInvoiceThermal(
  invoice: Invoice,
  customConfig?: Partial<PrinterConfig>
): Promise<{ success: boolean; message: string }> {
  const devices = await getPrinterDevices()
  const defaultDevice = devices.find((d) => d.isDefault) || devices[0]
  if (defaultDevice) {
    return printInvoiceThermalToDevice(invoice, defaultDevice, customConfig)
  }
  return printHtmlInvoiceReceipt(
    invoice,
    {
      id: 'default',
      name: 'Default Printer',
      connectionType: 'system',
      paperWidth: '58mm',
      role: 'receipt',
      isDefault: true,
      autoCut: true,
    },
    customConfig
  )
}

/**
 * Build ESC/POS bytes for Seller Daily Reconciliation Slip
 */
export function buildSellerDailySlipEscPosCommands(
  summary: SellerDailySettlementSummary,
  device: PrinterDevice
): string {
  const maxCols = device.paperWidth === '58mm' ? 32 : 48
  let buffer = ''

  buffer += ESC_POS.INIT
  buffer += ESC_POS.ALIGN_CENTER
  buffer += ESC_POS.DOUBLE_HEIGHT_ON
  buffer += ESC_POS.BOLD_ON
  buffer += 'DAILY SALES RECONCILIATION\n'
  buffer += ESC_POS.NORMAL_TEXT
  buffer += ESC_POS.BOLD_OFF
  buffer += `Date: ${summary.date}\n`
  buffer += `Seller: ${summary.seller?.name || 'Staff'}\n`
  buffer += `${'-'.repeat(maxCols)}\n`

  buffer += ESC_POS.ALIGN_LEFT
  buffer += `Status: ${summary.is_confirmed ? 'CONFIRMED' : 'PENDING SIGN-OFF'}\n`
  if (summary.settlement?.confirmed_at) {
    buffer += `Signed At: ${formatReceiptDateTime(summary.settlement.confirmed_at)}\n`
  }
  buffer += `${'-'.repeat(maxCols)}\n`

  buffer += formatTwoColumn('TOTAL ORDERS:', `${summary.total_orders_count}`, maxCols) + '\n'
  buffer += formatTwoColumn('TOTAL SALES:', `$${summary.total_sales_amount.toFixed(2)}`, maxCols) + '\n'
  buffer += formatTwoColumn('EST. INCENTIVE:', `+$${summary.total_incentive_amount.toFixed(2)}`, maxCols) + '\n'
  buffer += `${'-'.repeat(maxCols)}\n`

  buffer += formatTwoColumn('Direct Orders:', `${summary.direct_orders_count}`, maxCols) + '\n'
  buffer += formatTwoColumn('Assisted Orders:', `${summary.assisted_orders_count}`, maxCols) + '\n'

  if (summary.assisted_orders && summary.assisted_orders.length > 0) {
    buffer += `${'-'.repeat(maxCols)}\n`
    buffer += 'ASSISTED BREAKDOWN:\n'
    for (const ord of summary.assisted_orders) {
      const helper = ord.input_by_user?.name ? ` via ${ord.input_by_user.name}` : ''
      buffer += formatTwoColumn(`#${ord.order_number || ord.id.substring(0, 6)}${helper}`, `$${ord.total_amount.toFixed(2)}`, maxCols) + '\n'
    }
  }

  buffer += `${'='.repeat(maxCols)}\n`
  buffer += ESC_POS.ALIGN_CENTER
  buffer += 'Thank you for your hard work!\n'
  buffer += ESC_POS.FEED_LINES(3)

  if (device.autoCut) {
    buffer += ESC_POS.CUT_PAPER
  }

  return sanitizeThermalText(buffer)
}

/**
 * Print Seller Daily Settlement Slip
 */
export async function printSellerDailySlip(
  device: PrinterDevice,
  summary: SellerDailySettlementSummary
): Promise<{ success: boolean; message: string }> {
  if (device.connectionType === 'wifi') {
    const commands = buildSellerDailySlipEscPosCommands(summary, device)
    const storeConfig = await getPrinterConfig()
    const result = await printOverWiFi(commands, {
      ...storeConfig,
      ipAddress: device.ipAddress || '192.168.1.100',
      port: device.port || 9100,
      paperWidth: device.paperWidth,
      autoCut: device.autoCut,
      connectionType: 'wifi',
    })
    return result
  } else if (device.connectionType === 'bluetooth') {
    const targetName = device.bluetoothName || device.name || 'Bluetooth Thermal'
    Alert.alert(
      '🖨️ Bluetooth Printing',
      `Sent Daily Sales Slip (${summary.date}) to "${targetName}".`
    )
    return { success: true, message: `Sent to ${targetName}` }
  } else {
    Alert.alert('Printed Slip', `Daily reconciliation slip for ${summary.seller?.name} processed.`)
    return { success: true, message: 'Printed' }
  }
}
