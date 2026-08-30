import React from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { tokens } from '../../../theme/tokens'
import type { UserAccount } from '../../../types'
import { styles } from '../PayrollScreen.styles'
import { formatCurrency } from '../payrollUtils'

export interface StandalonePayoutModalProps {
  visible: boolean
  user: UserAccount | null
  availableReserve: number
  amount: string
  notes: string
  saving: boolean
  onClose: () => void
  onChangeAmount: (val: string) => void
  onChangeNotes: (val: string) => void
  onConfirm: () => void
}

export const StandalonePayoutModal: React.FC<StandalonePayoutModalProps> = ({
  visible,
  user,
  availableReserve,
  amount,
  notes,
  saving,
  onClose,
  onChangeAmount,
  onChangeNotes,
  onConfirm,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Disburse 13th Month / Bonus</Text>
          <Text style={{ fontSize: 12, color: tokens.colors.secondary, marginTop: -10, marginBottom: 12 }}>
            Staff: <Text style={{ fontWeight: '700', color: tokens.colors.onSurface }}>{user?.name}</Text> • Available: <Text style={{ fontWeight: '800', color: tokens.colors.statusSuccess }}>{formatCurrency(availableReserve)}</Text>
          </Text>

          <Text style={styles.modalLabel}>Payout Amount ($)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            keyboardType="decimal-pad"
            onChangeText={onChangeAmount}
            placeholder="0.00"
          />

          <Text style={styles.modalLabel}>Disbursement Notes / Reason</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={onChangeNotes}
            placeholder="e.g. Khmer New Year 1st Half Bonus"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnAction}
              onPress={onConfirm}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalBtnActionText}>Confirm Payout</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
