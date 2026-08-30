import React from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../BankAccountsScreen.styles'
import type { BankAccount } from '../../../types'

export interface BankAccountQrPreviewModalProps {
  account: BankAccount | null
  onClose: () => void
}

export const BankAccountQrPreviewModal: React.FC<BankAccountQrPreviewModalProps> = ({
  account,
  onClose,
}) => {
  return (
    <Modal
      visible={Boolean(account)}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.qrPreviewCard}>
          <View style={styles.qrPreviewHeader}>
            <Text style={styles.qrPreviewTitle}>{account?.bankName} KHQR</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {account?.qrImageUrl ? (
            <View style={styles.qrFullWrap}>
              <Image
                source={{ uri: account.qrImageUrl }}
                style={styles.qrFullImage}
                contentFit="contain"
              />
            </View>
          ) : null}

          <Text style={styles.qrAccName}>{account?.accountName}</Text>
          <Text style={styles.qrAccNum}>{account?.accountNumber}</Text>
          <Text style={styles.qrScanHint}>
            Customer can scan with any Cambodian banking app
          </Text>

          <TouchableOpacity style={styles.closeQrBtn} onPress={onClose}>
            <Text style={styles.closeQrBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
