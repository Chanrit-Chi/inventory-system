import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBrandingStore } from '@/stores/brandingStore'
import api from '@/api/axios'

vi.mock('@/api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Branding Store & Cloud Sync System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('initializes with default branding (KC Shop / High-Velocity POS & ERP Platform)', () => {
    const store = useBrandingStore()
    expect(store.branding.store_name).toBe('KC Shop')
    expect(store.branding.tagline).toBe('High-Velocity POS & ERP Platform')
    expect(store.branding.primary_color).toBe('#005F83')
  })

  it('fetches branding from DB endpoint /settings/branding and updates store state & localStorage', async () => {
    const mockApiResponse = {
      data: {
        success: true,
        data: {
          id: 'b-100',
          store_name: 'Custom Flagship Store',
          tagline: 'Premier Retail Hub',
          logo_url: 'https://cdn.example.com/flagship.png',
          primary_color: '#FF6600',
          store_address: '123 Monivong Blvd, Phnom Penh',
          store_phone: '+855 23 999 888',
          receipt_header: 'OFFICIAL TAX INVOICE',
          invoice_header: 'COMMERCIAL INVOICE',
          quotation_header: 'FORMAL ESTIMATE',
          receipt_footer: 'Thank you for shopping at Flagship!',
          show_tax: true,
        },
      },
    }

    vi.mocked(api.get).mockResolvedValueOnce(mockApiResponse)

    const store = useBrandingStore()
    const result = await store.fetchBranding()

    expect(api.get).toHaveBeenCalledWith('/settings/branding')
    expect(store.branding.store_name).toBe('Custom Flagship Store')
    expect(store.branding.tagline).toBe('Premier Retail Hub')
    expect(store.branding.logo_url).toBe('https://cdn.example.com/flagship.png')
    expect(store.branding.show_tax).toBe(true)
    expect(localStorage.getItem('omnipos_store_name')).toBe('Custom Flagship Store')
    expect(localStorage.getItem('omnipos_tagline')).toBe('Premier Retail Hub')
    expect(result.store_name).toBe('Custom Flagship Store')
  })

  it('saves branding updates via POST /settings/branding and broadcasts state immediately', async () => {
    const mockSavedResponse = {
      data: {
        success: true,
        data: {
          id: 'b-100',
          store_name: 'OmniPOS Mega Store',
          tagline: 'High-Velocity Omnichannel POS & ERP Platform',
          logo_url: '/logo-new.png',
          primary_color: '#005F83',
          store_address: '456 Russian Blvd, Phnom Penh',
          store_phone: '+855 12 111 222',
          receipt_header: 'TAX INVOICE',
          invoice_header: 'INVOICE',
          quotation_header: 'QUOTATION',
          receipt_footer: 'Visit our online store at shop.omnipos.local',
          show_tax: false,
        },
      },
    }

    vi.mocked(api.post).mockResolvedValueOnce(mockSavedResponse)

    const store = useBrandingStore()
    const updated = await store.saveBranding({
      store_name: 'OmniPOS Mega Store',
      tagline: 'High-Velocity Omnichannel POS & ERP Platform',
      store_address: '456 Russian Blvd, Phnom Penh',
      store_phone: '+855 12 111 222',
    })

    expect(api.post).toHaveBeenCalled()
    expect(store.branding.store_name).toBe('OmniPOS Mega Store')
    expect(store.branding.tagline).toBe('High-Velocity Omnichannel POS & ERP Platform')
    expect(localStorage.getItem('omnipos_store_name')).toBe('OmniPOS Mega Store')
    expect(updated.store_name).toBe('OmniPOS Mega Store')
  })

  it('restores cached branding seamlessly on reload when localStorage has stored branding', () => {
    localStorage.setItem(
      'omnipos_branding',
      JSON.stringify({
        store_name: 'Cached Retail Branch',
        tagline: 'Express Fast Lane',
        logo_url: '/cached-logo.png',
      })
    )

    const store = useBrandingStore()
    expect(store.branding.store_name).toBe('Cached Retail Branch')
    expect(store.branding.tagline).toBe('Express Fast Lane')
  })
})
