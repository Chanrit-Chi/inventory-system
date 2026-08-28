import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { PrinterDevice } from '../utils/thermalPrinter'

export interface PrinterPickerModalProps {
  visible: boolean
  devices: PrinterDevice[]
  onSelectDevice: (device: PrinterDevice) => void
  onPrintAll?: () => void
  onManagePrinters?: () => void
  onClose: () => void
}

export const PrinterPickerModal: React.FC<PrinterPickerModalProps> = ({
  visible,
  devices,
  onSelectDevice,
  onPrintAll,
  onManagePrinters,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="print" size={20} color={tokens.colors.primaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Select Printer Station</Text>
                <Text style={styles.subtitle}>Choose where to dispatch this order ticket</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Device List */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {devices.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={36} color={tokens.colors.secondary} />
                <Text style={styles.emptyStateTitle}>No Printers Configured</Text>
                <Text style={styles.emptyStateSubtitle}>Add a Wi-Fi or Bluetooth printer in Settings.</Text>
              </View>
            ) : (
              devices.map((device) => {
                const isWifi = device.connectionType === 'wifi'
                const isBt = device.connectionType === 'bluetooth'
                const isKitchen = device.role === 'kitchen'

                return (
                  <TouchableOpacity
                    key={device.id}
                    style={[styles.deviceCard, device.isDefault && styles.deviceCardDefault]}
                    onPress={() => onSelectDevice(device)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.deviceIconBox}>
                      <Ionicons
                        name={isWifi ? 'wifi' : isBt ? 'bluetooth' : 'print'}
                        size={20}
                        color={isKitchen ? '#D97706' : tokens.colors.primaryContainer}
                      />
                    </View>

                    <View style={styles.deviceDetails}>
                      <View style={styles.deviceNameRow}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {device.name}
                        </Text>
                        {Boolean(device.isDefault) && (
                          <View style={styles.defaultBadge}>
                            <Ionicons name="star" size={10} color="#B45309" />
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.deviceEndpoint}>
                        {isWifi
                          ? `IP: ${device.ipAddress || '192.168.1.100'}:${device.port || 9100}`
                          : isBt
                          ? `Paired: ${device.bluetoothName || 'Bluetooth Printer'}`
                          : 'System OS Spooler'}
                      </Text>

                      <View style={styles.badgesRow}>
                        <View style={[styles.roleBadge, isKitchen ? styles.roleBadgeKitchen : styles.roleBadgeReceipt]}>
                          <Text style={[styles.roleBadgeText, isKitchen ? styles.roleBadgeKitchenText : styles.roleBadgeReceiptText]}>
                            {isKitchen ? '🍳 Kitchen / Prep' : '🧾 Customer Receipt'}
                          </Text>
                        </View>
                        <View style={styles.paperBadge}>
                          <Text style={styles.paperBadgeText}>{device.paperWidth}</Text>
                        </View>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={tokens.colors.secondary} />
                  </TouchableOpacity>
                )
              })
            )}

            {/* Print to All Stations Option if 2+ printers */}
            {devices.length > 1 && onPrintAll && (
              <TouchableOpacity
                style={styles.printAllButton}
                onPress={onPrintAll}
                activeOpacity={0.85}
              >
                <Ionicons name="layers-outline" size={18} color="#5B21B6" />
                <Text style={styles.printAllButtonText}>Print to All Stations ({devices.length} Printers)</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {Boolean(onManagePrinters) && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => {
                  onClose()
                  onManagePrinters?.()
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={16} color={tokens.colors.primary} />
                <Text style={styles.manageBtnText}>Manage Printers</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.xl,
    padding: tokens.spacing.lg,
    ...tokens.shadows.actionSheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  subtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  body: {
    marginTop: tokens.spacing.md,
  },
  emptyState: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.sm,
    gap: 12,
  },
  deviceCardDefault: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  deviceIconBox: {
    width: 38,
    height: 38,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceDetails: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    flexShrink: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  deviceEndpoint: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
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
  printAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.md,
    marginTop: 4,
    marginBottom: tokens.spacing.sm,
  },
  printAllButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  manageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
})
