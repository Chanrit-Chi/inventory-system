import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../TransactionsScreen.styles'
import type {
  FilterStatus,
  DateRangeMode,
  TransactionSortOption,
  PaymentMethodFilter,
} from '../transactionUtils'

export interface TransactionFilterBarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  activeFiltersCount: number
  onOpenFilterModal: () => void
  headerTranslateY: Animated.AnimatedInterpolation<string | number>
  headerOpacity: Animated.AnimatedInterpolation<string | number>
  onLayoutHeader: (e: LayoutChangeEvent) => void
  // Active Filter Removers
  sortBy?: TransactionSortOption
  onResetSort?: () => void
  dateRange?: DateRangeMode
  dateLabel?: string
  onResetDate?: () => void
  statusFilter?: FilterStatus
  onResetStatus?: () => void
  channelFilter?: string
  onResetChannel?: () => void
  paymentMethodFilter?: PaymentMethodFilter
  onResetPaymentMethod?: () => void
}

export const TransactionFilterBar: React.FC<TransactionFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  activeFiltersCount,
  onOpenFilterModal,
  headerTranslateY,
  headerOpacity,
  onLayoutHeader,
  sortBy = 'DEFAULT',
  onResetSort,
  dateRange = 'all',
  dateLabel,
  onResetDate,
  statusFilter = 'ALL',
  onResetStatus,
  channelFilter = 'ALL',
  onResetChannel,
  paymentMethodFilter = 'ALL',
  onResetPaymentMethod,
}) => {
  const getSortLabel = (key: TransactionSortOption) => {
    switch (key) {
      case 'OLDEST':
        return 'Oldest'
      case 'AMOUNT_DESC':
        return 'Amount: High → Low'
      case 'AMOUNT_ASC':
        return 'Amount: Low → High'
      case 'ORDER_NUM_ASC':
        return 'Order #: A → Z'
      default:
        return 'Newest'
    }
  }

  const getStatusLabel = (key: FilterStatus) => {
    switch (key) {
      case 'COMPLETED':
        return 'Paid'
      case 'PENDING':
        return 'Pending'
      case 'CANCELLED':
        return 'Cancelled'
      default:
        return 'All Statuses'
    }
  }

  const getPaymentLabel = (key: PaymentMethodFilter) => {
    switch (key) {
      case 'CASH':
        return 'Cash'
      case 'ABA':
        return 'ABA QR'
      case 'CARD':
        return 'Card'
      case 'BANK':
        return 'Bank Transfer'
      default:
        return 'All Payments'
    }
  }

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
      {/* Streamlined Search & Filter Row */}
      <View style={styles.topToolbar}>
        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={16}
            color={tokens.colors.secondary}
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order #, customer, SKU..."
            placeholderTextColor={tokens.colors.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter & Sort Trigger Button */}
        <TouchableOpacity
          style={[
            styles.filterTriggerBtn,
            activeFiltersCount > 0 && styles.filterTriggerBtnActive,
          ]}
          onPress={onOpenFilterModal}
          activeOpacity={0.75}
          accessibilityLabel="Open filter and sort menu"
        >
          <Ionicons
            name="filter"
            size={15}
            color={
              activeFiltersCount > 0
                ? tokens.colors.primaryContainer
                : tokens.colors.secondary
            }
          />
          <Text
            style={[
              styles.filterTriggerText,
              activeFiltersCount > 0 && styles.filterTriggerTextActive,
            ]}
          >
            Filter
          </Text>
          {Boolean(activeFiltersCount > 0) && (
            <View style={styles.filterBadgeCount}>
              <Text style={styles.filterBadgeCountText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips Scroll (Visible when filters are active) */}
      {activeFiltersCount > 0 && (
        <View style={styles.activeChipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsContent}
          >
            {sortBy !== 'DEFAULT' && (
              <View style={styles.filterChip}>
                <Ionicons name="swap-vertical" size={12} color={tokens.colors.primaryContainer} />
                <Text style={styles.filterChipText}>{getSortLabel(sortBy)}</Text>
                {Boolean(onResetSort) && (
                  <TouchableOpacity onPress={onResetSort} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={13} color={tokens.colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {dateRange !== 'all' && (
              <View style={styles.filterChip}>
                <Ionicons name="calendar-outline" size={12} color={tokens.colors.primaryContainer} />
                <Text style={styles.filterChipText}>{dateLabel || dateRange}</Text>
                {Boolean(onResetDate) && (
                  <TouchableOpacity onPress={onResetDate} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={13} color={tokens.colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {statusFilter !== 'ALL' && (
              <View style={styles.filterChip}>
                <Ionicons name="radio-button-on" size={12} color={tokens.colors.primaryContainer} />
                <Text style={styles.filterChipText}>{getStatusLabel(statusFilter)}</Text>
                {Boolean(onResetStatus) && (
                  <TouchableOpacity onPress={onResetStatus} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={13} color={tokens.colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {channelFilter !== 'ALL' && (
              <View style={styles.filterChip}>
                <Ionicons name="storefront-outline" size={12} color={tokens.colors.primaryContainer} />
                <Text style={styles.filterChipText}>{channelFilter}</Text>
                {Boolean(onResetChannel) && (
                  <TouchableOpacity onPress={onResetChannel} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={13} color={tokens.colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {paymentMethodFilter !== 'ALL' && (
              <View style={styles.filterChip}>
                <Ionicons name="wallet-outline" size={12} color={tokens.colors.primaryContainer} />
                <Text style={styles.filterChipText}>{getPaymentLabel(paymentMethodFilter)}</Text>
                {Boolean(onResetPaymentMethod) && (
                  <TouchableOpacity onPress={onResetPaymentMethod} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={13} color={tokens.colors.primaryContainer} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Animated.View>
  )
}
