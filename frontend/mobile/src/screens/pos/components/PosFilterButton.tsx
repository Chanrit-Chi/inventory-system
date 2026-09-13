import React from 'react'
import { TouchableOpacity, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PosScreen.styles'

export interface PosFilterButtonProps {
  activeFiltersCount: number
  onPress?: () => void
  testID?: string
}

export const PosFilterButton: React.FC<PosFilterButtonProps> = React.memo(({
  activeFiltersCount,
  onPress,
  testID = 'btn-pos-filter',
}) => {
  const isActive = activeFiltersCount > 0

  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.filterTriggerBtn, isActive && styles.filterTriggerBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Open filter and sort menu"
    >
      <Ionicons
        name="filter"
        size={16}
        color={isActive ? tokens.colors.primaryContainer : tokens.colors.secondary}
      />
      <Text style={[styles.filterTriggerText, isActive && styles.filterTriggerTextActive]}>
        Filter
      </Text>
      {isActive && (
        <View style={styles.filterBadgeCount}>
          <Text style={styles.filterBadgeCountText}>{activeFiltersCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
})
