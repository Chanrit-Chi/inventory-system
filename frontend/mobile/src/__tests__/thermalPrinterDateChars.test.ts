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

jest.mock('../api/client', () => {
  const mockClient = {
    post: jest.fn().mockResolvedValue({ data: { success: true, message: 'Printed' } }),
  }
  return {
    __esModule: true,
    default: mockClient,
    apiClient: mockClient,
  }
})

import {
  formatReceiptDateTime,
  formatReceiptTime,
  formatReceiptDate,
  sanitizeThermalText,
  buildEscPosCommands,
  buildKitchenEscPosCommands,
  DEFAULT_PRINTER_CONFIG,
} from '../utils/thermalPrinter'
import { sendRawPrint } from '../api/endpoints'
import { apiClient } from '../api/client'
import type { Order } from '../types'

describe('Thermal Printer Date & Time Formatting (No Unknown Characters Before AM/PM)', () => {
  const sampleOrder: Order = {
    id: 'ord-12345',
    order_number: 'ORD-2026-00042',
    created_at: '2026-09-05T14:30:00Z',
    status: 'COMPLETED',
    subtotal: 10.0,
    discount: 0,
    delivery_cost: 0,
    tax_amount: 0,
    total_amount: 10.0,
    channel_id: 'ch-pos',
    user: { id: 'u1', name: 'Alice Cashier', role: 'admin' },
    items: [],
  }

  it('formats receipt date and time with pure ASCII and standard space before AM/PM', () => {
    const formatted = formatReceiptDateTime('2026-09-05T14:30:00Z')
    // Must NOT contain Unicode narrow no-break space \u202F or non-breaking space \u00A0
    expect(formatted).not.toContain('\u202F')
    expect(formatted).not.toContain('\u00A0')
    // Must match pure ASCII date/time format e.g. "Sep 5, 2026, 09:30 PM" or similar
    expect(formatted).toMatch(/(AM|PM)$/)
    // Every character must be standard printable ASCII (0x20 - 0x7E)
    for (let i = 0; i < formatted.length; i++) {
      const code = formatted.charCodeAt(i)
      expect(code >= 0x20 && code <= 0x7e).toBe(true)
    }
  })

  it('formats receipt time with standard ASCII space before AM/PM', () => {
    const formattedTime = formatReceiptTime('2026-09-05T14:30:00Z')
    expect(formattedTime).not.toContain('\u202F')
    expect(formattedTime).not.toContain('\u00A0')
    expect(formattedTime).toMatch(/^\d{2}:\d{2} (AM|PM)$/)
  })

  it('formats receipt date with pure ASCII', () => {
    const formattedDate = formatReceiptDate('2026-09-05T14:30:00Z')
    expect(formattedDate).not.toContain('\u202F')
    expect(formattedDate).not.toContain('\u00A0')
    expect(formattedDate).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)
  })

  it('sanitizes Unicode spaces and zero-width characters in thermal text', () => {
    const dirtyText = 'Sep 5, 2026, 02:30\u202FPM\u00A0Total:\u200B$10.00\uFEFF'
    const cleanText = sanitizeThermalText(dirtyText)

    expect(cleanText).toBe('Sep 5, 2026, 02:30 PM Total:$10.00')
    expect(cleanText).not.toContain('\u202F')
    expect(cleanText).not.toContain('\u00A0')
    expect(cleanText).not.toContain('\u200B')
    expect(cleanText).not.toContain('\uFEFF')
  })

  it('ensures buildEscPosCommands contains no Unicode narrow spaces before AM/PM', () => {
    const commands = buildEscPosCommands(sampleOrder, DEFAULT_PRINTER_CONFIG)

    expect(commands).toContain('ORD-2026-00042')
    expect(commands).not.toContain('\u202F')
    expect(commands).not.toContain('\u00A0')
    // Date line check
    const dateLineMatch = commands.match(/Date\s+:\s+([^\n]+)/)
    expect(dateLineMatch).not.toBeNull()
    const dateStr = dateLineMatch![1]
    expect(dateStr).toMatch(/(AM|PM)/)
    expect(dateStr).not.toContain('\u202F')
  })

  it('ensures buildKitchenEscPosCommands contains pure ASCII time', () => {
    const commands = buildKitchenEscPosCommands(sampleOrder, {
      id: 'k-1',
      name: 'Kitchen',
      connectionType: 'wifi',
      ipAddress: '192.168.1.100',
      port: 9100,
      paperWidth: '80mm',
      role: 'kitchen',
      isDefault: false,
      autoCut: true,
    })

    expect(commands).not.toContain('\u202F')
    expect(commands).not.toContain('\u00A0')
    expect(commands).toMatch(/Time: \d{2}:\d{2} (AM|PM)/)
  })

  it('sendRawPrint normalizes narrow non-breaking spaces before transmitting to printer', async () => {
    const dirtyCommands = 'Order Date: 02:30\u202FPM\n'
    await sendRawPrint({
      ip: '192.168.1.100',
      port: 9100,
      data: dirtyCommands,
    })

    expect(apiClient.post).toHaveBeenCalledWith('/printer/raw-print', expect.objectContaining({
      ip: '192.168.1.100',
      port: 9100,
      encoding: 'base64',
    }))

    const callArgs = (apiClient.post as jest.Mock).mock.calls[0][1]
    const decoded = atob(callArgs.data)
    expect(decoded).toContain('02:30 PM')
    expect(decoded).not.toContain('\u202F')
  })
})