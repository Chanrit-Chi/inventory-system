import React from 'react'
import { View, Text, TextInput, Modal, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'

interface SupplierFormModalProps {
  newSupModalOpen: boolean
  setNewSupModalOpen: (v: boolean) => void
  newSupName: string
  setNewSupName: (v: string) => void
  newSupContact: string
  setNewSupContact: (v: string) => void
  newSupPhone: string
  setNewSupPhone: (v: string) => void
  newSupEmail: string
  setNewSupEmail: (v: string) => void
  newSupAddress: string
  setNewSupAddress: (v: string) => void
  newSupLeadTime: string
  setNewSupLeadTime: (v: string) => void
  handleCreateSupplier: () => void
}

export function SupplierFormModal({
  newSupModalOpen,
  setNewSupModalOpen,
  newSupName,
  setNewSupName,
  newSupContact,
  setNewSupContact,
  newSupPhone,
  setNewSupPhone,
  newSupEmail,
  setNewSupEmail,
  newSupAddress,
  setNewSupAddress,
  newSupLeadTime,
  setNewSupLeadTime,
  handleCreateSupplier,
}: SupplierFormModalProps) {
  return (
      <Modal visible={newSupModalOpen} transparent animationType="slide" onRequestClose={() => setNewSupModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Add New Vendor / Supplier</Text>
              <TouchableOpacity onPress={() => setNewSupModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.formLabel}>Supplier / Company Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apex Distribution Asia Co."
                value={newSupName}
                onChangeText={setNewSupName}
              />

              <Text style={styles.formLabel}>Contact Person</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mr. Sokha Chan"
                value={newSupContact}
                onChangeText={setNewSupContact}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+855 23 888 777"
                    value={newSupPhone}
                    onChangeText={setNewSupPhone}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Lead Time (Days)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="3"
                    value={newSupLeadTime}
                    onChangeText={setNewSupLeadTime}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                keyboardType="email-address"
                placeholder="orders@apexsupplier.kh"
                value={newSupEmail}
                onChangeText={setNewSupEmail}
              />

              <Text style={styles.formLabel}>Office / Warehouse Address</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. National Road 4, Phnom Penh"
                value={newSupAddress}
                onChangeText={setNewSupAddress}
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateSupplier}>
                <Text style={styles.submitBtnText}>Register Vendor</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

  )
}
