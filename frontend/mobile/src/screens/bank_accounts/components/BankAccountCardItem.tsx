import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../BankAccountsScreen.styles'
import { POPULAR_BANKS } from '../bankAccountUtils'
import type { BankAccount } from '../../../types'

export interface BankAccountCardItemProps {
  account: BankAccount
  onSetDefault: (id: string, bankName: string) => void
  onOpenEdit: (acc: BankAccount) => void
  onOpenQrPreview: (acc: BankAccount) => void
  onDelete: (id: string, bankName: string) => void
}

export const BankAccountCardItem: React.FC<BankAccountCardItemProps> = React.memo(({
  account,
  onSetDefault,
  onOpenEdit,
  onOpenQrPreview,
  onDelete,
}) => {
  const bankMeta = POPULAR_BANKS.find((b) => b.name === account.bankName) || {
    color: '#005F83',
    icon: 'business' as const,
  }

  return (
    <View style={styles.bankCard}>
      {/* Card Header Colored Banner */}
      <View style={[styles.bankCardHeader, { backgroundColor: bankMeta.color }]}>
        <View style={styles.bankHeaderLeft}>
          <View style={styles.bankIconCircle}>
            <Ionicons name={bankMeta.icon} size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.bankNameText}>{account.bankName}</Text>
        </View>

        <View style={styles.bankHeaderRight}>
          {account.isDefault ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.setDefaultBtn}
              onPress={() => onSetDefault(account.id, account.bankName)}
              activeOpacity={0.8}
            >
              <Text style={styles.setDefaultBtnText}>Set Default</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.bankCardBody}>
        <View style={styles.bankInfoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoFieldLabel}>ACCOUNT NUMBER</Text>
            <Text style={styles.accountNumberText}>{account.accountNumber}</Text>

            <Text style={[styles.infoFieldLabel, { marginTop: 8 }]}>ACCOUNT NAME</Text>
            <Text style={styles.accountNameText}>{account.accountName}</Text>

            <View style={styles.metaPillsRow}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>{account.currency}</Text>
              </View>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>ACTIVE</Text>
              </View>
            </View>
          </View>

          {/* QR Code Preview Thumbnail */}
          {account.qrImageUrl ? (
            <TouchableOpacity
              style={styles.qrThumbWrap}
              onPress={() => onOpenQrPreview(account)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: account.qrImageUrl }}
                style={styles.qrThumbnail}
                contentFit="cover"
              />
              <View style={styles.qrZoomHint}>
                <Ionicons name="expand" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.qrThumbWrap, styles.qrPlaceholder]}>
              <Ionicons
                name="qr-code-outline"
                size={28}
                color={tokens.colors.textMuted}
              />
              <Text style={styles.noQrText}>No QR</Text>
            </View>
          )}
        </View>

        {/* Card Bottom Actions */}
        <View style={styles.bankCardActions}>
          <TouchableOpacity
            style={styles.actionBtnEdit}
            onPress={() => onOpenEdit(account)}
          >
            <Ionicons name="create-outline" size={14} color={tokens.colors.primary} />
            <Text style={styles.actionBtnEditText}>Edit Details</Text>
          </TouchableOpacity>

          {account.qrImageUrl ? (
            <TouchableOpacity
              style={styles.actionBtnQr}
              onPress={() => onOpenQrPreview(account)}
            >
              <Ionicons name="qr-code-outline" size={14} color="#0284C7" />
              <Text style={styles.actionBtnQrText}>View QR Code</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.actionBtnDelete}
            onPress={() => onDelete(account.id, account.bankName)}
          >
            <Ionicons name="trash-outline" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
})
