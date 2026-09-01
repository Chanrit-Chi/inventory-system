import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/axios'

export interface StoreBranding {
  id?: string
  store_name: string
  tagline?: string
  logo_url?: string | null
  primary_color?: string
  store_address?: string
  store_phone?: string
  receipt_header?: string
  invoice_header?: string
  quotation_header?: string
  receipt_footer?: string
  show_tax?: boolean
  updated_at?: string
}

const STORAGE_KEY = 'omnipos_branding'

export const DEFAULT_BRANDING: StoreBranding = {
  store_name: 'KC Shop',
  tagline: 'High-Velocity POS & ERP Platform',
  logo_url: '/logo.png',
  primary_color: '#005F83',
  store_address: 'Phnom Penh, Cambodia',
  store_phone: '+855 12 345 678',
  receipt_header: 'TAX INVOICE / RECEIPT',
  invoice_header: 'INVOICE',
  quotation_header: 'QUOTATION',
  receipt_footer: 'Thank you for your business! Please visit again.',
  show_tax: false,
}

function loadInitialBranding(): StoreBranding {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_BRANDING,
          ...parsed,
          store_name: parsed.store_name || localStorage.getItem('omnipos_store_name') || DEFAULT_BRANDING.store_name,
          tagline: parsed.tagline !== undefined ? parsed.tagline : (localStorage.getItem('omnipos_tagline') || DEFAULT_BRANDING.tagline),
          logo_url: parsed.logo_url || localStorage.getItem('omnipos_logo_url') || DEFAULT_BRANDING.logo_url,
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  const legacyName = localStorage.getItem('omnipos_store_name')
  const legacyTagline = localStorage.getItem('omnipos_tagline')
  const legacyLogo = localStorage.getItem('omnipos_logo_url')

  return {
    ...DEFAULT_BRANDING,
    store_name: legacyName || DEFAULT_BRANDING.store_name,
    tagline: legacyTagline !== null ? legacyTagline : DEFAULT_BRANDING.tagline,
    logo_url: legacyLogo || DEFAULT_BRANDING.logo_url,
  }
}

export const useBrandingStore = defineStore('branding', () => {
  const initial = loadInitialBranding()

  const branding = ref<StoreBranding>(initial)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  function persistToStorage(data: StoreBranding) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      localStorage.setItem('omnipos_store_name', data.store_name)
      localStorage.setItem('omnipos_tagline', data.tagline || '')
      if (data.logo_url) {
        localStorage.setItem('omnipos_logo_url', data.logo_url)
      } else {
        localStorage.removeItem('omnipos_logo_url')
      }
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Fetch branding from DB via GET /api/v1/settings/branding
   */
  async function fetchBranding(): Promise<StoreBranding> {
    isLoading.value = true
    error.value = null
    try {
      const res = await api.get('/settings/branding')
      const data = res.data?.data ?? res.data
      if (data && typeof data === 'object') {
        branding.value = {
          ...DEFAULT_BRANDING,
          ...data,
          store_name: data.store_name || DEFAULT_BRANDING.store_name,
          tagline: data.tagline !== undefined ? data.tagline : DEFAULT_BRANDING.tagline,
          logo_url: data.logo_url || DEFAULT_BRANDING.logo_url,
          show_tax: Boolean(data.show_tax),
        }
        persistToStorage(branding.value)
      }
      return branding.value
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch store branding'
      error.value = msg
      return branding.value
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save branding to DB via POST /api/v1/settings/branding
   */
  async function saveBranding(
    payload: Partial<StoreBranding>,
    logoFile?: File | null,
    removeLogo?: boolean
  ): Promise<StoreBranding> {
    isSaving.value = true
    error.value = null
    try {
      const formData = new FormData()
      if (payload.store_name !== undefined) formData.append('store_name', payload.store_name.trim())
      if (payload.tagline !== undefined) formData.append('tagline', payload.tagline.trim())
      if (payload.store_address !== undefined) formData.append('store_address', payload.store_address.trim())
      if (payload.store_phone !== undefined) formData.append('store_phone', payload.store_phone.trim())
      if (payload.primary_color !== undefined) formData.append('primary_color', payload.primary_color.trim())
      if (payload.receipt_header !== undefined) formData.append('receipt_header', payload.receipt_header.trim())
      if (payload.invoice_header !== undefined) formData.append('invoice_header', payload.invoice_header.trim())
      if (payload.quotation_header !== undefined) formData.append('quotation_header', payload.quotation_header.trim())
      if (payload.receipt_footer !== undefined) formData.append('receipt_footer', payload.receipt_footer.trim())
      if (payload.show_tax !== undefined) formData.append('show_tax', payload.show_tax ? '1' : '0')

      if (logoFile) {
        formData.append('logo', logoFile, logoFile.name)
      }
      if (removeLogo) {
        formData.append('remove_logo', '1')
      }

      const res = await api.post('/settings/branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data?.data ?? res.data
      if (data && typeof data === 'object') {
        branding.value = {
          ...DEFAULT_BRANDING,
          ...data,
          store_name: data.store_name || DEFAULT_BRANDING.store_name,
          tagline: data.tagline !== undefined ? data.tagline : DEFAULT_BRANDING.tagline,
          logo_url: data.logo_url || DEFAULT_BRANDING.logo_url,
          show_tax: Boolean(data.show_tax),
        }
        persistToStorage(branding.value)
      }
      return branding.value
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save store branding'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  return {
    branding,
    isLoading,
    isSaving,
    error,
    fetchBranding,
    saveBranding,
  }
})
