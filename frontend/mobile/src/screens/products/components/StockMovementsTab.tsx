import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { SearchBar } from '../../../components/SearchBar'
import { CopyableBadge } from '../../../components/CopyableBadge'
import { matchSearch } from '../../../utils/searchHelper'
import type { StockMovementRecord, MovementType } from '../../../types'

interface MovementTypeMeta {
  label: string
  shortLabel: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  bg: string
  borderColor: string
  isPositive: boolean
}

const MOVEMENT_META: Record<string, MovementTypeMeta> = {
  RESTOCK: {
    label: 'Stock Intake / Restock',
    shortLabel: 'Restock',
    icon: 'arrow-down-circle',
    color: '#15803D',
    bg: '#DCFCE7',
    borderColor: '#BBF7D0',
    isPositive: true,
  },
  PURCHASE: {
    label: 'Purchase Order Inward',
    shortLabel: 'PO Inward',
    icon: 'cart-outline',
    color: '#047857',
    bg: '#D1FAE5',
    borderColor: '#A7F3D0',
    isPositive: true,
  },
  INITIAL: {
    label: 'Opening Stock Set',
    shortLabel: 'Opening',
    icon: 'sparkles-outline',
    color: '#0369A1',
    bg: '#E0F2FE',
    borderColor: '#BAE6FD',
    isPositive: true,
  },
  SALE: {
    label: 'Customer POS Sale',
    shortLabel: 'Sale',
    icon: 'receipt-outline',
    color: '#4338CA',
    bg: '#EEF2FF',
    borderColor: '#C7D2FE',
    isPositive: false,
  },
  RETURN: {
    label: 'Customer Return Restock',
    shortLabel: 'Return',
    icon: 'refresh-circle-outline',
    color: '#0F766E',
    bg: '#CCFBF1',
    borderColor: '#99F6E4',
    isPositive: true,
  },
  ADJUSTMENT: {
    label: 'Audit Stock Adjustment',
    shortLabel: 'Audit',
    icon: 'options-outline',
    color: '#6D28D9',
    bg: '#F3E8FF',
    borderColor: '#DDD6FE',
    isPositive: true,
  },
  DAMAGE: {
    label: 'Damaged Goods Write-off',
    shortLabel: 'Damaged',
    icon: 'alert-circle-outline',
    color: '#BE123C',
    bg: '#FFE4E6',
    borderColor: '#FECDD3',
    isPositive: false,
  },
  SHRINKAGE: {
    label: 'Lost / Shrinkage Loss',
    shortLabel: 'Shrinkage',
    icon: 'trending-down-outline',
    color: '#B91C1C',
    bg: '#FEE2E2',
    borderColor: '#FECACA',
    isPositive: false,
  },
  CANCELLATION_REVERSAL: {
    label: 'Cancelled Order Restored',
    shortLabel: 'Reversal',
    icon: 'arrow-undo-outline',
    color: '#0284C7',
    bg: '#E0F2FE',
    borderColor: '#BAE6FD',
    isPositive: true,
  },
}

const DEFAULT_META: MovementTypeMeta = {
  label: 'Inventory Movement',
  shortLabel: 'Movement',
  icon: 'swap-vertical-outline',
  color: tokens.colors.secondary,
  bg: '#F1F5F9',
  borderColor: '#E2E8F0',
  isPositive: true,
}

type FilterCategory = 'ALL' | 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'DAMAGE'

const FILTER_GROUPS: Record<FilterCategory, MovementType[]> = {
  ALL: [],
  RESTOCK: ['RESTOCK', 'PURCHASE', 'INITIAL'],
  SALE: ['SALE', 'CANCELLATION_REVERSAL'],
  ADJUSTMENT: ['ADJUSTMENT'],
  DAMAGE: ['DAMAGE', 'SHRINKAGE', 'RETURN'],
}

const FILTER_LABELS: Record<FilterCategory, string> = {
  ALL: 'All Logs',
  RESTOCK: 'Restocks / In',
  SALE: 'Sales / Out',
  ADJUSTMENT: 'Adjustments',
  DAMAGE: 'Loss & Returns',
}

function formatMovementReference(ref?: string | null): string | null {
  if (!ref) return null
  const trimmed = ref.trim()
  if (!trimmed) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return `#${trimmed.slice(0, 8)}`
  }
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

function formatMovementNotes(notes?: string | null): string | null {
  if (!notes) return null
  const trimmed = notes.trim()
  if (!trimmed) return null
  if (/^Restock session [0-9a-f-]+$/i.test(trimmed)) {
    return 'Batch intake session'
  }
  return trimmed
}

function formatMovementTime(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return isoDate
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (isToday) {
      return `Today \u2022 ${timeStr}`
    }
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
    return `${dateStr} \u2022 ${timeStr}`
  } catch {
    return isoDate
  }
}

interface StockMovementsTabProps {
  movements: StockMovementRecord[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onRefresh: () => void
  onOpenStockAdjustment?: () => void
  onOpenStockIn?: () => void
}

export function StockMovementsTab({
  movements,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRefresh,
  onOpenStockAdjustment,
  onOpenStockIn,
}: StockMovementsTabProps) {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL')
  const [search, setSearch] = useState('')

  // Filter movements by active category and search
  const filteredMovements = useMemo(() => {
    let result = movements

    if (activeCategory !== 'ALL') {
      const allowedTypes = new Set(FILTER_GROUPS[activeCategory])
      result = result.filter((m) => allowedTypes.has(m.movementType))
    }

    if (search.trim()) {
      result = result.filter((m) =>
        matchSearch(search, m.productName, m.sku, m.referenceNumber, m.recordedBy, m.notes)
      )
    }

    return result
  }, [movements, activeCategory, search])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      ALL: movements.length,
      RESTOCK: 0,
      SALE: 0,
      ADJUSTMENT: 0,
      DAMAGE: 0,
    }
    movements.forEach((m) => {
      if (FILTER_GROUPS.RESTOCK.includes(m.movementType)) counts.RESTOCK++
      if (FILTER_GROUPS.SALE.includes(m.movementType)) counts.SALE++
      if (FILTER_GROUPS.ADJUSTMENT.includes(m.movementType)) counts.ADJUSTMENT++
      if (FILTER_GROUPS.DAMAGE.includes(m.movementType)) counts.DAMAGE++
    })
    return counts
  }, [movements])

  return (
    <FlatList
      style={tabStyles.container}
      contentContainerStyle={tabStyles.contentContainer}
      showsVerticalScrollIndicator={false}
      data={filteredMovements}
      keyExtractor={(item, index) => `${item.id || 'mov'}-${index}`}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={Boolean(loading && movements.length === 0)}
          onRefresh={onRefresh}
          tintColor={tokens.colors.primaryContainer}
          colors={[tokens.colors.primaryContainer]}
        />
      }
      ListHeaderComponent={
        <View style={tabStyles.headerSection}>
          {/* Top Quick Actions Bar: Stock In & Stock Adjustment */}
          {(Boolean(onOpenStockIn) || Boolean(onOpenStockAdjustment)) && (
            <View style={tabStyles.quickActionsRow}>
              {Boolean(onOpenStockIn) && (
                <TouchableOpacity
                  style={[tabStyles.quickActionBtn, tabStyles.stockInBtn]}
                  onPress={onOpenStockIn}
                  activeOpacity={0.8}
                  accessibilityLabel="Stock In"
                >
                  <Ionicons name="enter" size={16} color={tokens.colors.onPrimary} />
                  <Text style={tabStyles.quickActionText}>Stock In</Text>
                </TouchableOpacity>
              )}

              {Boolean(onOpenStockAdjustment) && (
                <TouchableOpacity
                  style={[tabStyles.quickActionBtn, tabStyles.adjustmentBtn]}
                  onPress={onOpenStockAdjustment}
                  activeOpacity={0.8}
                  accessibilityLabel="Stock Adjustment"
                >
                  <Ionicons name="options" size={16} color={tokens.colors.onPrimary} />
                  <Text style={tabStyles.quickActionText}>Stock Adjustment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Search Bar */}
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by product, SKU, ref, or staff..."
          />

          {/* Category Filter Chips Bar */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['ALL', 'RESTOCK', 'SALE', 'ADJUSTMENT', 'DAMAGE'] as FilterCategory[]}
            keyExtractor={(cat) => cat}
            contentContainerStyle={tabStyles.categoryRow}
            renderItem={({ item: cat }) => {
              const isActive = activeCategory === cat
              const count = categoryCounts[cat]
              return (
                <TouchableOpacity
                  style={[tabStyles.categoryChip, isActive && tabStyles.categoryChipActive]}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[tabStyles.categoryChipText, isActive && tabStyles.categoryChipTextActive]}>
                    {FILTER_LABELS[cat]}
                  </Text>
                  <View style={[tabStyles.countBadge, isActive && tabStyles.countBadgeActive]}>
                    <Text style={[tabStyles.countBadgeText, isActive && tabStyles.countBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            }}
          />

          {/* Summary Label */}
          <View style={tabStyles.summaryRow}>
            <Text style={tabStyles.summaryText}>
              Showing {filteredMovements.length} of {movements.length} log {movements.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View style={tabStyles.emptyContainer}>
            <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
            <Text style={tabStyles.emptyText}>Loading stock log...</Text>
          </View>
        ) : (
          <View style={tabStyles.emptyContainer}>
            <Ionicons name="swap-vertical-outline" size={48} color={tokens.colors.borderSubtle} />
            <Text style={tabStyles.emptyTitle}>
              {search || activeCategory !== 'ALL' ? 'No matching movements' : 'No stock movements yet'}
            </Text>
            <Text style={tabStyles.emptyText}>
              {search || activeCategory !== 'ALL'
                ? 'Try clearing the search query or switching to another category.'
                : 'Movements will appear here automatically after stock intakes, adjustments, sales, and returns.'}
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={tabStyles.footerLoader}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={tabStyles.footerLoaderText}>Loading more records...</Text>
          </View>
        ) : !hasMore && movements.length > 0 ? (
          <View style={tabStyles.footerLoader}>
            <Ionicons name="checkmark-circle-outline" size={14} color={tokens.colors.secondary} />
            <Text style={tabStyles.footerLoaderText}>All log records loaded</Text>
          </View>
        ) : null
      }
      renderItem={({ item: mov }) => {
        const meta = MOVEMENT_META[mov.movementType] || DEFAULT_META
        const isQtyPositive = mov.quantity > 0
        const isQtyZero = mov.quantity === 0
        const formattedRef = formatMovementReference(mov.referenceNumber)
        const formattedNotes = formatMovementNotes(mov.notes)
        const formattedTime = formatMovementTime(mov.createdAt)

        return (
          <View style={tabStyles.card}>
            {/* Card Top: Type Badge & Header Info */}
            <View style={tabStyles.cardTopRow}>
              <View style={tabStyles.cardTypeGroup}>
                <View style={[tabStyles.iconBox, { backgroundColor: meta.bg, borderColor: meta.borderColor }]}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>
                <View style={tabStyles.typeTextCol}>
                  <Text style={[tabStyles.typeTitle, { color: meta.color }]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                  <Text style={tabStyles.timestampText}>
                    {formattedTime}
                  </Text>
                </View>
              </View>

              {/* Quantity Change Pill */}
              <View
                style={[
                  tabStyles.qtyPill,
                  isQtyPositive ? tabStyles.qtyPillGreen : isQtyZero ? tabStyles.qtyPillMuted : tabStyles.qtyPillRed,
                ]}
              >
                <Ionicons
                  name={isQtyPositive ? 'arrow-up' : isQtyZero ? 'remove' : 'arrow-down'}
                  size={12}
                  color={isQtyPositive ? '#15803D' : isQtyZero ? tokens.colors.secondary : '#BA1A1A'}
                />
                <Text
                  style={[
                    tabStyles.qtyPillText,
                    isQtyPositive ? tabStyles.qtyTextGreen : isQtyZero ? tabStyles.qtyTextMuted : tabStyles.qtyTextRed,
                  ]}
                >
                  {isQtyPositive ? `+${mov.quantity}` : `${mov.quantity}`} units
                </Text>
              </View>
            </View>

            {/* Product Details Row */}
            <View style={tabStyles.productSection}>
              <Text style={tabStyles.productName} numberOfLines={2}>
                {mov.productName}
              </Text>

              <View style={tabStyles.metaRow}>
                {Boolean(mov.sku) && (
                  <CopyableBadge
                    type="sku"
                    value={mov.sku}
                    compact
                  />
                )}

                <View style={tabStyles.balanceBadge}>
                  <Text style={tabStyles.balanceLabel}>Balance after: </Text>
                  <Text style={tabStyles.balanceValue}>{mov.balanceAfter} on hand</Text>
                </View>
              </View>
            </View>

            {/* Card Footer: Staff, Reference & Notes */}
            <View style={tabStyles.cardFooter}>
              <View style={tabStyles.footerMetaRow}>
                <View style={tabStyles.footerMetaItem}>
                  <Ionicons name="person-outline" size={12} color={tokens.colors.secondary} />
                  <Text style={tabStyles.footerMetaText}>
                    {mov.recordedBy ? mov.recordedBy : 'System'}
                  </Text>
                </View>

                {Boolean(formattedRef) && (
                  <View style={tabStyles.footerMetaItem}>
                    <Ionicons name="document-text-outline" size={12} color={tokens.colors.secondary} />
                    <Text style={tabStyles.footerMetaText}>
                      Ref: {formattedRef}
                    </Text>
                  </View>
                )}
              </View>

              {Boolean(formattedNotes) && (
                <View style={tabStyles.notesBox}>
                  <Ionicons name="information-circle-outline" size={13} color={tokens.colors.secondary} />
                  <Text style={tabStyles.notesText}>{formattedNotes}</Text>
                </View>
              )}
            </View>
          </View>
        )
      }}
    />
  )
}

const tabStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  contentContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 24,
  },
  headerSection: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  stockInBtn: {
    backgroundColor: tokens.colors.statusSuccess,
  },
  adjustmentBtn: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  quickActionText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 12.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  categoryRow: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: tokens.borderRadius.pill,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    paddingHorizontal: 2,
    marginTop: -2,
  },
  summaryText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTypeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  typeTextCol: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  timestampText: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 1,
    fontWeight: '500',
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: tokens.borderRadius.pill,
    gap: 3,
  },
  qtyPillGreen: {
    backgroundColor: '#E6F4EA',
  },
  qtyPillRed: {
    backgroundColor: '#FFDAD6',
  },
  qtyPillMuted: {
    backgroundColor: '#F1F5F9',
  },
  qtyPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  qtyTextGreen: {
    color: '#15803D',
  },
  qtyTextRed: {
    color: '#BA1A1A',
  },
  qtyTextMuted: {
    color: tokens.colors.secondary,
  },
  productSection: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
  },
  productName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  skuBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skuBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
  },
  balanceValue: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  cardFooter: {
    marginTop: 8,
    gap: 6,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerMetaText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    fontStyle: 'italic',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: tokens.spacing.lg,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  footerLoaderText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
})

