import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getStoreBranding, updateStoreBranding } from '../api/endpoints'
import type { StoreBranding } from '../types'

const BRANDING_STORAGE_KEY = '@kc_inventory_branding'

export const DEFAULT_BRANDING: StoreBranding = {
  store_name: 'KC Inventory',
  tagline: '',
  logo_url: null,
  primary_color: '#FF8800',
  store_address: '',
  store_phone: '',
  receipt_header: null,
  invoice_header: null,
  quotation_header: null,
  receipt_footer: 'Thank you for your business! Please visit again.',
  show_tax: false,
}

interface BrandingContextValue {
  branding: StoreBranding
  isSyncing: boolean
  syncError: string | null
  refreshBranding: () => Promise<void>
  saveBranding: (
    payload: Partial<StoreBranding>,
    logoFile?: { uri: string; name: string; type: string },
    removeLogo?: boolean
  ) => Promise<StoreBranding>
  resetBranding: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<StoreBranding>(DEFAULT_BRANDING)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // 1. Restore local cache on cold start, then sync from cloud API
  const refreshBranding = useCallback(async () => {
    try {
      setSyncError(null)
      const remote = await getStoreBranding()
      if (remote && remote.store_name) {
        setBranding((prev) => ({
          ...prev,
          ...remote,
        }))
        await AsyncStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(remote))
      }
    } catch (err: unknown) {
      // Backend offline or unreachable — keep local cache
      const msg = err instanceof Error ? err.message : 'Could not fetch remote branding'
      setSyncError(msg)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const cached = await AsyncStorage.getItem(BRANDING_STORAGE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && typeof parsed === 'object') {
            setBranding((prev) => ({ ...prev, ...parsed }))
          }
        }
      } catch {
        // Storage read failed, fallback to default
      }
      // Attempt background remote sync
      refreshBranding()
    })()
  }, [refreshBranding])

  // 2. Save & Broadcast branding changes
  const saveBranding = useCallback(
    async (
      payload: Partial<StoreBranding>,
      logoFile?: { uri: string; name: string; type: string },
      removeLogo?: boolean
    ): Promise<StoreBranding> => {
      setIsSyncing(true)
      setSyncError(null)

      try {
        let updated: StoreBranding

        try {
          // Attempt cloud update
          updated = await updateStoreBranding({
            ...payload,
            logoFile,
            remove_logo: removeLogo,
          })
        } catch {
          // If offline, update locally
          updated = {
            ...branding,
            ...payload,
            logo_url: removeLogo ? null : logoFile ? logoFile.uri : branding.logo_url,
          }
        }

        setBranding(updated)
        await AsyncStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(updated))
        return updated
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update branding'
        setSyncError(msg)
        throw err
      } finally {
        setIsSyncing(false)
      }
    },
    [branding]
  )

  // 3. Reset branding to default
  const resetBranding = useCallback(async () => {
    setIsSyncing(true)
    try {
      try {
        await updateStoreBranding({
          ...DEFAULT_BRANDING,
          remove_logo: true,
        })
      } catch {
        // Fallback locally
      }
      setBranding(DEFAULT_BRANDING)
      await AsyncStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(DEFAULT_BRANDING))
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const brandingValue = useMemo(
    () => ({
      branding,
      isSyncing,
      syncError,
      refreshBranding,
      saveBranding,
      resetBranding,
    }),
    [branding, isSyncing, syncError, refreshBranding, saveBranding, resetBranding]
  )

  return <BrandingContext.Provider value={brandingValue}>{children}</BrandingContext.Provider>
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext)
  if (!ctx) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return ctx
}
