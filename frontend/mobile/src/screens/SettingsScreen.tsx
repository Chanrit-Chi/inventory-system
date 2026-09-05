import React, { useState, useEffect, useCallback } from 'react'
import {
  ScrollView,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { getHealth } from '../api/endpoints'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { useToast } from '../context/ToastContext'
import {
  getPrinterConfig,
  savePrinterConfig,
  getPrinterDevices,
  savePrinterDevice,
  deletePrinterDevice,
  setDefaultPrinter,
  resetPrinterDevicesToDefault,
  printTestReceiptForDevice,
  PrinterDevice,
  PrinterConfig,
  DEFAULT_PRINTER_CONFIG,
} from '../utils/thermalPrinter'
import type { TabType } from '../types'
import { styles } from './settings/SettingsScreen.styles'
import { StoreHeaderCard } from './settings/components/StoreHeaderCard'
import { PrinterStationsSection } from './settings/components/PrinterStationsSection'
import { PrinterDeviceModal } from './settings/components/PrinterDeviceModal'
import { StoreBrandingSection } from './settings/components/StoreBrandingSection'
import { SystemDiagnosticsSection, HealthStatus } from './settings/components/SystemDiagnosticsSection'
import { UserAccountSection } from './settings/components/UserAccountSection'

export interface SettingsScreenProps {
  onNavigate?: (tab: TabType) => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onOpenScanner?: () => void
}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const { showToast } = useToast()
  const { currentUser, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const {
    pendingCount,
    isSyncing,
    syncQueue,
  } = useOfflineQueue()

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true)
            try {
              await logout()
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Logout failed'
              Alert.alert('Logout Error', msg)
            } finally {
              setLoggingOut(false)
            }
          },
        },
      ]
    )
  }

  // Backend Health Diagnostics State
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    connected: false,
    status: 'Checking...',
    version: '...',
    app: 'KC Shop Core',
    database: 'Checking...',
  })

  // Fetch Health Check from backend
  const checkBackendHealth = useCallback(async () => {
    try {
      setHealthLoading(true)
      const start = Date.now()
      const res = await getHealth()
      const elapsed = Date.now() - start
      if (res && res.data) {
        setHealthStatus({
          connected: true,
          status: res.data.status === 'healthy' ? 'Operational' : (res.data.status || 'Operational'),
          version: res.data.version || 'v1.0.0',
          app: res.data.app || 'KC Shop Core',
          database: res.data.database_driver
            ? `${res.data.database_driver.toUpperCase()} (${res.data.database_status || 'connected'})`
            : res.data.database || 'Connected',
          databaseDriver: res.data.database_driver || res.data.database,
          databaseStatus: res.data.database_status || 'connected',
          databaseLatencyMs: res.data.database_latency_ms,
          latencyMs: elapsed,
          lastChecked: new Date().toLocaleTimeString(),
          serverTime: res.data.server_time,
          environment: res.data.environment,
          phpVersion: res.data.php_version,
          laravelVersion: res.data.laravel_version,
          queueDriver: res.data.queue_driver,
        })
      }
    } catch {
      setHealthStatus({
        connected: false,
        status: 'Offline / Unreachable',
        version: 'Local Cache',
        app: 'KC Shop Core',
        database: 'Offline Queue Active',
        databaseStatus: 'disconnected',
        lastChecked: new Date().toLocaleTimeString(),
      })
    } finally {
      setHealthLoading(false)
    }
  }, [])

  // Thermal Printer & Station Management State
  const [devices, setDevices] = useState<PrinterDevice[]>([])
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG)
  const [editingDevice, setEditingDevice] = useState<PrinterDevice | null>(null)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null)
  const [savingPrinter, setSavingPrinter] = useState(false)

  const loadDevices = useCallback(async () => {
    const list = await getPrinterDevices()
    setDevices(list)
  }, [])

  useEffect(() => {
    checkBackendHealth()
    getPrinterConfig().then(setPrinterConfig)
    loadDevices()
  }, [checkBackendHealth, loadDevices])

  const handleOpenAddDevice = () => {
    setEditingDevice({
      id: `prn-${Date.now()}`,
      name: '',
      connectionType: 'wifi',
      ipAddress: '192.168.1.100',
      port: 9100,
      bluetoothName: '',
      paperWidth: '80mm',
      role: 'receipt',
      isDefault: devices.length === 0,
      autoCut: true,
    })
    setShowDeviceModal(true)
  }

  const handleOpenEditDevice = (device: PrinterDevice) => {
    setEditingDevice({ ...device })
    setShowDeviceModal(true)
  }

  const handleSaveDevice = async () => {
    if (!editingDevice) return
    if (!editingDevice.name.trim()) {
      showToast('Please enter a name for this printer station.', 'warning')
      return
    }

    try {
      const updated = await savePrinterDevice(editingDevice)
      setDevices(updated)
      setShowDeviceModal(false)
      setEditingDevice(null)
      showToast(`Configured "${editingDevice.name}" successfully.`, 'success')
    } catch {
      showToast('Failed to save printer station.', 'error')
    }
  }

  const handleDeleteDevice = (device: PrinterDevice) => {
    Alert.alert(
      'Delete Printer Station',
      `Are you sure you want to remove "${device.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = await deletePrinterDevice(device.id)
            setDevices(updated)
            showToast(`"${device.name}" removed.`, 'success')
          },
        },
      ]
    )
  }

  const handleRestoreDefaultPrinters = () => {
    Alert.alert(
      'Reset Printer Stations',
      'Restore the default preset printer stations (Cashier, Kitchen & Bluetooth)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Presets',
          onPress: async () => {
            const updated = await resetPrinterDevicesToDefault()
            setDevices(updated)
            showToast('Default printer stations restored.', 'success')
          },
        },
      ]
    )
  }

  const handleSetDefault = async (device: PrinterDevice) => {
    const updated = await setDefaultPrinter(device.id)
    setDevices(updated)
    showToast(`"${device.name}" is now the primary receipt printer.`, 'info')
  }

  const handleTestDevice = async (device: PrinterDevice) => {
    setTestingDeviceId(device.id)
    try {
      const res = await printTestReceiptForDevice(device, printerConfig)
      showToast(res.message, res.success ? 'success' : 'info')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send test print.'
      showToast(msg, 'error')
    } finally {
      setTestingDeviceId(null)
    }
  }

  const { branding, saveBranding, isSyncing: isBrandingSyncing } = useBranding()
  const [selectedLogoUri, setSelectedLogoUri] = useState<string | null>(null)
  const [selectedLogoFile, setSelectedLogoFile] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [removeLogoFlag, setRemoveLogoFlag] = useState(false)
  const [brandStoreName, setBrandStoreName] = useState(branding.store_name || 'KC Shop')
  const [brandTagline, setBrandTagline] = useState(branding.tagline || 'High-Velocity POS & ERP Platform')
  const [brandAddress, setBrandAddress] = useState(branding.store_address || '')
  const [brandPhone, setBrandPhone] = useState(branding.store_phone || '')
  const [brandReceiptHeader, setBrandReceiptHeader] = useState(branding.receipt_header || '')
  const [brandInvoiceHeader, setBrandInvoiceHeader] = useState(branding.invoice_header || '')
  const [brandQuotationHeader, setBrandQuotationHeader] = useState(branding.quotation_header || '')
  const [brandReceiptFooter, setBrandReceiptFooter] = useState(branding.receipt_footer || '')
  const [brandShowTax, setBrandShowTax] = useState(branding.show_tax ?? false)

  useEffect(() => {
    setBrandStoreName(branding.store_name || 'KC Shop')
    setBrandTagline(branding.tagline || '')
    setBrandAddress(branding.store_address || '')
    setBrandPhone(branding.store_phone || '')
    setBrandReceiptHeader(branding.receipt_header || '')
    setBrandInvoiceHeader(branding.invoice_header || '')
    setBrandQuotationHeader(branding.quotation_header || '')
    setBrandReceiptFooter(branding.receipt_footer || '')
    setBrandShowTax(branding.show_tax ?? false)
  }, [branding])

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        showToast('Gallery access is required to choose a custom brand logo.', 'warning')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        setSelectedLogoUri(asset.uri)
        const filename = asset.uri.split('/').pop() || 'store_logo.png'
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/png'
        setSelectedLogoFile({ uri: asset.uri, name: filename, type })
        setRemoveLogoFlag(false)
      }
    } catch {
      showToast('Failed to select image from gallery.', 'error')
    }
  }

  const handleRemoveLogo = () => {
    setSelectedLogoUri(null)
    setSelectedLogoFile(null)
    setRemoveLogoFlag(true)
  }

  const handleSaveStoreHeader = async () => {
    try {
      setSavingPrinter(true)
      await saveBranding(
        {
          store_name: brandStoreName.trim() || 'KC Shop',
          tagline: brandTagline.trim(),
          store_address: brandAddress.trim(),
          store_phone: brandPhone.trim(),
          receipt_header: brandReceiptHeader.trim() || null,
          invoice_header: brandInvoiceHeader.trim() || null,
          quotation_header: brandQuotationHeader.trim() || null,
          receipt_footer: brandReceiptFooter.trim(),
          show_tax: brandShowTax,
        },
        selectedLogoFile || undefined,
        removeLogoFlag
      )

      await savePrinterConfig({
        ...printerConfig,
        storeName: brandStoreName.trim() || 'KC Shop',
        subHeader: brandTagline.trim(),
        receiptTitle: brandReceiptHeader.trim() || 'TAX INVOICE / RECEIPT',
        invoiceTitle: brandInvoiceHeader.trim() || 'INVOICE',
        quotationTitle: brandQuotationHeader.trim() || 'QUOTATION',
        storeAddress: brandAddress.trim(),
        storePhone: brandPhone.trim(),
        footerMessage: brandReceiptFooter.trim(),
        showTax: brandShowTax,
      })

      setSelectedLogoFile(null)
      setRemoveLogoFlag(false)
      showToast('Store branding and receipt settings synced across devices!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save store branding.'
      showToast(msg, 'error')
    } finally {
      setSavingPrinter(false)
    }
  }

  // Sync Offline Mutations
  const handleSyncOffline = async () => {
    if (isSyncing || pendingCount === 0) return
    const result = await syncQueue()
    if (result.syncedOrders.length > 0) {
      showToast(`Successfully synced ${result.syncedOrders.length} order(s) to server.`, 'success')
    } else if (result.failedCount > 0) {
      showToast(`${result.failedCount} order(s) could not be synced. Check connection.`, 'warning')
    } else {
      showToast('All offline orders are already up to date.', 'info')
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Store Header & Profile */}
      <StoreHeaderCard branding={branding} />

      {/* Multi-Station Thermal Printers Section */}
      <PrinterStationsSection
        devices={devices}
        testingDeviceId={testingDeviceId}
        onOpenAddDevice={handleOpenAddDevice}
        onRestoreDefaultPrinters={handleRestoreDefaultPrinters}
        onTestDevice={handleTestDevice}
        onSetDefault={handleSetDefault}
        onOpenEditDevice={handleOpenEditDevice}
        onDeleteDevice={handleDeleteDevice}
      />

      {/* Store Branding & Receipt Header Section */}
      <StoreBrandingSection
        branding={branding}
        selectedLogoUri={selectedLogoUri}
        removeLogoFlag={removeLogoFlag}
        brandStoreName={brandStoreName}
        setBrandStoreName={setBrandStoreName}
        brandTagline={brandTagline}
        setBrandTagline={setBrandTagline}
        brandReceiptHeader={brandReceiptHeader}
        setBrandReceiptHeader={setBrandReceiptHeader}
        brandInvoiceHeader={brandInvoiceHeader}
        setBrandInvoiceHeader={setBrandInvoiceHeader}
        brandQuotationHeader={brandQuotationHeader}
        setBrandQuotationHeader={setBrandQuotationHeader}
        brandAddress={brandAddress}
        setBrandAddress={setBrandAddress}
        brandPhone={brandPhone}
        setBrandPhone={setBrandPhone}
        brandShowTax={brandShowTax}
        setBrandShowTax={setBrandShowTax}
        brandReceiptFooter={brandReceiptFooter}
        setBrandReceiptFooter={setBrandReceiptFooter}
        printerConfig={printerConfig}
        setPrinterConfig={setPrinterConfig}
        savingPrinter={savingPrinter}
        isBrandingSyncing={isBrandingSyncing}
        onPickLogo={handlePickLogo}
        onRemoveLogo={handleRemoveLogo}
        onSaveStoreHeader={handleSaveStoreHeader}
      />

      {/* Add / Edit Printer Station Modal */}
      <PrinterDeviceModal
        visible={showDeviceModal}
        editingDevice={editingDevice}
        devices={devices}
        setEditingDevice={setEditingDevice}
        onClose={() => setShowDeviceModal(false)}
        onSave={handleSaveDevice}
      />

      {/* Hardware & System Diagnostics */}
      <SystemDiagnosticsSection
        healthStatus={healthStatus}
        healthLoading={healthLoading}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onCheckBackendHealth={checkBackendHealth}
        onSyncOffline={handleSyncOffline}
      />

      {/* Account & Session Management Section */}
      <UserAccountSection
        currentUser={currentUser}
        loggingOut={loggingOut}
        onLogout={handleLogout}
      />
    </ScrollView>
  )
}

export default SettingsScreen
