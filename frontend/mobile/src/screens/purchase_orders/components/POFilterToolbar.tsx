import React from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PurchaseOrdersScreen.styles'
import type { TabType } from '../../../types'

export interface POFilterToolbarProps {
  search: string
  setSearch: (s: string) => void
  statusFilter: 'ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  setStatusFilter: (f: 'ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED') => void
  canCreatePO: boolean
  onNavigate: (tab: TabType) => void
  onOpenNewPO: () => void
}

const FILTER_TABS: ('ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED')[] = [
  'ALL',
  'ORDERED',
  'RECEIVED',
  'CANCELLED',
]

export const POFilterToolbar: React.FC<POFilterToolbarProps> = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  canCreatePO,
  onNavigate,
  onOpenNewPO,
}) => {
  return (
    <>
      {/* Top Action Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBox}>
            <Ionicons name="cart" size={20} color={tokens.colors.primaryContainer} />
          </View>
          <View>
            <Text style={styles.screenTitle}>Purchase Orders</Text>
            <Text style={styles.screenSubtitle}>Procurement & Stock In</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.catalogLinkBtn}
            onPress={() => onNavigate('products')}
          >
            <Ionicons name="cube-outline" size={14} color={tokens.colors.primaryContainer} />
            <Text style={styles.catalogLinkText}>Products</Text>
          </TouchableOpacity>

          {Boolean(canCreatePO) && (
            <TouchableOpacity
              style={styles.newPoBtn}
              onPress={onOpenNewPO}
            >
              <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
              <Text style={styles.newPoBtnText}>New PO</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={tokens.colors.secondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search PO #, supplier, SKU or product..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={tokens.colors.secondary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map((f) => {
          const active = statusFilter === f
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </>
  )
}
