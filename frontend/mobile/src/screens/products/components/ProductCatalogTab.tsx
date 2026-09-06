import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Animated,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { usePermissions } from '../../../hooks/usePermissions'
import { ProductCatalogRow } from './ProductCatalogRow'
import { ProductGridCard } from './ProductGridCard'
import { ProductFilterModal } from './ProductFilterModal'
import { ServerErrorState } from '../../../components/ServerErrorState'
import type { Product } from '../../../types'

interface ProductCatalogTabProps {
  filteredProducts: Product[]
  filterCategoryOptions: string[]
  categoryFilter: string
  setCategoryFilter: (v: string) => void
  statusFilter: 'ALL' | 'ACTIVE' | 'DEACTIVATED'
  setStatusFilter: (v: 'ALL' | 'ACTIVE' | 'DEACTIVATED') => void
  stockFilter: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  setStockFilter: (v: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK') => void
  sortBy: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'STOCK_ASC' | 'STOCK_DESC'
  setSortBy: (v: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'STOCK_ASC' | 'STOCK_DESC') => void
  viewMode: 'grid' | 'list'
  setViewMode: (v: 'grid' | 'list') => void
  activeFiltersCount: number
  resetFilters: () => void
  missingBarcodeCount: number
  search: string
  setSearch: (v: string) => void
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
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
  stockFilter,
  setStockFilter,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  activeFiltersCount,
  resetFilters,
  missingBarcodeCount,
  search,
  setSearch,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
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
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      {/* Animated Collapsible Toolbar (Search + Filter Button + View Mode Toggle + Add) */}
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
              {search.length > 0 ? (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Trigger Button */}
            <TouchableOpacity
              style={[styles.filterTriggerBtn, activeFiltersCount > 0 && styles.filterTriggerBtnActive]}
              onPress={() => setFilterModalOpen(true)}
              activeOpacity={0.75}
              accessibilityLabel="Open filter and sort menu"
            >
              <Ionicons
                name="filter"
                size={15}
                color={activeFiltersCount > 0 ? tokens.colors.primaryContainer : tokens.colors.secondary}
              />
              <Text style={[styles.filterTriggerText, activeFiltersCount > 0 && styles.filterTriggerTextActive]}>
                Filter
              </Text>
              {activeFiltersCount > 0 ? (
                <View style={styles.filterBadgeCount}>
                  <Text style={styles.filterBadgeCountText}>{activeFiltersCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* View Mode Toggle (2-column Grid vs List) */}
            <TouchableOpacity
              style={styles.viewModeBtn}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              activeOpacity={0.75}
              accessibilityLabel={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              <Ionicons
                name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
                size={18}
                color={tokens.colors.onBackground}
              />
            </TouchableOpacity>

            {/* Add Product Button */}
            {can('products:create') ? (
              <TouchableOpacity
                style={styles.addProdBtn}
                onPress={handleOpenCreateProduct}
                activeOpacity={0.8}
                accessibilityLabel="Create product"
              >
                <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Product Items: 2-Column Grid or List */}
      <Animated.FlatList
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridColumnWrapper : undefined}
        style={styles.list}
        contentContainerStyle={{ paddingTop: headerHeight + 6, paddingBottom: 60 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={filteredProducts}
        extraData={filteredProducts}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={headerHeight}
            tintColor={tokens.colors.primaryContainer}
            colors={[tokens.colors.primaryContainer]}
          />
        }
        renderItem={({ item }) =>
          viewMode === 'grid' ? (
            <ProductGridCard
              product={item}
              onPress={handleOpenProductDetail}
              onQuickScanBarcode={handleQuickScanFromCard}
            />
          ) : (
            <ProductCatalogRow
              product={item}
              onPress={handleOpenProductDetail}
              onQuickScanBarcode={handleQuickScanFromCard}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
              <Text style={styles.footerLoaderText}>Loading more products...</Text>
            </View>
          ) : !hasMore && filteredProducts.length > 0 ? (
            <View style={styles.footerLoader}>
              <Ionicons name="checkmark-circle-outline" size={14} color={tokens.colors.secondary} />
              <Text style={styles.footerLoaderText}>All products loaded</Text>
            </View>
          ) : null
        }
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

      {/* Filter & Sort Bottom Sheet Modal */}
      <ProductFilterModal
        visible={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filterCategoryOptions={filterCategoryOptions}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        missingBarcodeCount={missingBarcodeCount}
        onResetAll={resetFilters}
        activeFiltersCount={activeFiltersCount}
      />
    </View>
  )
}
