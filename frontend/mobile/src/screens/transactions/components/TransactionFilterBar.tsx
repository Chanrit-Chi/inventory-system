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
import type { FilterStatus, DateRangeMode } from '../transactionUtils'

export interface TransactionFilterBarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  dateRange: DateRangeMode
  setDateRange: (r: DateRangeMode) => void
  statusFilter: FilterStatus
  setStatusFilter: (s: FilterStatus) => void
  dateLabel: string
  counts: { all: number; completed: number; pending: number; cancelled: number }
  headerTranslateY: Animated.AnimatedInterpolation<string | number>
  headerOpacity: Animated.AnimatedInterpolation<string | number>
  onLayoutHeader: (e: LayoutChangeEvent) => void
  onOpenCustomModal: () => void
}

export const TransactionFilterBar: React.FC<TransactionFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  dateRange,
  setDateRange,
  statusFilter,
  setStatusFilter,
  dateLabel,
  counts,
  headerTranslateY,
  headerOpacity,
  onLayoutHeader,
  onOpenCustomModal,
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
      {/* Top Search Toolbar */}
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
            placeholder="Search order #, customer, phone, SKU..."
            placeholderTextColor={tokens.colors.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Date Range Bar */}
      <View style={styles.dateBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateBarContent}
        >
          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'all' && styles.dateBtnActive]}
            onPress={() => setDateRange('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === 'all' && styles.dateBtnTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'today' && styles.dateBtnActive]}
            onPress={() => setDateRange('today')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === 'today' && styles.dateBtnTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '7d' && styles.dateBtnActive]}
            onPress={() => setDateRange('7d')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === '7d' && styles.dateBtnTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '30d' && styles.dateBtnActive]}
            onPress={() => setDateRange('30d')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === '30d' && styles.dateBtnTextActive,
              ]}
            >
              30 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'year' && styles.dateBtnActive]}
            onPress={() => setDateRange('year')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === 'year' && styles.dateBtnTextActive,
              ]}
            >
              Year
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dateBtn,
              (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnActive,
              { flexDirection: 'row', gap: 4 },
            ]}
            onPress={onOpenCustomModal}
            activeOpacity={0.75}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={
                dateRange === 'single' || dateRange === 'custom'
                  ? tokens.colors.onPrimary
                  : tokens.colors.secondary
              }
            />
            <Text
              style={[
                styles.dateBtnText,
                (dateRange === 'single' || dateRange === 'custom') &&
                  styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              {dateRange === 'single' || dateRange === 'custom' ? dateLabel : 'Custom'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Status Filter Chips Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusChipsRow}
        contentContainerStyle={styles.statusChipsContent}
      >
        {[
          { id: 'ALL' as const, label: 'All Statuses', count: counts.all },
          { id: 'COMPLETED' as const, label: 'Paid', count: counts.completed },
          { id: 'PENDING' as const, label: 'Pending', count: counts.pending },
          { id: 'CANCELLED' as const, label: 'Cancelled', count: counts.cancelled },
        ].map((st) => {
          const isSelected = statusFilter === st.id
          return (
            <TouchableOpacity
              key={st.id}
              style={[styles.statusFilterChip, isSelected && styles.statusFilterChipActive]}
              onPress={() => setStatusFilter(st.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.statusFilterChipText,
                  isSelected && styles.statusFilterChipTextActive,
                ]}
              >
                {st.label}
              </Text>
              <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                <Text
                  style={[
                    styles.countBadgeText,
                    isSelected && styles.countBadgeTextActive,
                  ]}
                >
                  {st.count}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </Animated.View>
  )
}
