import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../QuotationsScreen.styles'
import {
  getQuoteNumber,
  getCustomerName,
  getCustomerPhone,
  getTotalAmount,
  getValidUntil,
  getStatusStyle,
} from '../quotationUtils'
import type { Quotation } from '../../../types'

export interface QuotationCardItemProps {
  quote: Quotation
  onSelectQuote: (quote: Quotation) => void
  onConvertQuote?: (quote: Quotation) => void
  canConvert?: boolean
}

export const QuotationCardItem: React.FC<QuotationCardItemProps> = React.memo(({
  quote,
  onSelectQuote,
  onConvertQuote,
  canConvert,
}) => {
  const badgeStyle = getStatusStyle(quote.status)
  const total = getTotalAmount(quote)
  const qNum = getQuoteNumber(quote)
  const cName = getCustomerName(quote)
  const cPhone = getCustomerPhone(quote)
  const vDate = getValidUntil(quote)
  const itemCount = quote.items?.length || 1

  return (
    <TouchableOpacity
      style={styles.quoteCard}
      onPress={() => onSelectQuote(quote)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleCol}>
          <View style={styles.quoteNumRow}>
            <Ionicons
              name="document-text-outline"
              size={13}
              color={tokens.colors.primaryContainer}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.quoteNum} numberOfLines={1} ellipsizeMode="tail">
              {qNum}
            </Text>
          </View>
          <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
            {cName}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.statusText, { color: badgeStyle.text }]}>
            {quote.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBody}>
        <View style={styles.itemSummaryRow}>
          <Text style={styles.itemSummaryText}>{itemCount} item(s)</Text>
          <Text style={styles.validText}>Valid until: {vDate}</Text>
        </View>

        <View style={styles.cardBottomRow}>
          <Text style={styles.phoneText} numberOfLines={1}>
            {cPhone || 'No phone'}
          </Text>
          <Text style={styles.totalPrice}>${total.toFixed(2)}</Text>
        </View>
      </View>

      {Boolean(quote.status === 'ACCEPTED' && canConvert && onConvertQuote) && (
        <TouchableOpacity
          style={styles.convertBar}
          onPress={() => onConvertQuote?.(quote)}
          activeOpacity={0.8}
        >
          <Ionicons name="cart-outline" size={15} color={tokens.colors.onPrimary} />
          <Text style={styles.convertBarText}>Convert to Sale</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
})
