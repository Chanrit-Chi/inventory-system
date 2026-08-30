import React from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PosScreen.styles'

export interface PosHeaderToolbarProps {
  searchQuery: string
  setSearchQuery: (s: string) => void
  categories: string[]
  selectedCategory: string
  setSelectedCategory: (c: string) => void
  headerTranslateY: Animated.AnimatedInterpolation<string | number>
  headerOpacity: Animated.AnimatedInterpolation<string | number>
  onLayoutHeader: (e: LayoutChangeEvent) => void
}

export const PosHeaderToolbar: React.FC<PosHeaderToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategory,
  setSelectedCategory,
  headerTranslateY,
  headerOpacity,
  onLayoutHeader,
}) => {
  return (
    <Animated.View
      style={[
        styles.collapsibleHeaderWrap,
        {
          transform: [{ translateY: headerTranslateY }],
          opacity: headerOpacity,
        },
      ]}
      onLayout={onLayoutHeader}
    >
      {/* Sticky Header: Search Bar */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={tokens.colors.secondary} />
          <TextInput
            testID="input-pos-search"
            style={styles.searchInput}
            placeholder="Search product, category, SKU, barcode..."
            placeholderTextColor={tokens.colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {Boolean(searchQuery.length > 0) && (
            <TouchableOpacity
              testID="btn-clear-pos-search"
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
            >
              <Ionicons name="close-circle" size={18} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Categories Filter */}
      {categories.length > 1 && (
        <View style={styles.categoriesWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          >
            {categories.map((cat) => {
              const active = cat === selectedCategory
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}
    </Animated.View>
  )
}
