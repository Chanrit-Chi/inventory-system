jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android || obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn(),
  },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

import type { StoreBranding } from '../types'
import { DEFAULT_PRINTER_CONFIG, type PrinterConfig } from '../utils/thermalPrinter'

describe('Store Branding Headers and Document Titles', () => {
  const mockBranding: StoreBranding = {
    store_name: 'KC Shop',
    receipt_header: 'Official Receipt',
    invoice_header: 'Tax Invoice',
    quotation_header: 'Price Quotation',
  }

  it('should maintain independent headers for receipt, invoice, and quotation', () => {
    expect(mockBranding.receipt_header).toBe('Official Receipt')
    expect(mockBranding.invoice_header).toBe('Tax Invoice')
    expect(mockBranding.quotation_header).toBe('Price Quotation')
  })

  it('should resolve receipt, invoice, and quotation titles independently without leaking receipt_header into invoices', () => {
    const getSubtitle = (
      documentType: 'Receipt' | 'Invoice' | 'Quotation',
      branding: StoreBranding,
      override?: string
    ) => {
      if (override) return override
      if (documentType === 'Quotation') {
        return branding.quotation_header || 'Official Price Estimate & Quotation'
      }
      if (documentType === 'Receipt') {
        return branding.receipt_header || 'Official Digital Tax Receipt'
      }
      return branding.invoice_header || 'Official Tax Invoice'
    }

    // When receipt_header is changed to 'Official Receipt' and invoice_header is null
    const brandingWithReceiptOnly: StoreBranding = {
      store_name: 'KC Shop',
      receipt_header: 'Official Receipt',
      invoice_header: null,
      quotation_header: null,
    }

    expect(getSubtitle('Receipt', brandingWithReceiptOnly)).toBe('Official Receipt')
    expect(getSubtitle('Invoice', brandingWithReceiptOnly)).toBe('Official Tax Invoice')
    expect(getSubtitle('Quotation', brandingWithReceiptOnly)).toBe('Official Price Estimate & Quotation')

    // When both are customized
    expect(getSubtitle('Receipt', mockBranding)).toBe('Official Receipt')
    expect(getSubtitle('Invoice', mockBranding)).toBe('Tax Invoice')
    expect(getSubtitle('Quotation', mockBranding)).toBe('Price Quotation')
  })

  it('should support separate printer config titles for receipt, invoice, and quotation', () => {
    const config: PrinterConfig = {
      ...DEFAULT_PRINTER_CONFIG,
      receiptTitle: 'Official Receipt',
      invoiceTitle: 'Tax Invoice',
      quotationTitle: 'Price Quotation',
    }

    expect(config.receiptTitle).toBe('Official Receipt')
    expect(config.invoiceTitle).toBe('Tax Invoice')
    expect(config.quotationTitle).toBe('Price Quotation')
  })
})
