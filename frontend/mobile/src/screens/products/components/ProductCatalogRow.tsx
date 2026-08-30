import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import type { Product, ScannedAttributeValue } from '../../../types'

interface ProductCatalogRowProps {
  product: Product
  onPress: (prod: Product) => void
  onQuickScanBarcode?: (prod: Product) => void
}

export const ProductCatalogRow = React.memo(({ product, onPress, onQuickScanBarcode }: ProductCatalogRowProps) => {
  const isVariable =
    (product.variants && product.variants.length > 1) ||
    (product.variants?.[0]?.attribute_values && product.variants[0].attribute_values.length > 0)
  const totalStock =
    product.variants?.reduce((sum, v) => sum + v.quantity_on_hand, 0) || 0
  const isLowStock = totalStock <= (product.default_reorder_level || 10)

  // Extract attribute names
  const attrNames = Array.from(
    new Set(
      product.variants?.flatMap(
        (v) => v.attribute_values?.map((av) => av.attribute?.name || '').filter(Boolean) || []
      ) || []
    )
  )

  const totalVariants = product.variants?.length || 0
  const missingVarBarcodes = isVariable
    ? product.variants?.filter((v) => !v.barcode).length || 0
    : 0
  const simpleBarcode = product.barcode || (!isVariable ? product.variants?.[0]?.barcode : null)
  const hasSimpleBarcode = !isVariable && !!simpleBarcode

  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => onPress(product)}
      activeOpacity={0.8}
    >
      <View style={styles.productCardTop}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.prodThumbnail}
            contentFit="cover"
            recyclingKey={product.id}
            transition={150}
          />
        ) : (
          <View style={[styles.prodIconBox, !isVariable && { backgroundColor: '#E0F2FE' }]}>
            <Ionicons
              name={isVariable ? 'shirt-outline' : 'hardware-chip-outline'}
              size={22}
              color={isVariable ? tokens.colors.primaryContainer : '#0284C7'}
            />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.prodName} numberOfLines={1}>{product.name || 'Product'}</Text>
          <Text style={[styles.prodMeta, { marginTop: 3 }]}>
            {product.category?.name || 'General'}
          </Text>
        </View>
        <View style={[styles.stockBadge, isLowStock ? styles.stockBadgeLow : styles.stockBadgeOk]}>
          <Text style={[styles.stockBadgeText, isLowStock ? styles.stockTextLow : styles.stockTextOk]}>
            {totalStock} in stock
          </Text>
        </View>
      </View>

      {/* Attribute & Variant Summary Pills */}
      {isVariable ? (
        <View style={styles.variantSummaryBox}>
          <View style={styles.varBadge}>
            <Ionicons name="git-branch-outline" size={12} color="#B45309" />
            <Text style={styles.varBadgeText}>{totalVariants} Variants</Text>
          </View>
          {attrNames.map((an) => (
            <View key={an} style={styles.attrPill}>
              <Text style={styles.attrPillText}>{an}</Text>
            </View>
          ))}

          {/* Missing Barcode CTA Button (Only shown when barcodes are missing) */}
          {Boolean(missingVarBarcodes > 0) && (
            <TouchableOpacity
              style={styles.quickScanCtaBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                onQuickScanBarcode?.(product)
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="barcode-outline" size={12} color="#D97706" />
              <Text style={styles.quickScanCtaText}>
                {missingVarBarcodes === totalVariants ? 'Scan Barcode' : `Scan (${missingVarBarcodes} left)`}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />
          <Text style={styles.sellPrice}>${Number(product.selling_price).toFixed(2)}</Text>
        </View>
      ) : (
        <View style={styles.variantSummaryBox}>
          <View style={[styles.varBadge, { backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="cube-outline" size={12} color="#64748B" />
            <Text style={[styles.varBadgeText, { color: '#64748B' }]}>Simple</Text>
          </View>

          {/* Missing Barcode CTA Button (Only shown when barcode is missing) */}
          {Boolean(!hasSimpleBarcode) && (
            <TouchableOpacity
              style={styles.quickScanCtaBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                onQuickScanBarcode?.(product)
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="barcode-outline" size={12} color="#D97706" />
              <Text style={styles.quickScanCtaText}>Scan Barcode</Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />
          <Text style={styles.sellPrice}>${Number(product.selling_price).toFixed(2)}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
})
