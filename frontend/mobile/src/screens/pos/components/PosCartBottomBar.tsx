import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styles } from '../PosScreen.styles'

export interface PosCartBottomBarProps {
  totalItems: number
  totalPrice: number
  onPress: () => void
}

export const PosCartBottomBar: React.FC<PosCartBottomBarProps> = ({
  totalItems,
  totalPrice,
  onPress,
}) => {
  if (totalItems <= 0) return null

  return (
    <View style={styles.floatingCartBar}>
      <TouchableOpacity
        style={styles.floatingCartInner}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`View Cart with ${totalItems} items, Total: $${totalPrice.toFixed(2)}`}
      >
        <View style={styles.floatingCartLeft}>
          <View style={styles.floatingCountBadge}>
            <Text style={styles.floatingCountText}>{totalItems}</Text>
          </View>
          <View>
            <Text style={styles.floatingTotalLabel}>Subtotal</Text>
            <Text style={styles.floatingTotalValue}>${totalPrice.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.floatingCheckoutCta}>
          <Text style={styles.floatingCheckoutText}>Review & Pay</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  )
}
