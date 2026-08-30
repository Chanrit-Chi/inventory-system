import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styles } from '../HomeScreen.styles'

export interface LowStockBannerProps {
  lowStockSkus: number
  canRestock: boolean
  canReadProducts: boolean
  onPress: () => void
}

export const LowStockBanner: React.FC<LowStockBannerProps> = ({
  lowStockSkus,
  canRestock,
  canReadProducts,
  onPress,
}) => {
  if (lowStockSkus <= 0) return null

  return (
    <TouchableOpacity
      style={styles.lowStockBanner}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.lowStockBannerLeft}>
        <View style={styles.lowStockBannerIconCircle}>
          <Ionicons name="warning" size={14} color="#E11D48" />
        </View>
        <Text style={styles.lowStockBannerText}>
          <Text style={{ fontWeight: '800', color: '#9F1239' }}>
            {`${lowStockSkus} ${lowStockSkus === 1 ? 'item is' : 'items are'}`}
          </Text>
          {' low on stock'}
        </Text>
      </View>
      <View style={styles.lowStockBannerBtn}>
        <Text style={styles.lowStockBannerBtnText}>
          {canRestock ? 'Restock' : canReadProducts ? 'View' : 'Details'}
        </Text>
        <Ionicons name="arrow-forward" size={12} color="#E11D48" />
      </View>
    </TouchableOpacity>
  )
}
