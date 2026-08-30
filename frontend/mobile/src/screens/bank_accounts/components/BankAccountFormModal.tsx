import React from 'react'
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { tokens } from '../../../theme/tokens'
import { styles } from '../BankAccountsScreen.styles'
import { POPULAR_BANKS } from '../bankAccountUtils'
import { ControlledInput } from '../../../components/ControlledInput'
import type { Control, UseFormSetValue } from 'react-hook-form'
import type { BankAccountFormValues } from '../../../utils/validation'

export interface BankAccountFormModalProps {
  visible: boolean
  editingId: string | null
  control: Control<BankAccountFormValues>
  setValue: UseFormSetValue<BankAccountFormValues>
  formBankName: string
  formCurrency: string
  qrImageUrl: string
  setQrImageUrl: (url: string) => void
  isDefault: boolean
  setIsDefault: (def: boolean) => void
  onClose: () => void
  onSubmit: () => void
}

export const BankAccountFormModal: React.FC<BankAccountFormModalProps> = ({
  visible,
  editingId,
  control,
  setValue,
  formBankName,
  formCurrency,
  qrImageUrl,
  setQrImageUrl,
  isDefault,
  setIsDefault,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Bank Account' : 'Add Bank Account'}
              </Text>
              <Text style={styles.modalSub}>
                Configure bank details for checkout QR and wire info
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Select Bank Provider */}
            <Text style={styles.inputLabel}>Bank Provider</Text>
            <View style={styles.bankSelectRow}>
              {POPULAR_BANKS.map((bank) => {
                const isSelected = formBankName === bank.name
                return (
                  <TouchableOpacity
                    key={bank.name}
                    style={[
                      styles.bankSelectChip,
                      isSelected && {
                        borderColor: bank.color,
                        backgroundColor: `${bank.color}15`,
                      },
                    ]}
                    onPress={() => setValue('bankName', bank.name)}
                  >
                    <View
                      style={[
                        styles.bankChipIcon,
                        { backgroundColor: bank.color },
                      ]}
                    >
                      <Ionicons name={bank.icon} size={12} color="#FFFFFF" />
                    </View>
                    <Text
                      style={[
                        styles.bankSelectChipText,
                        isSelected && { color: bank.color, fontWeight: '700' },
                      ]}
                    >
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Account Number */}
            <ControlledInput
              name="accountNumber"
              control={control}
              label="Account Number *"
              placeholder="e.g. 001 234 567"
              inputProps={{ keyboardType: 'numeric' }}
            />

            {/* Account Name */}
            <ControlledInput
              name="accountName"
              control={control}
              label="Account Holder Name *"
              placeholder="e.g. KC INVENTORY STORE"
              inputProps={{ autoCapitalize: 'characters' }}
            />

            {/* Currency Selector */}
            <Text style={styles.inputLabel}>Accepted Currency</Text>
            <View style={styles.currencyRow}>
              {(['USD', 'KHR', 'Dual'] as const).map((c) => {
                const isSelected = formCurrency === c
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.currencyBtn,
                      isSelected && styles.currencyBtnActive,
                    ]}
                    onPress={() => setValue('currency', c)}
                  >
                    <Text
                      style={[
                        styles.currencyBtnText,
                        isSelected && styles.currencyBtnTextActive,
                      ]}
                    >
                      {c === 'Dual' ? 'Dual ($ & ៛)' : c}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Optional Custom QR Image */}
            <Text style={styles.inputLabel}>QR Code Image (Optional)</Text>
            <TouchableOpacity
              style={styles.imagePickerBtn}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.8,
                })
                if (
                  !result.canceled &&
                  result.assets &&
                  result.assets.length > 0
                ) {
                  setQrImageUrl(result.assets[0].uri)
                }
              }}
            >
              <Ionicons
                name="image-outline"
                size={20}
                color={tokens.colors.primary}
              />
              <Text style={styles.imagePickerText}>
                {qrImageUrl ? 'Change QR Image' : 'Select Image from Phone'}
              </Text>
            </TouchableOpacity>
            {qrImageUrl ? (
              <Image
                source={{ uri: qrImageUrl }}
                style={styles.selectedQrImage}
                contentFit="contain"
              />
            ) : null}

            {/* Default Switch */}
            <TouchableOpacity
              style={styles.defaultToggleRow}
              onPress={() => setIsDefault(!isDefault)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isDefault ? 'checkbox' : 'square-outline'}
                size={22}
                color={
                  isDefault
                    ? tokens.colors.primaryContainer
                    : tokens.colors.secondary
                }
              />
              <Text style={styles.defaultToggleText}>
                Set as Default Bank Account for POS
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={onSubmit}>
              <Text style={styles.saveBtnText}>Save Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
