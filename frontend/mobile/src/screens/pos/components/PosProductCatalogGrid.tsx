import React from 'react'
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PosScreen.styles'
import { ProductCard } from '../../../components/ProductCard'
import { ServerErrorState } from '../../../components/ServerErrorState'
import type { Product } from '../../../types'

export interface PosProductCatalogGridProps {
  products: Product[]
  isLoadingProducts: boolean
  productsError: string | null
  headerHeight: number
  refreshing?: boolean
  onRefresh?: () => void
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRetry: () => void
  onSelectProduct: (prod: Product) => void
}

export const PosProductCatalogGrid: React.FC<PosProductCatalogGridProps> = ({
  products,
  isLoadingProducts,
  productsError,
  headerHeight,
  refreshing = false,
  onRefresh,
  onScroll,
  onRetry,
  onSelectProduct,
}) => {
  return (
    <View style={styles.gridContainer}>
      {isLoadingProducts && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
          <Text style={styles.loadingText}>Loading catalog items...</Text>
        </View>
      ) : productsError && products.length === 0 ? (
        <ServerErrorState
          message={productsError}
          onRetry={onRetry}
          isRetrying={isLoadingProducts}
        />
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={48} color={tokens.colors.secondaryFixedDim} />
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptySub}>Try searching for another keyword or category.</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.gridContent,
            { paddingTop: headerHeight > 0 ? headerHeight + 8 : 120 },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                progressViewOffset={headerHeight > 0 ? headerHeight : 60}
                colors={[tokens.colors.primaryContainer]}
                tintColor={tokens.colors.primaryContainer}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => onSelectProduct(item)} />
          )}
        />
      )}
    </View>
  )
}
