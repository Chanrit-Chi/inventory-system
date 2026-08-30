import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../InvoicesScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
import type { Control, FieldArrayWithId } from 'react-hook-form'
import type { InvoiceFormValues } from '../../../utils/validation'

export interface CreateInvoiceModalProps {
  visible: boolean
  invoiceControl: Control<InvoiceFormValues>
  invoiceItemFields: FieldArrayWithId<InvoiceFormValues, 'items', 'id'>[]
  submittingInvoice: boolean
  onClose: () => void
  onOpenCatalog: () => void
  onOpenScanner: () => void
  onAddCustomItem: () => void
  onRemoveItem: (index: number, name?: string) => void
  onSubmit: () => void
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  visible,
  invoiceControl,
  invoiceItemFields,
  submittingInvoice,
  onClose,
  onOpenCatalog,
  onOpenScanner,
  onAddCustomItem,
  onRemoveItem,
  onSubmit,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.detailTitle}>Create New Invoice</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
            <ControlledInput
              name="customerName"
              control={invoiceControl}
              label="Customer Name *"
              placeholder="e.g. Acme Corporation / Sarah Connor"
            />
            <ControlledInput
              name="customerPhone"
              control={invoiceControl}
              label="Customer Phone (Optional)"
              placeholder="+855 ..."
              inputProps={{ keyboardType: 'phone-pad' }}
            />
            <ControlledInput
              name="dueDate"
              control={invoiceControl}
              label="Due Date (YYYY-MM-DD)"
              placeholder="YYYY-MM-DD"
            />

            <View style={styles.itemsSection}>
              <Text style={styles.formLabel}>Invoice Line Items</Text>
              <View style={styles.itemActionsRow}>
                <TouchableOpacity
                  style={[styles.addItemBtn, styles.addItemBtnPrimary]}
                  onPress={onOpenCatalog}
                  activeOpacity={0.85}
                >
                  <Ionicons name="list-outline" size={14} color={tokens.colors.onPrimary} />
                  <Text style={[styles.addItemBtnText, { color: tokens.colors.onPrimary }]}>Catalog</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addItemBtn, styles.addItemBtnOutlined]}
                  onPress={onOpenScanner}
                  activeOpacity={0.85}
                >
                  <Ionicons name="barcode-outline" size={14} color={tokens.colors.primary} />
                  <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addItemBtn, styles.addItemBtnTonal]}
                  onPress={onAddCustomItem}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={14} color={tokens.colors.primary} />
                  <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>Custom</Text>
                </TouchableOpacity>
              </View>
            </View>

            {invoiceItemFields.map((item, idx) => (
              <View key={item.id} style={styles.createItemBox}>
                <View style={styles.itemBoxTopRow}>
                  <Text style={styles.itemBoxIndex}>Item #{idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => onRemoveItem(idx, item.productName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={tokens.colors.actionDestructive} />
                  </TouchableOpacity>
                </View>
                <ControlledInput
                  name={`items.${idx}.productName`}
                  control={invoiceControl}
                  label=""
                  placeholder="Product Name"
                  inputProps={{ style: styles.itemInput }}
                />
                <View style={styles.inlineInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ControlledInput
                      name={`items.${idx}.quantity`}
                      control={invoiceControl}
                      label=""
                      placeholder="Qty"
                      inputProps={{
                        keyboardType: 'numeric',
                        style: [styles.itemInput, { flex: 1 }],
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ControlledInput
                      name={`items.${idx}.unitPrice`}
                      control={invoiceControl}
                      label=""
                      placeholder="Unit Price ($)"
                      inputProps={{
                        keyboardType: 'numeric',
                        style: [styles.itemInput, { flex: 1 }],
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}

            <ControlledInput
              name="notes"
              control={invoiceControl}
              label="Terms / Notes (Optional)"
              placeholder="Payment terms, bank details, delivery notes..."
              inputProps={{ multiline: true, style: [styles.input, { height: 60 }] }}
            />

            <TouchableOpacity
              style={[styles.submitPayBtn, submittingInvoice && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={submittingInvoice}
              activeOpacity={0.85}
            >
              {submittingInvoice ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <Text style={styles.submitPayText}>Save & Issue Invoice</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
