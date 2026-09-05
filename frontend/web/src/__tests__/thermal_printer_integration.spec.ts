import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePrintStore } from '@/stores/printStore'
import {
  buildEscPosCommands,
  buildInvoiceEscPosCommands,
  buildQuotationEscPosCommands,
  getConfiguredReceiptPrinter,
  encodeEscPosBase64,
  formatTwoColumn,
  type PrinterDevice,
} from '@/utils/thermalPrinter'
import api from '@/api/axios'

vi.mock('@/api/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: 'https://test-api.example.com/api/v1' },
  },
  ApiError: class extends Error {},
}))

describe('Thermal Printer Integration on Web', () => {
  const samplePrinter: PrinterDevice = {
    id: 'pr-wifi-1',
    name: 'Counter Thermal Printer',
    connectionType: 'wifi',
    ipAddress: '192.168.100.86',
    port: 9100,
    paperWidth: '58mm',
    role: 'receipt',
    isDefault: true,
    autoCut: true,
  }

  const sampleOrder = {
    id: 'ord-12345',
    order_number: 'ORD-2026-00042',
    created_at: '2026-09-05T12:00:00Z',
    status: 'COMPLETED',
    subtotal: 10.0,
    discount: 1.0,
    delivery_cost: 0,
    tax_amount: 0,
    total_amount: 9.0,
    user: { name: 'Alice Cashier' },
    customer: { name: 'Bob Smith', phone: '012345678' },
    channel: { name: 'POS Counter' },
    payments: [{ payment_method: 'Cash' }],
    items: [
      {
        product: { name: 'Hot Latte' },
        quantity: 2,
        unit_price: 5.0,
        total_price: 10.0,
      },
    ],
  }

  const sampleInvoice = {
    id: 'inv-12345',
    invoice_number: 'INV-2026-00001',
    order_number: 'ORD-2026-00042',
    created_at: '2026-09-05T12:00:00Z',
    due_date: '2026-10-01',
    status: 'SENT',
    total_amount: 150.0,
    amount_paid: 50.0,
    customer_name: 'Wayne Enterprises',
    customer_phone: '+1-555-0100',
    user: { name: 'Finance Staff' },
    items: [
      {
        product_name: 'Consulting Services',
        sku: 'SVC-001',
        quantity: 1,
        unit_price: 150.0,
        total_price: 150.0,
      },
    ],
  }

  const sampleQuotation = {
    id: 'qt-12345',
    quotation_number: 'QT-2026-00001',
    created_at: '2026-09-05T12:00:00Z',
    valid_until: '2026-10-05',
    status: 'SENT',
    subtotal: 200.0,
    discount: 20.0,
    total_amount: 180.0,
    customer_name: 'Acme Corp',
    customer_phone: '+1-555-0200',
    notes: 'Valid for 30 days',
    user: { name: 'Sales Rep' },
    items: [
      {
        product_name: 'Enterprise Hardware',
        sku: 'HW-900',
        quantity: 2,
        unit_price: 100.0,
        line_total: 200.0,
      },
    ],
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('builds ESC/POS commands correctly for 58mm order receipt', () => {
    const commands = buildEscPosCommands(sampleOrder, samplePrinter, {
      storeName: 'Test Coffee Store',
      storeAddress: '123 Main St',
      storePhone: '+1-555-0100',
    })

    expect(commands).toContain('Test Coffee Store')
    expect(commands).toContain('ORD-2026-00042')
    expect(commands).toContain('Hot Latte')
    expect(commands).toContain('Alice Cashier')
    expect(commands).toContain('Bob Smith')
    expect(commands).toContain('TOTAL PAID:')
    expect(commands).toContain('$9.00')
  })

  it('builds ESC/POS commands correctly for 58mm invoice', () => {
    const commands = buildInvoiceEscPosCommands(sampleInvoice, samplePrinter, {
      storeName: 'Wayne Supplies',
      receiptTitle: 'COMMERCIAL INVOICE',
    })

    expect(commands).toContain('Wayne Supplies')
    expect(commands).toContain('INV-2026-00001')
    expect(commands).toContain('Wayne Enterprises')
    expect(commands).toContain('Consulting Services')
    expect(commands).toContain('BALANCE DUE:')
    expect(commands).toContain('$100.00')
  })

  it('builds ESC/POS commands correctly for 58mm quotation', () => {
    const commands = buildQuotationEscPosCommands(sampleQuotation, samplePrinter, {
      storeName: 'Acme Vendor',
      receiptTitle: 'PRICE QUOTATION',
    })

    expect(commands).toContain('Acme Vendor')
    expect(commands).toContain('QT-2026-00001')
    expect(commands).toContain('Acme Corp')
    expect(commands).toContain('Enterprise Hardware')
    expect(commands).toContain('PROPOSED TOTAL:')
    expect(commands).toContain('$180.00')
    expect(commands).toContain('Valid for 30 days')
  })

  it('formats two columns properly with spacing', () => {
    const line = formatTwoColumn('Item A', '$5.00', 32)
    expect(line.length).toBe(32)
    expect(line.startsWith('Item A')).toBe(true)
    expect(line.endsWith('$5.00')).toBe(true)
  })

  it('encodes binary ESC/POS strings to base64 correctly', () => {
    const raw = '\x1B@\x1Ba\x01Hello World\n'
    const b64 = encodeEscPosBase64(raw)
    expect(typeof b64).toBe('string')
    expect(b64.length).toBeGreaterThan(0)
    expect(decodeURIComponent(escape(atob(b64)))).toBe(raw)
  })

  it('detects configured receipt printer from localStorage', () => {
    expect(getConfiguredReceiptPrinter()).toBeNull()

    localStorage.setItem('omnipos_printers', JSON.stringify([samplePrinter]))
    const printer = getConfiguredReceiptPrinter()
    expect(printer).not.toBeNull()
    expect(printer?.ipAddress).toBe('192.168.100.86')
    expect(printer?.port).toBe(9100)
  })

  it('printReceipt directly posts ESC/POS bytes to /printer/raw-print when printer is configured', async () => {
    localStorage.setItem('omnipos_printers', JSON.stringify([samplePrinter]))
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Print job sent' },
    } as any)

    const printStore = usePrintStore()
    const result = await printStore.printReceipt('ord-12345', sampleOrder)

    expect(result.success).toBe(true)
    expect(result.directPrint).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/printer/raw-print', {
      ip: '192.168.100.86',
      port: 9100,
      data: expect.any(String),
      encoding: 'base64',
    })
  })

  it('printInvoice directly posts ESC/POS bytes to /printer/raw-print when printer is configured', async () => {
    localStorage.setItem('omnipos_printers', JSON.stringify([samplePrinter]))
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Print job sent' },
    } as any)

    const printStore = usePrintStore()
    const result = await printStore.printInvoice('inv-12345', sampleInvoice)

    expect(result.success).toBe(true)
    expect(result.directPrint).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/printer/raw-print', {
      ip: '192.168.100.86',
      port: 9100,
      data: expect.any(String),
      encoding: 'base64',
    })
  })

  it('printQuotation directly posts ESC/POS bytes to /printer/raw-print when printer is configured', async () => {
    localStorage.setItem('omnipos_printers', JSON.stringify([samplePrinter]))
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Print job sent' },
    } as any)

    const printStore = usePrintStore()
    const result = await printStore.printQuotation('qt-12345', sampleQuotation)

    expect(result.success).toBe(true)
    expect(result.directPrint).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/printer/raw-print', {
      ip: '192.168.100.86',
      port: 9100,
      data: expect.any(String),
      encoding: 'base64',
    })
  })

  it('printInvoice falls back to window.open when no printer is configured', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({
      addEventListener: vi.fn(),
      localStorage: { setItem: vi.fn() },
    } as any)

    const printStore = usePrintStore()
    const result = await printStore.printInvoice('inv-12345')

    expect(result.success).toBe(true)
    expect(result.directPrint).toBe(false)
    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('/invoices/inv-12345/receipt'),
      '_blank',
      expect.any(String)
    )
  })

  it('printQuotation falls back to window.open when no printer is configured', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({
      addEventListener: vi.fn(),
      localStorage: { setItem: vi.fn() },
    } as any)

    const printStore = usePrintStore()
    const result = await printStore.printQuotation('qt-12345')

    expect(result.success).toBe(true)
    expect(result.directPrint).toBe(false)
    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('/quotations/qt-12345/receipt'),
      '_blank',
      expect.any(String)
    )
  })

  it('respects configured store branding (e.g. KC Shop, address, phone, header, footer)', async () => {
    localStorage.setItem('omnipos_branding', JSON.stringify({
      store_name: 'KC Shop',
      store_address: 'Phnom Penh, Cambodia',
      store_phone: '+855 12 345 678',
      receipt_header: 'Official Receipt',
      receipt_footer: 'Thank You Bong',
    }))
    localStorage.setItem('omnipos_printers', JSON.stringify([samplePrinter]))

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Print job sent' },
    } as any)

    const printStore = usePrintStore()
    await printStore.printReceipt('ord-12345', sampleOrder)

    expect(api.post).toHaveBeenCalledWith('/printer/raw-print', expect.objectContaining({
      ip: '192.168.100.86',
      port: 9100,
      encoding: 'base64',
    }))

    const postCall = vi.mocked(api.post).mock.calls[0]
    const base64Data = (postCall[1] as any).data
    const decodedEscPos = decodeURIComponent(escape(atob(base64Data)))

    expect(decodedEscPos).toContain('KC Shop')
    expect(decodedEscPos).toContain('Phnom Penh, Cambodia')
    expect(decodedEscPos).toContain('+855 12 345 678')
    expect(decodedEscPos).toContain('Official Receipt')
    expect(decodedEscPos).toContain('Thank You Bong')
    expect(decodedEscPos).not.toContain('OmniPOS Store')
  })
})
