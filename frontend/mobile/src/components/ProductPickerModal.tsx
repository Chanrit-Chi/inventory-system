import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { tokens } from '../theme/tokens'
import { getProducts } from '../api/endpoints'
import { SearchBar } from './SearchBar'
import { CopyableBadge } from './CopyableBadge'
import { matchSearch } from '../utils/searchHelper'
import type { Product, ProductVariant, ScannedVariant } from '../types'

export interface SelectedProductItem {
  product: Product
  variant?: ProductVariant | ScannedVariant
  quantity: number
}

export interface ExistingPickerItem {
  variantId?: string
  sku?: string
  productName?: string
  quantity: number
}

export interface ProductPickerModalProps {
  visible: boolean
  title?: string
  subtitle?: string
  priceType?: 'selling' | 'cost'
  allowExceedStock?: boolean
  products?: Product[]
  multiple?: boolean
  existingItems?: ExistingPickerItem[]
  onClose: () => void
  onSelect?: (product: Product, variant?: ProductVariant | ScannedVariant) => void
  onSelectMultiple?: (items: SelectedProductItem[]) => void
  onRefreshCatalog?: () => Promise<void> | void
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  visible,
  title = 'Select Products',
  subtitle = 'Choose from active catalog inventory',
  priceType = 'selling',
  allowExceedStock = false,
  products: initialProducts,
  multiple = true,
  existingItems,
  onClose,
  onSelect,
  onSelectMultiple,
  onRefreshCatalog,
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts || [])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedProductItem>>(new Map())
  const openedRef = useRef(false)
  const selectionSeededRef = useRef(false)

  // Deactivated products/variants must not be selectable anywhere
  const sanitizeCatalog = (list: Product[]): Product[] =>
    list
      .filter((p) => p.is_active !== false)
      .map((p) => ({ ...p, variants: p.variants?.filter((v) => v.is_active !== false) }))

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else if (products.length === 0) {
      setLoading(true)
    }

    try {
      if (onRefreshCatalog) {
        await onRefreshCatalog()
      }
      const res = await getProducts({ page: 1 })
      const list: Product[] = Array.isArray(res) ? res : res?.data || []
      const activeList = sanitizeCatalog(list)
      if (activeList.length > 0) {
        setProducts(activeList)
      } else if (initialProducts && initialProducts.length > 0) {
        setProducts(sanitizeCatalog(initialProducts))
      }
    } catch {
      if (initialProducts && initialProducts.length > 0) {
        setProducts(sanitizeCatalog(initialProducts))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [initialProducts, onRefreshCatalog, products.length])

  // When initialProducts from parent changes, sync it
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(sanitizeCatalog(initialProducts))
    }
  }, [initialProducts])

  // When modal opens: reset transient UI state & fetch latest fresh stock counts.
  // Guarded by openedRef so catalog refreshes mid-session don't wipe in-progress selections.
  useEffect(() => {
    if (visible && !openedRef.current) {
      openedRef.current = true
      setSearch('')
      setExpandedIds(new Set())
      setSelectedMap(new Map())
      selectionSeededRef.current = false
      loadProducts(false)
    }
    if (!visible) {
      openedRef.current = false
    }
  }, [visible, loadProducts])

  // Seed previously added line items into the selection map (once per open,
  // after the catalog is available) so users can see what's already in their form.
  useEffect(() => {
    if (!visible || selectionSeededRef.current || loading) return
    if (!existingItems || existingItems.length === 0 || products.length === 0) return

    const byVariantId = new Map<string, { product: Product; variant?: ProductVariant | ScannedVariant }>()
    const bySku = new Map<string, { product: Product; variant?: ProductVariant | ScannedVariant }>()

    products.forEach((p) => {
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const entry = { product: p, variant: v }
          byVariantId.set(v.id, entry)
          if (v.sku) bySku.set(v.sku, entry)
        })
      } else if (p.sku && !bySku.has(p.sku)) {
        bySku.set(p.sku, { product: p })
      }
    })

    const seeded = new Map<string, SelectedProductItem>()
    existingItems.forEach((it) => {
      const match =
        (it.variantId ? byVariantId.get(it.variantId) : undefined) ||
        (it.sku ? bySku.get(it.sku) : undefined)
      if (match) {
        const key = match.variant?.id || match.product.variants?.[0]?.id || match.product.id
        if (!seeded.has(key)) {
          seeded.set(key, { product: match.product, variant: match.variant, quantity: it.quantity })
        }
      }
    })
    setSelectedMap(seeded)
    selectionSeededRef.current = true
  }, [visible, loading, products, existingItems])

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products

    return products.filter((p) => {
      const variantNames = p.variants?.map((v) => v.name || '') || []
      const variantSkus = p.variants?.map((v) => v.sku || '') || []
      const variantBarcodes = p.variants?.map((v) => v.barcode || '') || []
      const variantAttrValues = p.variants?.flatMap((v) =>
        v.attribute_values?.map((av) => av.value_name || (av as any).value || av.attribute?.name || '') || []
      ) || []

      return matchSearch(
        search,
        p.name,
        p.sku,
        p.barcode,
        p.category?.name,
        p.description,
        variantNames,
        variantSkus,
        variantBarcodes,
        variantAttrValues
      )
    })
  }, [products, search])

  const toggleExpand = useCallback((productId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }, [])

  const handleToggleExpandAll = useCallback(() => {
    const hasAnyVariable = filteredProducts.some((p) => p.variants && p.variants.length > 0)
    if (!hasAnyVariable) return

    const allExpanded = filteredProducts
      .filter((p) => p.variants && p.variants.length > 0)
      .every((p) => expandedIds.has(p.id))

    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      const next = new Set<string>()
      filteredProducts.forEach((p) => {
        if (p.variants && p.variants.length > 0) {
          next.add(p.id)
        }
      })
      setExpandedIds(next)
    }
  }, [filteredProducts, expandedIds])

  const getPrice = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    if (priceType === 'cost') {
      const cost = (v as ProductVariant)?.cost_price_override || prod.purchase_price || '0'
      return parseFloat(String(cost)) || 0
    }
    const sell = v?.selling_price_override || (v as any)?.selling_price || prod.selling_price || '0'
    return parseFloat(String(sell)) || 0
  }

  const getItemKey = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    return v?.id || prod.variants?.[0]?.id || prod.id
  }

  const updateItemQuantity = (prod: Product, v: ProductVariant | ScannedVariant | undefined, delta: number) => {
    const key = getItemKey(prod, v)
    const stock = v
      ? (v.quantity_on_hand ?? 0)
      : (prod.variants && prod.variants.length > 0
          ? prod.variants.reduce((sum, item) => sum + (item.quantity_on_hand ?? 0), 0)
          : ((prod as any).quantity_on_hand ?? 0))
    const shouldLimitStock = priceType === 'selling' && !allowExceedStock

    setSelectedMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(key)
      const currentQty = existing ? existing.quantity : 0

      if (delta > 0 && shouldLimitStock) {
        if (stock <= 0 || currentQty >= stock) {
          return prev
        }
      }

      const newQty = currentQty + delta

      if (newQty <= 0) {
        next.delete(key)
      } else {
        const boundedQty = shouldLimitStock && stock > 0 ? Math.min(newQty, stock) : newQty
        next.set(key, { product: prod, variant: v, quantity: boundedQty })
      }
      return next
    })
  }

  const setItemExactQuantity = (prod: Product, v: ProductVariant | ScannedVariant | undefined, exactQty: number) => {
    const key = getItemKey(prod, v)
    const stock = v
      ? (v.quantity_on_hand ?? 0)
      : (prod.variants && prod.variants.length > 0
          ? prod.variants.reduce((sum, item) => sum + (item.quantity_on_hand ?? 0), 0)
          : ((prod as any).quantity_on_hand ?? 0))
    const shouldLimitStock = priceType === 'selling' && !allowExceedStock

    setSelectedMap((prev) => {
      const next = new Map(prev)
      if (exactQty <= 0) {
        next.delete(key)
      } else {
        const boundedQty = shouldLimitStock && stock > 0 ? Math.min(exactQty, stock) : exactQty
        next.set(key, { product: prod, variant: v, quantity: boundedQty })
      }
      return next
    })
  }

  const handleItemPress = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    const stock = v
      ? (v.quantity_on_hand ?? 0)
      : (prod.variants && prod.variants.length > 0
          ? prod.variants.reduce((sum, item) => sum + (item.quantity_on_hand ?? 0), 0)
          : ((prod as any).quantity_on_hand ?? 0))
    const shouldLimitStock = priceType === 'selling' && !allowExceedStock

    if (shouldLimitStock && stock <= 0) {
      return
    }

    if (!multiple) {
      onSelect?.(prod, v)
      onClose()
      return
    }
    const key = getItemKey(prod, v)
    if (selectedMap.has(key)) {
      updateItemQuantity(prod, v, -selectedMap.get(key)!.quantity) // Remove
    } else {
      updateItemQuantity(prod, v, 1) // Add
    }
  }

  // Batch toggle: select every in-stock variant of a parent product (or clear them all).
  // Quantities of already-chosen variants are preserved.
  const handleClearParentVariants = (prod: Product) => {
    const variants = prod.variants || []
    if (variants.length === 0) return
    Alert.alert(
      'Deselect All Variants',
      `Are you sure you want to deselect all variants of "${prod.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deselect All',
          style: 'destructive',
          onPress: () => {
            setSelectedMap((prev) => {
              const next = new Map(prev)
              variants.forEach((v) => next.delete(v.id))
              return next
            })
          },
        },
      ]
    )
  }

  const handleToggleAllVariants = (prod: Product) => {
    const variants = prod.variants || []
    if (variants.length === 0) return

    const selectableVariants = priceType === 'selling' ? variants.filter(v => (v.quantity_on_hand ?? 0) > 0) : variants
    if (selectableVariants.length === 0) return

    setSelectedMap((prev) => {
      const next = new Map(prev)
      const allSelected = selectableVariants.every((v) => next.has(v.id))
      if (allSelected) {
        selectableVariants.forEach((v) => next.delete(v.id))
      } else {
        selectableVariants.forEach((v) => {
          const existing = next.get(v.id)
          next.set(v.id, { product: prod, variant: v, quantity: existing ? existing.quantity : 1 })
        })
      }
      return next
    })
  }

  const handleConfirmSelection = () => {
    const selectedList = Array.from(selectedMap.values())
    if (selectedList.length === 0) return

    if (onSelectMultiple) {
      onSelectMultiple(selectedList)
    } else if (onSelect) {
      selectedList.forEach((item) => {
        onSelect(item.product, item.variant)
      })
    }
    onClose()
  }

  const selectedCount = selectedMap.size
  const totalUnits = useMemo(() => {
    let total = 0
    selectedMap.forEach((it) => {
      total += it.quantity
    })
    return total
  }, [selectedMap])

  const totalValue = useMemo(() => {
    let total = 0
    selectedMap.forEach((it) => {
      const price = getPrice(it.product, it.variant)
      total += price * it.quantity
    })
    return total
  }, [selectedMap, priceType])

  const renderProductItem = ({ item: prod }: { item: Product }) => {
    const hasVariants = prod.variants && prod.variants.length > 0
    const totalStock = prod.variants?.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0) ?? 0
    const isSearching = search.trim().length > 0
    const isExpanded = isSearching || expandedIds.has(prod.id)

    // Count how many variants of this parent are currently selected
    let selectedVariantsInProduct = 0
    if (hasVariants) {
      prod.variants?.forEach((v) => {
        if (selectedMap.has(v.id)) selectedVariantsInProduct++
      })
    }
    const allVariantsSelected = !!hasVariants && selectedVariantsInProduct === prod.variants!.length
    const someVariantsSelected = !allVariantsSelected && selectedVariantsInProduct > 0

    return (
      <View style={styles.productCard}>
        {/* Parent Product Header */}
        {hasVariants ? (
          <TouchableOpacity
            style={styles.productHeaderTouchable}
            onPress={() => toggleExpand(prod.id)}
            activeOpacity={0.7}
          >
            {/* Batch Select All Variants Checkbox */}
            {Boolean(multiple) && (
              <TouchableOpacity
                style={[
                  styles.batchCheckbox,
                  allVariantsSelected && styles.batchCheckboxChecked,
                  someVariantsSelected && styles.batchCheckboxPartial,
                ]}
                onPress={() => handleToggleAllVariants(prod)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allVariantsSelected }}
                accessibilityLabel={`Select all ${prod.variants?.length} variants of ${prod.name}`}
              >
                {Boolean(allVariantsSelected) && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                {Boolean(someVariantsSelected) && <Ionicons name="remove" size={14} color="#FFFFFF" />}
              </TouchableOpacity>
            )}

            {prod.image_url ? (
              <Image
                source={{ uri: prod.image_url }}
                style={styles.prodThumb}
                contentFit="cover"
                recyclingKey={prod.id}
              />
            ) : (
              <View style={styles.prodIconPlaceholder}>
                <Ionicons
                  name="shirt-outline"
                  size={20}
                  color={tokens.colors.primaryContainer}
                />
              </View>
            )}

            <View style={styles.prodInfoCol}>
              <View style={styles.prodTitleRow}>
                <Text style={styles.prodName} numberOfLines={1}>
                  {prod.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {Boolean(selectedVariantsInProduct > 0) && (
                    <TouchableOpacity
                      style={styles.clearParentBtn}
                      onPress={(e) => {
                        e.stopPropagation?.()
                        handleClearParentVariants(prod)
                      }}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={11} color="#DC2626" />
                      <Text style={styles.clearParentBtnText}>{selectedVariantsInProduct} chosen • Clear</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.varCountBadge}>
                    <Text style={styles.varCountText}>{prod.variants?.length} variants</Text>
                  </View>
                </View>
              </View>

              <View style={styles.prodMetaRow}>
                {Boolean(prod.sku) && (
                  <CopyableBadge
                    type="sku"
                    value={prod.sku}
                    compact
                  />
                )}
                {Boolean(prod.barcode) && (
                  <CopyableBadge
                    type="barcode"
                    value={prod.barcode}
                    compact
                    prefixIcon
                  />
                )}
                {Boolean(prod.category?.name) && (
                  <>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.prodCat}>{prod.category?.name}</Text>
                  </>
                )}
                <Text style={styles.dotSeparator}>•</Text>
                <Text style={styles.prodStockTotal}>Total Stock: {totalStock}</Text>
              </View>
            </View>

            {/* Accordion Chevron */}
            <View style={styles.chevronBox}>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={tokens.colors.primaryContainer}
              />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.productHeader}>
            {prod.image_url ? (
              <Image
                source={{ uri: prod.image_url }}
                style={styles.prodThumb}
                contentFit="cover"
                recyclingKey={prod.id}
              />
            ) : (
              <View style={styles.prodIconPlaceholder}>
                <Ionicons
                  name="cube-outline"
                  size={20}
                  color={tokens.colors.primaryContainer}
                />
              </View>
            )}

            <View style={styles.prodInfoCol}>
              <View style={styles.prodTitleRow}>
                <Text style={styles.prodName} numberOfLines={1}>
                  {prod.name}
                </Text>
              </View>

              <View style={styles.prodMetaRow}>
                {Boolean(prod.sku || prod.variants?.[0]?.sku) && (
                  <CopyableBadge
                    type="sku"
                    value={prod.sku || prod.variants?.[0]?.sku}
                    compact
                  />
                )}
                {Boolean(prod.barcode || prod.variants?.[0]?.barcode) && (
                  <CopyableBadge
                    type="barcode"
                    value={prod.barcode || prod.variants?.[0]?.barcode}
                    compact
                    prefixIcon
                  />
                )}
                {Boolean(prod.category?.name) && (
                  <>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.prodCat}>{prod.category?.name}</Text>
                  </>
                )}
                <Text style={styles.dotSeparator}>•</Text>
                <Text style={styles.prodStockTotal}>Stock: {totalStock}</Text>
              </View>
            </View>
          </View>
        )}

        {/* If variable product and expanded, show nested variants */}
        {Boolean(hasVariants && isExpanded) && (
          <View style={styles.variantsContainer}>
            <View style={styles.variantsGroupHeader}>
              <Text style={styles.variantsGroupLabel}>
                Variants ({prod.variants?.length})
              </Text>
              <Text style={styles.tapToSelectHint}>Select all matching options</Text>
            </View>

            {prod.variants?.map((v) => {
              const key = v.id
              const isSelected = selectedMap.has(key)
              const selectedQty = isSelected ? selectedMap.get(key)!.quantity : 0
              const variantPrice = getPrice(prod, v)
              const stock = v.quantity_on_hand ?? 0
              const isVarOos = priceType === 'selling' && stock <= 0
              const isAtMax = priceType === 'selling' && selectedQty >= stock
              const attrString = v.attribute_values?.map((av) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ') || ''
              const varDisplayName = v.name || attrString || v.sku

              return (
                <View
                  key={v.id}
                  style={[styles.variantRow, isSelected && styles.variantRowSelected]}
                >
                  <TouchableOpacity
                    style={styles.variantLeft}
                    onPress={() => handleItemPress(prod, v)}
                    disabled={isVarOos}
                    activeOpacity={0.7}
                  >
                    <View style={styles.variantNameRow}>
                      <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected, isVarOos && styles.checkboxCircleDisabled]}>
                        {Boolean(isSelected) && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.variantName, isSelected && styles.variantNameSelected, isVarOos && styles.textDisabled]} numberOfLines={1}>
                        {varDisplayName}
                      </Text>
                    </View>
                    <View style={styles.variantMetaRow}>
                      {Boolean(v.sku) && (
                        <CopyableBadge
                          type="sku"
                          value={v.sku}
                          compact
                        />
                      )}
                      {Boolean(v.barcode) && (
                        <CopyableBadge
                          type="barcode"
                          value={v.barcode}
                          compact
                          prefixIcon
                        />
                      )}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.variantRight}>
                    <View style={styles.variantPriceStockCol}>
                      <Text style={[styles.variantPrice, isVarOos && styles.textDisabled]}>${variantPrice.toFixed(2)}</Text>
                      <View style={[styles.stockPill, stock <= 0 ? styles.stockPillOut : styles.stockPillOk]}>
                        <Text style={[styles.stockPillText, stock <= 0 ? styles.stockPillTextOut : styles.stockPillTextOk]}>
                          {stock} in stock
                        </Text>
                      </View>
                    </View>

                    {/* Stepper or Toggle Button */}
                    {Boolean(isSelected && multiple) ? (
                      <View style={styles.inlineStepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateItemQuantity(prod, v, -1)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="remove" size={14} color={tokens.colors.onBackground} />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.stepperQtyText}
                          keyboardType="numeric"
                          value={String(selectedQty)}
                          onChangeText={(txt) => {
                            const clean = txt.replace(/[^0-9]/g, '')
                            const num = parseInt(clean, 10)
                            setItemExactQuantity(prod, v, isNaN(num) ? 0 : num)
                          }}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={[styles.stepperBtn, isAtMax && styles.stepperBtnDisabled]}
                          onPress={() => updateItemQuantity(prod, v, 1)}
                          disabled={isAtMax}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="add" size={14} color={isAtMax ? tokens.colors.textDisabled : tokens.colors.onBackground} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.selectCircle, isVarOos && styles.selectCircleDisabled]}
                        onPress={() => handleItemPress(prod, v)}
                        disabled={isVarOos}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* If simple product without variants */}
        {Boolean(!hasVariants) && (() => {
          const isSimpleOos = priceType === 'selling' && !allowExceedStock && totalStock <= 0
          const isSelected = selectedMap.has(getItemKey(prod))
          const selectedQty = isSelected ? selectedMap.get(getItemKey(prod))!.quantity : 0
          const isAtMax = priceType === 'selling' && !allowExceedStock && selectedQty >= totalStock

          return (
            <View style={[styles.simpleAddContainer, isSelected && styles.simpleAddContainerSelected]}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => handleItemPress(prod)}
                disabled={isSimpleOos}
                activeOpacity={0.8}
              >
                <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected, isSimpleOos && styles.checkboxCircleDisabled]}>
                  {Boolean(isSelected) && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <View>
                  <Text style={[styles.simplePriceText, isSimpleOos && styles.textDisabled]}>${getPrice(prod).toFixed(2)}</Text>
                  <Text style={[styles.simpleStockText, isSimpleOos ? styles.stockPillTextOut : null]}>
                    {isSimpleOos ? 'Out of stock' : `${totalStock} in stock`}
                  </Text>
                </View>
              </TouchableOpacity>

              {Boolean(isSelected && multiple) ? (
                <View style={styles.inlineStepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => updateItemQuantity(prod, undefined, -1)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="remove" size={14} color={tokens.colors.onBackground} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperQtyText}
                    keyboardType="numeric"
                    value={String(selectedQty)}
                    onChangeText={(txt) => {
                      const clean = txt.replace(/[^0-9]/g, '')
                      const num = parseInt(clean, 10)
                      setItemExactQuantity(prod, undefined, isNaN(num) ? 0 : num)
                    }}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={[styles.stepperBtn, isAtMax && styles.stepperBtnDisabled]}
                    onPress={() => updateItemQuantity(prod, undefined, 1)}
                    disabled={isAtMax}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="add" size={14} color={isAtMax ? tokens.colors.textDisabled : tokens.colors.onBackground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.simpleAddBtnAction, isSimpleOos && styles.simpleAddBtnActionDisabled]}
                  onPress={() => handleItemPress(prod)}
                  disabled={isSimpleOos}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.simpleActionText, isSimpleOos && styles.simpleActionTextDisabled]}>
                    {isSimpleOos ? 'OOS' : '+ Select'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })()}
      </View>
    )
  }

  const hasVariableProducts = filteredProducts.some((p) => p.variants && p.variants.length > 0)
  const isAllExpanded = hasVariableProducts && filteredProducts
    .filter((p) => p.variants && p.variants.length > 0)
    .every((p) => expandedIds.has(p.id))

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Manual Refresh Button */}
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={() => loadProducts(true)}
                disabled={refreshing || loading}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                ) : (
                  <Ionicons name="refresh" size={18} color={tokens.colors.primaryContainer} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar & Accordion Toolbar */}
          <View style={styles.searchToolbar}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search product name, SKU, variant..."
            />

            {/* Toolbar Buttons Row */}
            <View style={styles.toolbarActionRow}>
              {Boolean(selectedCount > 0) && (
                <TouchableOpacity
                  style={styles.clearSelectionBtn}
                  onPress={() => setSelectedMap(new Map())}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={13} color={tokens.colors.statusError} />
                  <Text style={styles.clearSelectionText}>Clear ({selectedCount})</Text>
                </TouchableOpacity>
              )}

              {Boolean(hasVariableProducts && !search.trim()) && (
                <TouchableOpacity
                  style={styles.expandAllBtn}
                  onPress={handleToggleExpandAll}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isAllExpanded ? 'contract-outline' : 'expand-outline'}
                    size={14}
                    color={tokens.colors.primaryContainer}
                  />
                  <Text style={styles.expandAllBtnText}>
                    {isAllExpanded ? 'Collapse All' : 'Expand All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Catalog List with Pull-Down RefreshControl */}
          {loading && products.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
              <Text style={styles.loadingText}>Loading latest store catalog...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              renderItem={renderProductItem}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={[styles.listContent, selectedCount > 0 && { paddingBottom: 100 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadProducts(true)}
                  colors={[tokens.colors.primaryContainer]}
                  tintColor={tokens.colors.primaryContainer}
                  title="Updating inventory counts..."
                  titleColor={tokens.colors.secondary}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={40} color={tokens.colors.secondary} />
                  <Text style={styles.emptyTitle}>No matching products found</Text>
                  <Text style={styles.emptySubtitle}>Try pulling down to refresh or search with a different term</Text>
                </View>
              }
            />
          )}

          {/* Sticky Bottom Multiple Selection Confirmation Bar */}
          {selectedCount > 0 && (
            <View style={styles.floatingActionBar}>
              <View style={styles.floatingSummaryCol}>
                <Text style={styles.floatingItemsLabel}>
                  {selectedCount} item{selectedCount > 1 ? 's' : ''} • {totalUnits} unit{totalUnits > 1 ? 's' : ''}
                </Text>
                <Text style={styles.floatingTotalValue}>
                  Total: <Text style={styles.floatingTotalValueBold}>${totalValue.toFixed(2)}</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.confirmSelectionBtn}
                onPress={handleConfirmSelection}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.confirmSelectionBtnText}>
                  Add Selected ({selectedCount})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  headerSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchToolbar: {
    marginHorizontal: tokens.spacing.md,
    marginVertical: 8,
    gap: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  toolbarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  clearSelectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  clearSelectionText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.statusError,
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    gap: 4,
    marginLeft: 'auto',
  },
  expandAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 40,
    gap: 10,
  },
  productCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    padding: 12,
    ...tokens.shadows.card,
  },
  productHeaderTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prodThumb: {
    width: 44,
    height: 44,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  prodIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodInfoCol: {
    flex: 1,
  },
  prodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    flex: 1,
  },
  clearParentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearParentBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  selectedCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  selectedCountPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  varCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  varCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  prodMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  prodSku: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  dotSeparator: {
    fontSize: 10,
    color: tokens.colors.textDisabled,
  },
  prodCat: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  prodStockTotal: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  variantsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  variantsGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tapToSelectHint: {
    fontSize: 10,
    color: tokens.colors.secondary,
    fontStyle: 'italic',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  variantRowSelected: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryFixedDim,
  },
  variantLeft: {
    flex: 1,
  },
  variantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: tokens.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxCircleSelected: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  checkboxCircleDisabled: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderColor: tokens.colors.borderSubtle,
    opacity: 0.5,
  },
  batchCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: tokens.colors.secondaryFixedDim,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 2,
  },
  batchCheckboxChecked: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  batchCheckboxPartial: {
    backgroundColor: tokens.colors.primaryFixedDim,
    borderColor: tokens.colors.primaryContainer,
  },
  variantName: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    flex: 1,
  },
  variantNameSelected: {
    color: tokens.colors.primaryContainer,
  },
  variantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginLeft: 26,
  },
  variantSku: {
    fontSize: 10,
    color: tokens.colors.secondary,
    fontFamily: 'monospace',
  },
  variantBarcode: {
    fontSize: 10,
    color: tokens.colors.textMuted,
  },
  variantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  variantPriceStockCol: {
    alignItems: 'flex-end',
  },
  variantPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  stockPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  stockPillOk: {
    backgroundColor: '#DCFCE7',
  },
  stockPillOut: {
    backgroundColor: '#FEE2E2',
  },
  stockPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  stockPillTextOk: {
    color: '#16A34A',
  },
  stockPillTextOut: {
    color: '#DC2626',
  },
  selectCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.5,
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 4,
  },
  stepperBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    minWidth: 26,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  simpleAddContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.sm,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  simpleAddContainerSelected: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryFixedDim,
  },
  simplePriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  simpleStockText: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  simpleAddBtnAction: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
  },
  simpleAddBtnActionDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.5,
  },
  simpleActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  simpleActionTextDisabled: {
    color: tokens.colors.surfaceBase,
  },
  textDisabled: {
    color: tokens.colors.textDisabled,
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    ...tokens.shadows.card,
  },
  floatingSummaryCol: {
    flex: 1,
  },
  floatingItemsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  floatingTotalValue: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  floatingTotalValueBold: {
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  confirmSelectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  confirmSelectionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptySubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
})
