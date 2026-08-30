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
import { styles } from '../QuotationsScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
import type { Control, UseFieldArrayReturn } from 'react-hook-form'
import type { QuotationFormValues } from '../../../utils/validation'

export interface CreateQuotationModalProps {
  visible: boolean
  control: Control<QuotationFormValues>
  itemFields: UseFieldArrayReturn<QuotationFormValues, 'items'>['fields']
  submitting: boolean
  onClose: () => void
  onOpenCatalog: () => void
  onOpenScanner: () => void
  onAppendCustomItem: () => void
  onRemoveItemWithConfirm: (index: number, name: string) => void
  onSubmit: () => void
}

export const CreateQuotationModal: React.FC<CreateQuotationModalProps> = ({
  visible,
  control,
  itemFields,
  submitting,
  onClose,
  onOpenCatalog,
  onOpenScanner,
  onAppendCustomItem,
  onRemoveItemWithConfirm,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.detailTitle}>Create New Quotation</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
            <ControlledInput
              name="customerName"
              control={control}
              label="Customer Name *"
              placeholder="e.g. Acme Corporation / John Doe"
            />
            <ControlledInput
              name="customerPhone"
              control={control}
              label="Customer Phone *"
              placeholder="+855 ..."
              inputProps={{ keyboardType: 'phone-pad' }}
            />

            <View style={styles.itemsSection}>
              <Text style={styles.formLabel}>Items in Quotation</Text>
              <View style={styles.itemActionsRow}>
                <TouchableOpacity
                  style={[styles.addItemBtn, styles.addItemBtnPrimary]}
                  onPress={onOpenCatalog}
                  activeOpacity={0.85}
                >
                  <Ionicons name="list-outline" size={14} color={tokens.colors.onPrimary} />
                  <Text style={[styles.addItemBtnText, { color: tokens.colors.onPrimary }]}>
                    Catalog
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addItemBtn, styles.addItemBtnOutlined]}
                  onPress={onOpenScanner}
                  activeOpacity={0.85}
                >
                  <Ionicons name="barcode-outline" size={14} color={tokens.colors.primary} />
                  <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>
                    Scan
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addItemBtn, styles.addItemBtnTonal]}
                  onPress={onAppendCustomItem}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={14} color={tokens.colors.primary} />
                  <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {itemFields.map((item, idx) => (
              <View key={item.id} style={styles.createItemBox}>
                <View style={styles.itemBoxTopRow}>
                  <Text style={styles.itemBoxIndex}>Item #{idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => onRemoveItemWithConfirm(idx, item.productName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={tokens.colors.actionDestructive}
                    />
                  </TouchableOpacity>
                </View>
                <ControlledInput
                  name={`items.${idx}.productName`}
                  control={control}
                  label=""
                  placeholder="Product Name"
                  inputProps={{ style: styles.itemInput }}
                />
                <View style={styles.inlineInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ControlledInput
                      name={`items.${idx}.quantity`}
                      control={control}
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
                      control={control}
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
              name="discount"
              control={control}
              label="Discount Amount ($)"
              placeholder="0.00"
              inputProps={{ keyboardType: 'numeric' }}
            />

            <ControlledInput
              name="notes"
              control={control}
              label="Notes / Validity Terms"
              placeholder="Quote valid for 14 days..."
              inputProps={{ multiline: true, style: [styles.input, { height: 60 }] }}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>Save & Send Quotation</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
