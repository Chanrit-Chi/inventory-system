import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SalesChannelsScreen.styles'

export interface ChannelFilterToolbarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  filterType: string
  setFilterType: (t: string) => void
  onOpenAddModal: () => void
}

const FILTER_TYPES = [
  { key: 'ALL', label: 'All Channels' },
  { key: 'pos', label: 'Store POS' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'shopee', label: 'Shopee' },
  { key: 'lazada', label: 'Lazada' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Wholesale' },
]

export const ChannelFilterToolbar: React.FC<ChannelFilterToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  onOpenAddModal,
}) => {
  return (
    <>
      {/* Compact Toolbar */}
      <View style={styles.compactToolbar}>
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search"
            size={16}
            color={tokens.colors.secondary}
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels..."
            placeholderTextColor={tokens.colors.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          testID="btn-add-sales-channel"
          style={styles.addIconBtn}
          onPress={onOpenAddModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={tokens.colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {FILTER_TYPES.map((item) => {
          const isSelected = filterType === item.key
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setFilterType(item.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </>
  )
}
