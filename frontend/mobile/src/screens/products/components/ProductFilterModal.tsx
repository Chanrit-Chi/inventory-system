import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'

export interface ProductFilterModalProps {
  visible: boolean
  onClose: () => void
  filterCategoryOptions: string[]
  categoryFilter: string
  setCategoryFilter: (v: string) => void
  statusFilter: 'ALL' | 'ACTIVE' | 'DEACTIVATED'
  setStatusFilter: (v: 'ALL' | 'ACTIVE' | 'DEACTIVATED') => void
  stockFilter: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  setStockFilter: (v: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK') => void
  sortBy: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'STOCK_ASC' | 'STOCK_DESC'
  setSortBy: (v: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'STOCK_ASC' | 'STOCK_DESC') => void
  missingBarcodeCount: number
  onResetAll: () => void
  activeFiltersCount: number
}

const SORT_OPTIONS: Array<{
  key: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'STOCK_ASC' | 'STOCK_DESC'
  label: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  { key: 'DEFAULT', label: 'Default / Newest', icon: 'time-outline' },
  { key: 'NAME_ASC', label: 'Name (A → Z)', icon: 'text-outline' },
  { key: 'NAME_DESC', label: 'Name (Z → A)', icon: 'text-outline' },
  { key: 'STOCK_ASC', label: 'Stock (Low → High)', icon: 'trending-down-outline' },
  { key: 'STOCK_DESC', label: 'Stock (High → Low)', icon: 'trending-up-outline' },
]

const STATUS_OPTIONS: Array<{ key: 'ALL' | 'ACTIVE' | 'DEACTIVATED'; label: string }> = [
  { key: 'ALL', label: 'All Products' },
  { key: 'ACTIVE', label: 'Active Only' },
  { key: 'DEACTIVATED', label: 'Deactivated' },
]

const STOCK_OPTIONS: Array<{ key: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'; label: string }> = [
  { key: 'ALL', label: 'All Stock Levels' },
  { key: 'LOW_STOCK', label: 'Low Stock Alert' },
  { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
]

export const ProductFilterModal: React.FC<ProductFilterModalProps> = ({
  visible,
  onClose,
  filterCategoryOptions,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  stockFilter,
  setStockFilter,
  sortBy,
  setSortBy,
  missingBarcodeCount,
  onResetAll,
  activeFiltersCount,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Ionicons name="options" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.title}>Filter & Sort</Text>
                {Boolean(activeFiltersCount > 0) && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{activeFiltersCount} active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>Filter products by category, status, stock & sort order</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* ── 1. SORT BY ────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SORT ORDER</Text>
              <View style={styles.pillsGrid}>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.key
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setSortBy(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={13}
                        color={isActive ? '#FFFFFF' : tokens.colors.secondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* ── 2. CATEGORY ───────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              <View style={styles.pillsGrid}>
                {filterCategoryOptions.map((c) => {
                  const isActive = categoryFilter === c
                  const isNeedsBarcode = c === 'NEEDS_BARCODE'
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.pill,
                        isNeedsBarcode && styles.pillNeedsBarcode,
                        isActive && styles.pillActive,
                        isActive && isNeedsBarcode && styles.pillNeedsBarcodeActive,
                      ]}
                      onPress={() => setCategoryFilter(c)}
                      activeOpacity={0.75}
                    >
                      {Boolean(isNeedsBarcode) && (
                        <Ionicons
                          name="barcode-outline"
                          size={13}
                          color={isActive ? '#FFFFFF' : '#D97706'}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.pillText,
                          isNeedsBarcode && styles.pillNeedsBarcodeText,
                          isActive && styles.pillTextActive,
                        ]}
                      >
                        {c === 'ALL'
                          ? 'All Categories'
                          : isNeedsBarcode
                          ? `Needs Barcode (${missingBarcodeCount})`
                          : c}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* ── 3. PRODUCT STATUS ─────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STATUS</Text>
              <View style={styles.pillsGrid}>
                {STATUS_OPTIONS.map((st) => {
                  const isActive = statusFilter === st.key
                  return (
                    <TouchableOpacity
                      key={st.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setStatusFilter(st.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* ── 4. STOCK LEVEL ALERT ─────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STOCK LEVEL</Text>
              <View style={styles.pillsGrid}>
                {STOCK_OPTIONS.map((sk) => {
                  const isActive = stockFilter === sk.key
                  return (
                    <TouchableOpacity
                      key={sk.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setStockFilter(sk.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {sk.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </ScrollView>

          {/* ── Modal Footer with Actions ────────────────────────────── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={onResetAll} activeOpacity={0.75}>
              <Ionicons name="refresh-outline" size={14} color={tokens.colors.secondary} />
              <Text style={styles.resetBtnText}>Reset All</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.applyBtnText}>
                Apply Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    ...tokens.shadows.modal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  activeBadge: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  subtitle: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  pillNeedsBarcode: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pillNeedsBarcodeActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  pillNeedsBarcodeText: {
    color: '#B45309',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  applyBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
})
