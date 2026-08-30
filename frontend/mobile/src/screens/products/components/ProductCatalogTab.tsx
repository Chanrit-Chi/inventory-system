import React from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { usePermissions } from '../../../hooks/usePermissions'
import { ProductCatalogRow } from './ProductCatalogRow'
import { ServerErrorState } from '../../../components/ServerErrorState'
import type { Product } from '../../../types'

interface ProductCatalogTabProps {
  filteredProducts: Product[]
  filterCategoryOptions: string[]
  categoryFilter: string
  setCategoryFilter: (v: string) => void
  statusFilter: 'ALL' | 'ACTIVE' | 'DEACTIVATED'
  setStatusFilter: (v: 'ALL' | 'ACTIVE' | 'DEACTIVATED') => void
  missingBarcodeCount: number
  search: string
  setSearch: (v: string) => void
  loading?: boolean
  refreshing: boolean
  catalogError?: string | null
  onRefresh: () => void
  loadProducts?: () => void
  headerTranslateY: Animated.AnimatedInterpolation<number>
  headerOpacity: Animated.AnimatedInterpolation<number>
  onLayoutHeader: (e: LayoutChangeEvent) => void
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  headerHeight: number
  handleOpenCreateProduct: () => void
  handleOpenProductDetail: (product: Product) => void
  handleQuickScanFromCard: (product: Product) => void
}

export function ProductCatalogTab({
  filteredProducts,
  filterCategoryOptions,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  missingBarcodeCount,
  search,
  setSearch,
  loading = false,
  refreshing,
  catalogError,
  onRefresh,
  loadProducts,
  headerTranslateY,
  headerOpacity,
  onLayoutHeader,
  onScroll,
  headerHeight,
  handleOpenCreateProduct,
  handleOpenProductDetail,
  handleQuickScanFromCard,
}: ProductCatalogTabProps) {
  const { can } = usePermissions()
  return (        <View style={{ flex: 1 }}>
          {/* Animated Collapsible Toolbar (Search + Add + Category chips + Status chips) */}
          <Animated.View
            onLayout={onLayoutHeader}
            style={[
              styles.collapsibleCatalogToolbar,
              {
                transform: [{ translateY: headerTranslateY }],
                opacity: headerOpacity,
              },
            ]}
          >
            {/* Search + Add + Category chips — all in one compact toolbar */}
            <View style={styles.catalogToolbar}>
              <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={tokens.colors.secondary} style={{ marginRight: 5 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search name, SKU, barcode..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={tokens.colors.secondary}
                  />
                </View>
                {can('products:create') ? (
                  <TouchableOpacity style={styles.addProdBtn} onPress={handleOpenCreateProduct}>
                    <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Category Filter Chips inline */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catChipsContainer}
                style={styles.catChipsScroll}
              >
                {filterCategoryOptions.map((c) => {
                  const isActive = categoryFilter === c
                  const isNeedsBarcode = c === 'NEEDS_BARCODE'
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.catChip,
                        isNeedsBarcode && styles.catChipNeedsBarcode,
                        isActive && styles.catChipActive,
                        isActive && isNeedsBarcode && styles.catChipNeedsBarcodeActive,
                      ]}
                      onPress={() => setCategoryFilter(c)}
                      activeOpacity={0.75}
                    >
                      {Boolean(isNeedsBarcode) && (
                        <Ionicons
                          name="barcode-outline"
                          size={12}
                          color={isActive ? '#FFFFFF' : '#D97706'}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.catChipText,
                          isNeedsBarcode && styles.catChipNeedsBarcodeText,
                          isActive && styles.catChipTextActive,
                        ]}
                      >
                        {c === 'ALL'
                          ? 'All'
                          : isNeedsBarcode
                          ? `Needs Barcode (${missingBarcodeCount})`
                          : c}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* Status Filter Chips: All / Active / Deactivated */}
              <View style={styles.statusChipsRow}>
                {([
                  { key: 'ALL', label: 'All Products' },
                  { key: 'ACTIVE', label: 'Active' },
                  { key: 'DEACTIVATED', label: 'Deactivated' },
                ] as const).map(({ key, label }) => {
                  const isActiveChip = statusFilter === key
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.statusChip, isActiveChip && styles.statusChipActive]}
                      onPress={() => setStatusFilter(key)}
                      activeOpacity={0.75}
                    >
                      {Boolean(key === 'DEACTIVATED') && (
                        <Ionicons
                          name="pause-circle-outline"
                          size={12}
                          color={isActiveChip ? '#FFFFFF' : tokens.colors.secondary}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text style={[styles.statusChipText, isActiveChip && styles.statusChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </Animated.View>

          {/* Product Items */}
          <Animated.FlatList
            style={styles.list}
            contentContainerStyle={{ paddingTop: headerHeight + 6, paddingBottom: 60 }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                progressViewOffset={headerHeight}
                tintColor={tokens.colors.primaryContainer}
                colors={[tokens.colors.primaryContainer]}
              />
            }
            renderItem={({ item }) => (
              <ProductCatalogRow
                product={item}
                onPress={handleOpenProductDetail}
                onQuickScanBarcode={handleQuickScanFromCard}
              />
            )}
            ListEmptyComponent={
              loading && !refreshing ? null : catalogError ? (
                <ServerErrorState
                  message={catalogError}
                  onRetry={loadProducts || onRefresh}
                  isRetrying={loading || refreshing}
                />
              ) : (
                <View style={styles.movEmptyContainer}>
                  <Ionicons name="cube-outline" size={48} color={tokens.colors.borderSubtle} />
                  <Text style={styles.movEmptyTitle}>No Products Found</Text>
                  <Text style={styles.movEmptyText}>
                    {search ? `No results matching "${search}"` : 'Your product catalog is empty.'}
                  </Text>
                </View>
              )
            }
          />
        </View>
  )
}
