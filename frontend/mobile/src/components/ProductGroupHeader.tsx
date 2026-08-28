import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'

export interface ProductGroupHeaderProps {
  parentName: string
  variantCount: number
  totalQty: number
  totalCost?: number       // optional • hidden when undefined (e.g. Stock Adjustment)
  onRemoveAll?: () => void // optional • hidden when undefined (read-only views)
}

export const ProductGroupHeader: React.FC<ProductGroupHeaderProps> = ({
  parentName,
  variantCount,
  totalQty,
  totalCost,
  onRemoveAll,
}) => {
  const metaParts: string[] = [
    `${variantCount} variant${variantCount !== 1 ? 's' : ''}`,
    `${totalQty} unit${totalQty !== 1 ? 's' : ''}`,
  ]
  if (totalCost !== undefined) {
    metaParts.push(`$${totalCost.toFixed(2)}`)
  }

  return (
    <View style={styles.groupHeader}>
      <View style={styles.groupHeaderLeft}>
        <Text style={styles.groupParentName} numberOfLines={1}>
          {parentName}
        </Text>
        <Text style={styles.groupMeta}>
          {metaParts.join(' \u2022 ')}
        </Text>
      </View>

      {Boolean(onRemoveAll) && (
        <TouchableOpacity
          style={styles.removeAllBtn}
          onPress={onRemoveAll}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Ionicons name="trash-outline" size={12} color="#DC2626" />
          <Text style={styles.removeAllText}>Remove All</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  groupHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  groupParentName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  groupMeta: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    fontWeight: '600',
    marginTop: 1,
  },
  removeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removeAllText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#DC2626',
  },
})
