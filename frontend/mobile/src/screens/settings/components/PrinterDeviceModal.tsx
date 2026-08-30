import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SettingsScreen.styles'
import type { PrinterDevice } from '../../../utils/thermalPrinter'

export interface PrinterDeviceModalProps {
  visible: boolean
  editingDevice: PrinterDevice | null
  devices: PrinterDevice[]
  setEditingDevice: React.Dispatch<React.SetStateAction<PrinterDevice | null>>
  onClose: () => void
  onSave: () => void
}

export const PrinterDeviceModal: React.FC<PrinterDeviceModalProps> = ({
  visible,
  editingDevice,
  devices,
  setEditingDevice,
  onClose,
  onSave,
}) => {
  if (!visible || !editingDevice) return null

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
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
            <TouchableOpacity onPress={onClose}>
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
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={onSave}
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
  )
}
