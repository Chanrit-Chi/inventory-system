import React from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { AuditLogEntry } from '../../../api/endpoints'
import { styles } from '../AdminUsersScreen.styles'
import { AuditLogRowItem } from './AuditLogRowItem'

export type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'
export type AuditCategory = 'ALL' | 'SECURITY' | 'INVENTORY' | 'ORDERS' | 'BILLING' | 'STAFF'

export interface AuditCounts {
  all: number
  security: number
  inventory: number
  orders: number
  billing: number
  staff: number
}

export interface AuditLogTabProps {
  filteredAuditLogs: AuditLogEntry[]
  auditSearchQuery: string
  setAuditSearchQuery: (q: string) => void
  auditDateRange: DateRangeMode
  setAuditDateRange: (r: DateRangeMode) => void
  auditCategoryFilter: AuditCategory
  setAuditCategoryFilter: (c: AuditCategory) => void
  auditCounts: AuditCounts
  auditLoading: boolean
  auditLoadingMore: boolean
  auditRefreshing: boolean
  auditHasMore: boolean
  auditPage: number
  onAuditRefresh: () => void
  onLoadMore: () => void
  onOpenCustomModal: () => void
  getDateLabel: () => string
}

export const AuditLogTab: React.FC<AuditLogTabProps> = ({
  filteredAuditLogs,
  auditSearchQuery,
  setAuditSearchQuery,
  auditDateRange,
  setAuditDateRange,
  auditCategoryFilter,
  setAuditCategoryFilter,
  auditCounts,
  auditLoading,
  auditLoadingMore,
  auditRefreshing,
  auditHasMore,
  auditPage,
  onAuditRefresh,
  onLoadMore,
  onOpenCustomModal,
  getDateLabel,
}) => {
  return (
    <FlatList
      style={styles.scrollArea}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      data={filteredAuditLogs}
      keyExtractor={(item, idx) => item.id || `audit-item-${idx}`}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      refreshControl={
        <RefreshControl
          refreshing={auditRefreshing}
          onRefresh={onAuditRefresh}
          tintColor={tokens.colors.primaryContainer}
          colors={[tokens.colors.primaryContainer]}
        />
      }
      onEndReached={() => {
        if (!auditLoading && !auditLoadingMore && auditHasMore) {
          onLoadMore()
        }
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <>
          {/* Search Toolbar */}
          <View style={styles.auditSearchBox}>
            <Ionicons
              name="search"
              size={16}
              color={tokens.colors.secondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.auditSearchInput}
              placeholder="Search actions, targets, staff..."
              placeholderTextColor={tokens.colors.secondaryFixedDim}
              value={auditSearchQuery}
              onChangeText={setAuditSearchQuery}
              returnKeyType="search"
            />
            {auditSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setAuditSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Date Filter Quick Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateBarRow}
            contentContainerStyle={styles.dateBarContent}
          >
            <TouchableOpacity
              style={[styles.dateBtn, auditDateRange === 'all' && styles.dateBtnActive]}
              onPress={() => setAuditDateRange('all')}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateBtnText, auditDateRange === 'all' && styles.dateBtnTextActive]}>
                All Time
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, auditDateRange === 'today' && styles.dateBtnActive]}
              onPress={() => setAuditDateRange('today')}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateBtnText, auditDateRange === 'today' && styles.dateBtnTextActive]}>
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, auditDateRange === '7d' && styles.dateBtnActive]}
              onPress={() => setAuditDateRange('7d')}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateBtnText, auditDateRange === '7d' && styles.dateBtnTextActive]}>
                7 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, auditDateRange === '30d' && styles.dateBtnActive]}
              onPress={() => setAuditDateRange('30d')}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateBtnText, auditDateRange === '30d' && styles.dateBtnTextActive]}>
                30 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, auditDateRange === 'year' && styles.dateBtnActive]}
              onPress={() => setAuditDateRange('year')}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateBtnText, auditDateRange === 'year' && styles.dateBtnTextActive]}>
                Year
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateBtn,
                (auditDateRange === 'single' || auditDateRange === 'custom') && styles.dateBtnActive,
                { flexDirection: 'row', gap: 4 },
              ]}
              onPress={onOpenCustomModal}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={
                  auditDateRange === 'single' || auditDateRange === 'custom'
                    ? tokens.colors.onPrimary
                    : tokens.colors.secondary
                }
              />
              <Text
                style={[
                  styles.dateBtnText,
                  (auditDateRange === 'single' || auditDateRange === 'custom') && styles.dateBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {auditDateRange === 'single' || auditDateRange === 'custom' ? getDateLabel() : 'Custom'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Category Filter Chips Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statusChipsRow}
            contentContainerStyle={styles.statusChipsContent}
          >
            {[
              { id: 'ALL' as const, label: 'All Events', count: auditCounts.all },
              { id: 'SECURITY' as const, label: 'Security & Logins', count: auditCounts.security },
              { id: 'INVENTORY' as const, label: 'Stock & Receiving', count: auditCounts.inventory },
              { id: 'ORDERS' as const, label: 'Sales & Orders', count: auditCounts.orders },
              { id: 'BILLING' as const, label: 'Billing & Invoices', count: auditCounts.billing },
              { id: 'STAFF' as const, label: 'Staff & Roles', count: auditCounts.staff },
            ].map((st) => {
              const isSelected = auditCategoryFilter === st.id
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.statusFilterChip, isSelected && styles.statusFilterChipActive]}
                  onPress={() => setAuditCategoryFilter(st.id)}
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

          {/* Active Date Context Banner */}
          {auditDateRange !== 'all' && (
            <View style={styles.activeFilterBanner}>
              <Ionicons name="time-outline" size={13} color={tokens.colors.primaryContainer} />
              <Text style={styles.activeFilterBannerText}>
                Period: <Text style={styles.activeFilterHighlight}>{getDateLabel()}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setAuditDateRange('all')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Summary Metrics Banner */}
          <View style={styles.summaryBanner}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>TOTAL EVENTS</Text>
              <Text style={styles.summaryValue}>{auditCounts.all}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>SECURITY LOGINS</Text>
              <Text style={[styles.summaryValue, { color: tokens.colors.primaryContainer }]}>
                {auditCounts.security}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>STOCK MOVES</Text>
              <Text style={[styles.summaryValue, { color: '#EA580C' }]}>
                {auditCounts.inventory}
              </Text>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.listSectionHeader}>
            <Text style={styles.listSectionTitle}>
              Security & Audit Logs ({filteredAuditLogs.length})
            </Text>
            <Text style={styles.listSectionSub}>Scroll down for older history</Text>
          </View>
        </>
      }
      renderItem={({ item: log }) => <AuditLogRowItem log={log} />}
      ListEmptyComponent={
        auditLoading && !auditRefreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={styles.centerLoadingText}>Loading audit events...</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              name="shield-outline"
              size={44}
              color={tokens.colors.secondaryFixedDim}
            />
            <Text style={styles.emptyTitle}>No audit records found</Text>
            <Text style={styles.emptySub}>
              {auditSearchQuery
                ? 'No events match your search. Try different keywords.'
                : auditDateRange !== 'all'
                ? `No events logged for the period (${getDateLabel()}).`
                : 'No security or audit events found in this category.'}
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        auditLoadingMore ? (
          <View style={styles.loadingMoreRow}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={styles.loadingMoreText}>Loading more audit logs...</Text>
          </View>
        ) : null
      }
    />
  )
}
