import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'

export interface FilterChipItem<T extends string = string> {
  key: T
  label: string
  count?: number
  icon?: keyof typeof Ionicons.glyphMap
  badgeColor?: string
}

export interface GenericFilterBarProps<T extends string = string> {
  // Search
  searchQuery: string
  onSearchChange: (q: string) => void
  searchPlaceholder?: string

  // Status / Category Chips
  chips?: FilterChipItem<T>[]
  activeChip?: T
  onSelectChip?: (chipKey: T) => void

  // Collapsible animation props
  headerTranslateY?: Animated.AnimatedInterpolation<string | number>
  headerOpacity?: Animated.AnimatedInterpolation<string | number>
  onLayoutHeader?: (e: LayoutChangeEvent) => void

  // Optional custom right action in search bar (e.g. date picker trigger / scanner)
  rightSearchAction?: React.ReactNode

  // Extra content below chips (e.g. date range summary)
  bottomContent?: React.ReactNode
}

export function GenericFilterBar<T extends string = string>({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  chips = [],
  activeChip,
  onSelectChip,
  headerTranslateY,
  headerOpacity,
  onLayoutHeader,
  rightSearchAction,
  bottomContent,
}: GenericFilterBarProps<T>) {
  const isAnimated = Boolean(headerTranslateY && headerOpacity)

  const ContainerComponent = isAnimated ? Animated.View : View
  const containerStyle = isAnimated
    ? [
        styles.headerContainer,
        {
          transform: [{ translateY: headerTranslateY! }],
          opacity: headerOpacity!,
        },
      ]
    : styles.headerContainer

  return (
    <ContainerComponent onLayout={onLayoutHeader} style={containerStyle}>
      {/* Search Input Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color={tokens.colors.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={tokens.colors.outline}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity
              onPress={() => onSearchChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearSearchBtn}
            >
              <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
        {rightSearchAction}
      </View>

      {/* Filter Chips Horizontal Carousel */}
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {chips.map((chip) => {
            const isActive = activeChip === chip.key
            return (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => onSelectChip?.(chip.key)}
                activeOpacity={0.75}
              >
                {Boolean(chip.icon) && (
                  <Ionicons
                    name={chip.icon!}
                    size={14}
                    color={isActive ? tokens.colors.onPrimary : tokens.colors.onSurfaceVariant}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {chip.label}
                </Text>
                {chip.count !== undefined && (
                  <View
                    style={[
                      styles.chipCountBadge,
                      isActive && styles.chipCountBadgeActive,
                      Boolean(chip.badgeColor) && !isActive && { backgroundColor: `${chip.badgeColor}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipCountText,
                        isActive && styles.chipCountTextActive,
                        Boolean(chip.badgeColor) && !isActive && { color: chip.badgeColor },
                      ]}
                    >
                      {chip.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {bottomContent}
    </ContainerComponent>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: tokens.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceAlt,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  chipsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: tokens.colors.onPrimary,
  },
  chipCountBadge: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  chipCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  chipCountTextActive: {
    color: tokens.colors.onPrimary,
  },
})
