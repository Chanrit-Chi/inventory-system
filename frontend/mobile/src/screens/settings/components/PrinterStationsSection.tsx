import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SettingsScreen.styles'
import type { PrinterDevice } from '../../../utils/thermalPrinter'

export interface PrinterStationsSectionProps {
  devices: PrinterDevice[]
  testingDeviceId: string | null
  onOpenAddDevice: () => void
  onRestoreDefaultPrinters: () => void
  onTestDevice: (device: PrinterDevice) => void
  onSetDefault: (device: PrinterDevice) => void
  onOpenEditDevice: (device: PrinterDevice) => void
  onDeleteDevice: (device: PrinterDevice) => void
}

export const PrinterStationsSection: React.FC<PrinterStationsSectionProps> = ({
  devices,
  testingDeviceId,
  onOpenAddDevice,
  onRestoreDefaultPrinters,
  onTestDevice,
  onSetDefault,
  onOpenEditDevice,
  onDeleteDevice,
}) => {
  return (
    <>
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
              onPress={onRestoreDefaultPrinters}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={14} color={tokens.colors.primaryContainer} />
              <Text style={styles.restorePresetsBtnText}>Presets</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.addPrinterBtn}
            onPress={onOpenAddDevice}
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
                onPress={onOpenAddDevice}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add Printer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyRestoreBtn}
                onPress={onRestoreDefaultPrinters}
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
                    onPress={() => onTestDevice(device)}
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
                      onPress={() => onSetDefault(device)}
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
                    onPress={() => onOpenEditDevice(device)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={14} color={tokens.colors.secondary} />
                    <Text style={[styles.deviceActionBtnText, { color: tokens.colors.secondary }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deviceActionBtn, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}
                    onPress={() => onDeleteDevice(device)}
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
    </>
  )
}
