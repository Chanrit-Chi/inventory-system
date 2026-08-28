import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { getHealth } from '../api/endpoints'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
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

export interface SettingsScreenProps {
  onNavigate?: (tab: TabType) => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onOpenScanner?: () => void
}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
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
  const [healthStatus, setHealthStatus] = useState<{
    connected: boolean
    status?: string
    version?: string
    app?: string
    database?: string
  }>({
    connected: false,
    status: 'Checking...',
    version: '...',
    app: 'KC Inventory Core',
    database: 'Checking...',
  })

  // Fetch Health Check from backend
  const checkBackendHealth = useCallback(async () => {
    try {
      setHealthLoading(true)
      const res = await getHealth()
      if (res && res.data) {
        setHealthStatus({
          connected: true,
          status: res.data.status || 'Operational',
          version: res.data.version || 'v1.4.2',
          app: res.data.app || 'KC Inventory Core',
          database: res.data.database || 'Connected',
        })
      }
    } catch {
      setHealthStatus({
        connected: false,
        status: 'Offline / Unreachable',
        version: 'v1.4.2 (Local Cache)',
        app: 'KC Inventory Core',
        database: 'Offline Queue Active',
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
      Alert.alert('Required Field', 'Please enter a name for this printer station.')
      return
    }

    try {
      const updated = await savePrinterDevice(editingDevice)
      setDevices(updated)
      setShowDeviceModal(false)
      setEditingDevice(null)
      Alert.alert('Printer Station Saved', `Configured "${editingDevice.name}" successfully.`)
    } catch {
      Alert.alert('Error', 'Failed to save printer station.')
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
            Alert.alert('Presets Restored', 'Default printer stations restored.')
          },
        },
      ]
    )
  }

  const handleSetDefault = async (device: PrinterDevice) => {
    const updated = await setDefaultPrinter(device.id)
    setDevices(updated)
    Alert.alert('Default Updated', `"${device.name}" is now the primary receipt printer.`)
  }

  const handleTestDevice = async (device: PrinterDevice) => {
    setTestingDeviceId(device.id)
    try {
      const res = await printTestReceiptForDevice(device, printerConfig)
      Alert.alert(res.success ? `🖨️ ${device.name} Test` : 'Printer Notice', res.message)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not send test print.')
    } finally {
      setTestingDeviceId(null)
    }
  }

  const { branding, saveBranding, isSyncing: isBrandingSyncing } = useBranding()
  const [selectedLogoUri, setSelectedLogoUri] = useState<string | null>(null)
  const [selectedLogoFile, setSelectedLogoFile] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [removeLogoFlag, setRemoveLogoFlag] = useState(false)
  const [brandStoreName, setBrandStoreName] = useState(branding.store_name || 'KC Inventory')
  const [brandTagline, setBrandTagline] = useState(branding.tagline || 'Omnichannel Suite')
  const [brandAddress, setBrandAddress] = useState(branding.store_address || '')
  const [brandPhone, setBrandPhone] = useState(branding.store_phone || '')
  const [brandReceiptHeader, setBrandReceiptHeader] = useState(branding.receipt_header || '')
  const [brandQuotationHeader, setBrandQuotationHeader] = useState(branding.quotation_header || '')
  const [brandReceiptFooter, setBrandReceiptFooter] = useState(branding.receipt_footer || '')
  const [brandShowTax, setBrandShowTax] = useState(branding.show_tax ?? false)

  useEffect(() => {
    setBrandStoreName(branding.store_name || 'KC Inventory')
    setBrandTagline(branding.tagline || '')
    setBrandAddress(branding.store_address || '')
    setBrandPhone(branding.store_phone || '')
    setBrandReceiptHeader(branding.receipt_header || '')
    setBrandQuotationHeader(branding.quotation_header || '')
    setBrandReceiptFooter(branding.receipt_footer || '')
    setBrandShowTax(branding.show_tax ?? false)
  }, [branding])

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Gallery access is required to choose a custom brand logo.')
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
      Alert.alert('Error', 'Failed to select image from gallery.')
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
          store_name: brandStoreName.trim() || 'KC Inventory',
          tagline: brandTagline.trim(),
          store_address: brandAddress.trim(),
          store_phone: brandPhone.trim(),
          receipt_header: brandReceiptHeader.trim() || null,
          quotation_header: brandQuotationHeader.trim() || null,
          receipt_footer: brandReceiptFooter.trim(),
          show_tax: brandShowTax,
        },
        selectedLogoFile || undefined,
        removeLogoFlag
      )

      await savePrinterConfig({
        ...printerConfig,
        storeName: brandStoreName.trim() || 'KC Inventory',
        subHeader: brandTagline.trim(),
        receiptTitle: brandReceiptHeader.trim() || 'TAX INVOICE / RECEIPT',
        storeAddress: brandAddress.trim(),
        storePhone: brandPhone.trim(),
        footerMessage: brandReceiptFooter.trim(),
        showTax: brandShowTax,
      })

      setSelectedLogoFile(null)
      setRemoveLogoFlag(false)
      Alert.alert('Branding Saved', 'Store branding and receipt settings synced across all connected devices!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save store branding.'
      Alert.alert('Error', msg)
    } finally {
      setSavingPrinter(false)
    }
  }

  useEffect(() => {
    checkBackendHealth()
  }, [checkBackendHealth])

  // Sync Offline Mutations
  const handleSyncOffline = async () => {
    if (isSyncing || pendingCount === 0) return
    const result = await syncQueue()
    if (result.syncedOrders.length > 0) {
      Alert.alert('Sync Complete', `Successfully synced ${result.syncedOrders.length} order(s) to server.`)
    } else if (result.failedCount > 0) {
      Alert.alert('Sync Incomplete', `${result.failedCount} order(s) could not be synced. Check connection.`)
    } else {
      Alert.alert('Queue Empty', 'All offline orders are already up to date.')
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Store Header & Profile */}
      <View style={styles.storeCard}>
        <View style={styles.storeCardLeft}>
          <View style={styles.storeLogoBox}>
            {branding.logo_url ? (
              <Image source={{ uri: branding.logo_url }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="contain" />
            ) : (
              <Image source={require('../../assets/KC SHOP-No BG.png')} style={{ width: 44, height: 44 }} contentFit="contain" />
            )}
          </View>
          <View style={styles.storeInfo}>
            <View style={styles.storeNameRow}>
              <Text style={styles.storeName}>{branding.store_name || 'KC Inventory'}</Text>
              <View style={styles.storeIdBadge}>
                <Text style={styles.storeIdText}>Store #01</Text>
              </View>
            </View>
            <Text style={styles.storeAddress}>{branding.tagline || branding.store_address || 'Omnichannel Retail Suite'}</Text>
            <View style={styles.terminalStatusRow}>
              <View style={styles.activeDot} />
              <Text style={styles.terminalStatusText}>Cloud Synced • Active</Text>
            </View>
          </View>
        </View>
      </View>


      {/* Multi-Station Thermal Printers Section */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Thermal Printers & Stations</Text>
          <Text style={styles.sectionSubtitle}>Manage Cashier, Kitchen & Bluetooth printers</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {devices.length === 0 && (
            <TouchableOpacity
              style={styles.restorePresetsBtn}
              onPress={handleRestoreDefaultPrinters}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={14} color={tokens.colors.primaryContainer} />
              <Text style={styles.restorePresetsBtnText}>Presets</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.addPrinterBtn}
            onPress={handleOpenAddDevice}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
            <Text style={styles.addPrinterBtnText}>Add Printer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Printer Devices List */}
      <View style={styles.printerListContainer}>
        {devices.length === 0 ? (
          <View style={styles.emptyPrinterCard}>
            <View style={styles.emptyPrinterIconBox}>
              <Ionicons name="print-outline" size={28} color={tokens.colors.secondary} />
            </View>
            <Text style={styles.emptyPrinterTitle}>No Printer Stations Configured</Text>
            <Text style={styles.emptyPrinterSub}>
              All default stations have been removed. Tap "+ Add Printer" to connect your hardware or restore defaults.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={handleOpenAddDevice}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add Printer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyRestoreBtn}
                onPress={handleRestoreDefaultPrinters}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={14} color={tokens.colors.primaryContainer} />
                <Text style={styles.emptyRestoreBtnText}>Restore Presets</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          devices.map((device) => {
            const isWifi = device.connectionType === 'wifi'
            const isBt = device.connectionType === 'bluetooth'
            const isKitchen = device.role === 'kitchen'
            const isTestingThis = testingDeviceId === device.id

            return (
              <View
                key={device.id}
                style={[styles.deviceCardItem, device.isDefault && styles.deviceCardItemDefault]}
              >
                <View style={styles.deviceCardHeader}>
                  <View style={styles.deviceIconCircle}>
                    <Ionicons
                      name={isWifi ? 'wifi' : isBt ? 'bluetooth' : 'print'}
                      size={18}
                      color={isKitchen ? '#D97706' : tokens.colors.primaryContainer}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.deviceNameRow}>
                      <Text style={styles.deviceItemTitle}>{device.name}</Text>
                      {Boolean(device.isDefault) && (
                        <View style={styles.defaultStationBadge}>
                          <Ionicons name="star" size={10} color="#B45309" />
                          <Text style={styles.defaultStationBadgeText}>Default Receipt</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deviceItemEndpoint}>
                      {isWifi
                        ? `Wi-Fi IP: ${device.ipAddress || '192.168.1.100'}:${device.port || 9100}`
                        : isBt
                        ? `Bluetooth: ${device.bluetoothName || 'Paired Device'}`
                        : 'System Spooler'}
                    </Text>
                  </View>
                </View>

                {/* Badges */}
                <View style={styles.deviceMetaRow}>
                  <View
                    style={[
                      styles.roleBadge,
                      isKitchen ? styles.roleBadgeKitchen : styles.roleBadgeReceipt,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        isKitchen ? styles.roleBadgeKitchenText : styles.roleBadgeReceiptText,
                      ]}
                    >
                      {isKitchen ? '🍳 Kitchen / Packing' : '🧾 Customer Receipt'}
                    </Text>
                  </View>
                  <View style={styles.paperBadge}>
                    <Text style={styles.paperBadgeText}>{device.paperWidth} roll</Text>
                  </View>
                  {Boolean(device.autoCut) && (
                    <View style={styles.cutBadge}>
                      <Text style={styles.cutBadgeText}>Auto-cut</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.deviceCardActionsRow}>
                  <TouchableOpacity
                    style={styles.deviceActionBtn}
                    onPress={() => handleTestDevice(device)}
                    disabled={isTestingThis}
                    activeOpacity={0.8}
                  >
                    {isTestingThis ? (
                      <ActivityIndicator size="small" color={tokens.colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="receipt-outline" size={14} color={tokens.colors.primary} />
                        <Text style={styles.deviceActionBtnText}>Test</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {Boolean(!device.isDefault) && (
                    <TouchableOpacity
                      style={styles.deviceActionBtn}
                      onPress={() => handleSetDefault(device)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="star-outline" size={14} color={tokens.colors.secondary} />
                      <Text style={[styles.deviceActionBtnText, { color: tokens.colors.secondary }]}>
                        Set Default
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.deviceActionBtn}
                    onPress={() => handleOpenEditDevice(device)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={14} color={tokens.colors.secondary} />
                    <Text style={[styles.deviceActionBtnText, { color: tokens.colors.secondary }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deviceActionBtn, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}
                    onPress={() => handleDeleteDevice(device)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* Store Branding & Receipt Header Section */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Branding & Receipt Template</Text>
          <Text style={styles.sectionSubtitle}>Cloud-synced logo, store identity & print template</Text>
        </View>
      </View>

      <View style={styles.printerCard}>
        {/* Logo Customization Card */}
        <Text style={styles.printerInputLabel}>STORE BRAND LOGO</Text>
        <View style={styles.brandingLogoRow}>
          <View style={styles.brandingLogoPreviewBox}>
            {selectedLogoUri ? (
              <Image source={{ uri: selectedLogoUri }} style={styles.brandingLogoImg} contentFit="contain" />
            ) : branding.logo_url && !removeLogoFlag ? (
              <Image source={{ uri: branding.logo_url }} style={styles.brandingLogoImg} contentFit="contain" />
            ) : (
              <Image source={require('../../assets/KC SHOP-No BG.png')} style={styles.brandingLogoImg} contentFit="contain" />
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.logoPickerBtn}
                onPress={handlePickLogo}
                activeOpacity={0.85}
              >
                <Ionicons name="image-outline" size={14} color={tokens.colors.onPrimary} />
                <Text style={styles.logoPickerBtnText}>Choose Logo</Text>
              </TouchableOpacity>

              {Boolean((selectedLogoUri || (branding.logo_url && !removeLogoFlag))) && (
                <TouchableOpacity
                  style={styles.logoRemoveBtn}
                  onPress={handleRemoveLogo}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={14} color={tokens.colors.statusError} />
                  <Text style={styles.logoRemoveBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.brandingHelpText}>Supports PNG, JPG, WebP. High resolution 1:1 square recommended.</Text>
          </View>
        </View>

        {/* Header & Sub-Header */}
        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.md }]}>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>STORE NAME (HEADER)</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. KC Inventory"
              placeholderTextColor={tokens.colors.secondary}
              value={brandStoreName}
              onChangeText={setBrandStoreName}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>SUB-HEADER / SLOGAN</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Omnichannel Suite"
              placeholderTextColor={tokens.colors.secondary}
              value={brandTagline}
              onChangeText={setBrandTagline}
            />
          </View>
        </View>

        {/* Distinct Document Sub-Titles (Receipt/Invoice vs Quotation) */}
        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>RECEIPT / INVOICE TITLE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Official Digital Tax Receipt"
              placeholderTextColor={tokens.colors.secondary}
              value={brandReceiptHeader}
              onChangeText={(text) => {
                setBrandReceiptHeader(text)
                setPrinterConfig((prev) => ({ ...prev, receiptTitle: text }))
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>QUOTATION TITLE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Official Price Estimate"
              placeholderTextColor={tokens.colors.secondary}
              value={brandQuotationHeader}
              onChangeText={setBrandQuotationHeader}
            />
          </View>
        </View>

        {/* Address & Phone */}
        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1.4 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>STORE ADDRESS</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Phnom Penh, Cambodia"
              placeholderTextColor={tokens.colors.secondary}
              value={brandAddress}
              onChangeText={setBrandAddress}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>TEL PHONE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. +855 12 345 678"
              placeholderTextColor={tokens.colors.secondary}
              value={brandPhone}
              onChangeText={setBrandPhone}
            />
          </View>
        </View>

        {/* Optional Cashier Name Toggle */}
        <View style={[styles.autoCutRow, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoCutLabel}>Print Cashier Name</Text>
            <Text style={styles.autoCutSub}>Include "Cashier: [Staff Name]" on receipts</Text>
          </View>
          <Switch
            value={printerConfig.showCashierName !== false}
            onValueChange={(val) => setPrinterConfig((prev) => ({ ...prev, showCashierName: val }))}
            trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Optional Customer Info Toggle */}
        <View style={styles.autoCutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoCutLabel}>Print Customer Details</Text>
            <Text style={styles.autoCutSub}>Include customer name & phone number</Text>
          </View>
          <Switch
            value={printerConfig.showCustomerInfo !== false}
            onValueChange={(val) => setPrinterConfig((prev) => ({ ...prev, showCustomerInfo: val }))}
            trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Optional Tax Breakdown Toggle */}
        <View style={styles.autoCutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoCutLabel}>Include Tax (Tax Included)</Text>
            <Text style={styles.autoCutSub}>Show "Tax (Included)" line on receipts & transaction details</Text>
          </View>
          <Switch
            value={brandShowTax}
            onValueChange={(val) => {
              setBrandShowTax(val)
              setPrinterConfig((prev) => ({ ...prev, showTax: val }))
            }}
            trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Receipt Footer Message */}
        <View style={{ marginTop: tokens.spacing.sm }}>
          <Text style={styles.printerInputLabel}>RECEIPT FOOTER / RETURN POLICY</Text>
          <TextInput
            style={[styles.printerTextInput, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]}
            placeholder="e.g. Thank you for shopping with us! Items sold are not returnable."
            placeholderTextColor={tokens.colors.secondary}
            value={brandReceiptFooter}
            onChangeText={setBrandReceiptFooter}
            multiline
            numberOfLines={2}
          />
        </View>

        <TouchableOpacity
          style={[styles.savePrinterBtn, { marginTop: tokens.spacing.md }]}
          onPress={handleSaveStoreHeader}
          disabled={savingPrinter || isBrandingSyncing}
          activeOpacity={0.85}
        >
          {savingPrinter || isBrandingSyncing ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={tokens.colors.onPrimary} />
              <Text style={styles.savePrinterBtnText}>Save & Sync to All Devices</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add / Edit Printer Station Modal */}
      {showDeviceModal && editingDevice ? (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDeviceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.deviceModalContainer}>
              <View style={styles.deviceModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceModalTitle}>
                    {devices.some((d) => d.id === editingDevice.id) ? 'Edit Printer Station' : 'Add New Printer Station'}
                  </Text>
                  <Text style={styles.deviceModalSubtitle}>Configure hardware connection & station role</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDeviceModal(false)}>
                  <Ionicons name="close" size={24} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ marginTop: tokens.spacing.md }} showsVerticalScrollIndicator={false}>
                {/* Station Name */}
                <Text style={styles.printerInputLabel}>STATION / PRINTER NAME *</Text>
                <TextInput
                  style={styles.printerTextInput}
                  placeholder="e.g. Front Cashier #1, Kitchen Packing, Bar"
                  placeholderTextColor={tokens.colors.secondary}
                  value={editingDevice.name}
                  onChangeText={(text) => setEditingDevice((prev) => prev && { ...prev, name: text })}
                />

                {/* Connection Interface */}
                <Text style={[styles.printerInputLabel, { marginTop: tokens.spacing.sm }]}>CONNECTION INTERFACE</Text>
                <View style={styles.printerTypeRow}>
                  {[
                    { id: 'wifi' as const, label: 'Wi-Fi / IP (9100)', icon: 'wifi' as const },
                    { id: 'bluetooth' as const, label: 'Bluetooth', icon: 'bluetooth' as const },
                    { id: 'system' as const, label: 'System Print', icon: 'print' as const },
                  ].map((type) => {
                    const isSelected = editingDevice.connectionType === type.id
                    return (
                      <TouchableOpacity
                        key={type.id}
                        style={[styles.printerTypeChip, isSelected && styles.printerTypeChipActive]}
                        onPress={() => setEditingDevice((prev) => prev && { ...prev, connectionType: type.id })}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={type.icon}
                          size={14}
                          color={isSelected ? tokens.colors.onPrimary : tokens.colors.primary}
                        />
                        <Text style={[styles.printerTypeChipText, isSelected && styles.printerTypeChipTextActive]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Wi-Fi Settings */}
                {editingDevice.connectionType === 'wifi' && (
                  <View style={styles.printerFieldsGrid}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.printerInputLabel}>PRINTER IP ADDRESS</Text>
                      <TextInput
                        style={styles.printerTextInput}
                        placeholder="e.g. 192.168.1.100"
                        placeholderTextColor={tokens.colors.secondary}
                        value={editingDevice.ipAddress || ''}
                        onChangeText={(text) => setEditingDevice((prev) => prev && { ...prev, ipAddress: text })}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.printerInputLabel}>PORT</Text>
                      <TextInput
                        style={styles.printerTextInput}
                        placeholder="9100"
                        placeholderTextColor={tokens.colors.secondary}
                        value={String(editingDevice.port || 9100)}
                        onChangeText={(text) => setEditingDevice((prev) => prev && { ...prev, port: parseInt(text, 10) || 9100 })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                )}

                {/* Bluetooth Settings */}
                {editingDevice.connectionType === 'bluetooth' && (
                  <View style={{ marginTop: tokens.spacing.xs }}>
                    <Text style={styles.printerInputLabel}>BLUETOOTH DEVICE NAME / PAIRED ID</Text>
                    <TextInput
                      style={styles.printerTextInput}
                      placeholder="e.g. MPT-II, RPP02N, XP-58, PT-210"
                      placeholderTextColor={tokens.colors.secondary}
                      value={editingDevice.bluetoothName || ''}
                      onChangeText={(text) => setEditingDevice((prev) => prev && { ...prev, bluetoothName: text })}
                    />
                    <Text style={styles.bluetoothTip}>
                      💡 Pair printer first in Phone Settings → Bluetooth (PIN: 0000 or 1234).
                    </Text>
                  </View>
                )}

                {/* Station Role */}
                <Text style={[styles.printerInputLabel, { marginTop: tokens.spacing.sm }]}>STATION ROLE</Text>
                <View style={styles.printerTypeRow}>
                  {[
                    { id: 'receipt' as const, label: '🧾 Customer Receipt' },
                    { id: 'kitchen' as const, label: '🍳 Kitchen / Prep' },
                  ].map((r) => {
                    const isSelected = editingDevice.role === r.id
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.paperWidthChip, isSelected && styles.paperWidthChipActive]}
                        onPress={() => setEditingDevice((prev) => prev && { ...prev, role: r.id })}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.paperWidthText, isSelected && styles.paperWidthTextActive]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Paper Width */}
                <Text style={[styles.printerInputLabel, { marginTop: tokens.spacing.sm }]}>PAPER ROLL WIDTH</Text>
                <View style={styles.printerTypeRow}>
                  {[
                    { id: '80mm' as const, label: '80mm (Standard)' },
                    { id: '58mm' as const, label: '58mm (Small)' },
                  ].map((w) => {
                    const isSelected = editingDevice.paperWidth === w.id
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.paperWidthChip, isSelected && styles.paperWidthChipActive]}
                        onPress={() => setEditingDevice((prev) => prev && { ...prev, paperWidth: w.id })}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.paperWidthText, isSelected && styles.paperWidthTextActive]}>
                          {w.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Toggles */}
                <View style={[styles.autoCutRow, { marginTop: tokens.spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoCutLabel}>Auto-Cut Paper</Text>
                    <Text style={styles.autoCutSub}>Trigger thermal knife after ticket</Text>
                  </View>
                  <Switch
                    value={editingDevice.autoCut}
                    onValueChange={(val) => setEditingDevice((prev) => prev && { ...prev, autoCut: val })}
                    trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryFixed }}
                    thumbColor={editingDevice.autoCut ? tokens.colors.primaryContainer : '#f4f3f4'}
                  />
                </View>

                <View style={styles.autoCutRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoCutLabel}>Set as Default Receipt Printer</Text>
                    <Text style={styles.autoCutSub}>Primary destination for 1-tap checkout</Text>
                  </View>
                  <Switch
                    value={editingDevice.isDefault}
                    onValueChange={(val) => setEditingDevice((prev) => prev && { ...prev, isDefault: val })}
                    trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryFixed }}
                    thumbColor={editingDevice.isDefault ? tokens.colors.primaryContainer : '#f4f3f4'}
                  />
                </View>

                {/* Modal Action Buttons */}
                <View style={[styles.printerActionButtonsRow, { marginTop: tokens.spacing.lg }]}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowDeviceModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleSaveDevice}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.modalSaveBtnText}>Save Station</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Hardware & System Diagnostics */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>System Diagnostics</Text>
        <Text style={styles.sectionSubtitle}>Live health & data synchronization</Text>
      </View>

      <View style={styles.diagnosticsCard}>
        {/* Backend API Health Status */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View
              style={[
                styles.diagnosticIconCircle,
                healthStatus.connected ? styles.diagSuccess : styles.diagError,
              ]}
            >
              <Ionicons
                name={healthStatus.connected ? 'server-outline' : 'cloud-offline-outline'}
                size={18}
                color={healthStatus.connected ? tokens.colors.statusSuccess : tokens.colors.statusError}
              />
            </View>
            <View>
              <Text style={styles.diagnosticLabel}>Backend API Connectivity</Text>
              <Text style={styles.diagnosticSub}>
                {healthStatus.status} ({healthStatus.version}) • {healthStatus.database}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshHealthBtn}
            onPress={checkBackendHealth}
            disabled={healthLoading}
            activeOpacity={0.7}
          >
            {healthLoading ? (
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            ) : (
              <Ionicons name="refresh" size={16} color={tokens.colors.primaryContainer} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Offline Queue Status */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View
              style={[
                styles.diagnosticIconCircle,
                pendingCount > 0 ? styles.diagWarning : styles.diagSuccess,
              ]}
            >
              <Ionicons
                name={pendingCount > 0 ? 'sync-outline' : 'checkmark-done-outline'}
                size={18}
                color={pendingCount > 0 ? tokens.colors.statusPending : tokens.colors.statusSuccess}
              />
            </View>
            <View>
              <Text style={styles.diagnosticLabel}>Offline Sync Queue</Text>
              <Text style={styles.diagnosticSub}>
                {pendingCount === 0
                  ? 'All local mutations synced to server'
                  : `${pendingCount} order(s) pending sync`}
              </Text>
            </View>
          </View>

          {pendingCount > 0 && (
            <TouchableOpacity
              style={styles.syncNowBtn}
              onPress={handleSyncOffline}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <Text style={styles.syncNowBtnText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        {/* App Version Info */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View style={[styles.diagnosticIconCircle, styles.diagNeutral]}>
              <Ionicons name="phone-portrait-outline" size={18} color={tokens.colors.secondary} />
            </View>
            <View>
              <Text style={styles.diagnosticLabel}>KC Inventory Mobile</Text>
              <Text style={styles.diagnosticSub}>Version 1.0.0 (Build 2026.08.22)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Account & Session Management Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Account & Session</Text>
        <Text style={styles.sectionSubtitle}>Current logged-in staff profile</Text>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountInfoRow}>
          <View style={styles.accountAvatar}>
            <Ionicons
              name={currentUser?.role === 'SUPER_ADMIN' ? 'shield-checkmark' : 'person'}
              size={22}
              color={tokens.colors.primaryContainer}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{currentUser?.name || 'Staff User'}</Text>
            <Text style={styles.accountEmail}>{currentUser?.email || 'user@kcinventory.com'}</Text>
            <View style={styles.accountRoleBadge}>
              <Text style={styles.accountRoleText}>{currentUser?.role || 'SELLER'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          testID="btn-settings-logout"
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.85}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={tokens.colors.onPrimary} />
              <Text style={styles.logoutBtnText}>Sign Out / Logout</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  contentContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl + 20,
  },
  storeCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    ...tokens.shadows.cardInnerDepth,
  },
  storeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  storeIconBox: {
    width: 48,
    height: 48,
    borderRadius: tokens.borderRadius.thumbnail,
    backgroundColor: tokens.colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: {
    flex: 1,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  storeName: {
    fontSize: tokens.typography.bodyLarge.fontSize,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    flex: 1,
  },
  storeIdBadge: {
    backgroundColor: tokens.colors.secondaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  storeIdText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.onSecondaryContainer,
  },
  storeAddress: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  terminalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.statusSuccess,
    marginRight: 6,
  },
  terminalStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.statusSuccess,
  },
  sectionHeaderRow: {
    marginBottom: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  sectionTitle: {
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  diagnosticsCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    ...tokens.shadows.cardInnerDepth,
  },
  diagnosticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
  },
  diagnosticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: tokens.spacing.sm + 2,
  },
  diagnosticIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagSuccess: {
    backgroundColor: tokens.colors.badgeSuccessBg,
  },
  diagWarning: {
    backgroundColor: tokens.colors.statusPendingBg,
  },
  diagError: {
    backgroundColor: tokens.colors.badgeErrorBg,
  },
  diagNeutral: {
    backgroundColor: tokens.colors.surfaceContainer,
  },
  diagnosticLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  diagnosticSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  refreshHealthBtn: {
    padding: 8,
  },
  syncNowBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
  },
  syncNowBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: tokens.spacing.sm,
  },
  accountCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    gap: tokens.spacing.md,
    ...tokens.shadows.cardInnerDepth,
  },
  accountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  accountAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  accountEmail: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  accountRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    marginTop: 4,
  },
  accountRoleText: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.statusError,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
    ...tokens.shadows.card,
  },
  logoutBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  // Thermal Printer Styles
  addPrinterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
  },
  addPrinterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  printerListContainer: {
    marginBottom: tokens.spacing.md,
  },
  deviceCardItem: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    ...tokens.shadows.cardInnerDepth,
  },
  deviceCardItemDefault: {
    borderColor: tokens.colors.primaryContainer,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  defaultStationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
  },
  defaultStationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  deviceItemEndpoint: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  deviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: tokens.spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.sm,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleBadgeReceipt: {
    backgroundColor: '#DCFCE7',
  },
  roleBadgeReceiptText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  roleBadgeKitchen: {
    backgroundColor: '#FFEDD5',
  },
  roleBadgeKitchenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  paperBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.sm,
  },
  paperBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  cutBadge: {
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.sm,
  },
  cutBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  deviceCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: tokens.spacing.sm + 2,
    paddingTop: tokens.spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  deviceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  deviceActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  printerCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    ...tokens.shadows.cardInnerDepth,
  },
  printerInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    height: 15,
    lineHeight: 15,
  },
  printerTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  printerTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: tokens.colors.surfaceAlt,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderSubtle,
  },
  printerTypeChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  printerTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  printerTypeChipTextActive: {
    color: tokens.colors.onPrimary,
  },
  printerFieldsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: tokens.spacing.xs,
  },
  printerTextInput: {
    height: 42,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: tokens.spacing.sm + 2,
    fontSize: 13,
    color: tokens.colors.onSurface,
  },
  paperWidthChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderSubtle,
  },
  paperWidthChipActive: {
    backgroundColor: tokens.colors.primaryFixed,
    borderColor: tokens.colors.primaryContainer,
  },
  paperWidthText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  paperWidthTextActive: {
    color: tokens.colors.primary,
    fontWeight: '800',
  },
  autoCutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    marginTop: tokens.spacing.sm,
  },
  autoCutLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  autoCutSub: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  bluetoothTip: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  printerActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: tokens.spacing.sm + 2,
  },
  testPrintBtn: {
    flex: 1,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  testPrintBtnText: {
    color: tokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  savePrinterBtn: {
    flex: 1.4,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  savePrinterBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  deviceModalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.xl,
    padding: tokens.spacing.lg,
    ...tokens.shadows.actionSheet,
  },
  deviceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  deviceModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  deviceModalSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  modalSaveBtn: {
    flex: 1.3,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandingLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    padding: tokens.spacing.sm + 2,
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  brandingLogoPreviewBox: {
    width: 60,
    height: 60,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandingLogoImg: {
    width: 52,
    height: 52,
  },
  logoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  logoPickerBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  logoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: tokens.spacing.sm + 4,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  logoRemoveBtnText: {
    color: tokens.colors.statusError,
    fontSize: 12,
    fontWeight: '700',
  },
  brandingHelpText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    lineHeight: 15,
  },
  storeLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
  },
  restorePresetsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  restorePresetsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  emptyPrinterCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderStyle: 'dashed',
    marginBottom: tokens.spacing.md,
  },
  emptyPrinterIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  emptyPrinterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 4,
  },
  emptyPrinterSub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  emptyRestoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
})

export default SettingsScreen
