import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { restockInventory, scanBarcode, getProducts, fetchSuppliers } from '../api/endpoints'
import type { RestockPayload, Product, ProductVariant, ScannedVariant, PurchaseOrder, ScannedAttributeValue, Supplier } from '../types'
import { CameraScannerModal } from './CameraScannerModal'
import { ProductPickerModal, SelectedProductItem } from './ProductPickerModal'
import { ProductGroupHeader } from './ProductGroupHeader'
import { CopyableBadge } from './CopyableBadge'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import { emitGlobalToast } from '../utils/clipboard'

export interface StockInLineItem {
  id: string
  variant_id: string
  productId?: string
  parentProductName?: string
  name: string
  sku: string
  barcode?: string | null
  category?: string
  expected_qty: number
  received_qty: number
  unit_cost: number
  current_stock?: number
}

export interface StockInModalProps {
  visible: boolean
  product?: Product | null
  variant?: ProductVariant | ScannedVariant | null
  onClose: () => void
  onSuccess?: () => void
  onOpenScanner?: () => void
  pendingPurchaseOrders?: PurchaseOrder[]
  onLinkPoReceived?: (poId: string) => void
}

export const StockInModal: React.FC<StockInModalProps> = ({
  visible,
  product,
  variant,
  onClose,
  onSuccess,
  pendingPurchaseOrders = [],
  onLinkPoReceived,
}) => {
  const { can } = usePermissions()
  const [items, setItems] = useState<StockInLineItem[]>([])
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [poNumber, setPoNumber] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [showManualNotes, setShowManualNotes] = useState(false)

  // Product Selection Catalog Modal State
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Internal Scanner & Toast State
  const globalToast = useToast()
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning' | 'error'>('success')
  const toastTranslateY = useRef(new Animated.Value(-60)).current
  const toastOpacity = useRef(new Animated.Value(0)).current
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const hardwareInputRef = useRef<TextInput>(null)

  // Filter pending purchase orders (status ORDERED or DRAFT)
  const pendingPOs = useMemo(() => {
    return (pendingPurchaseOrders || []).filter(
      (po) => po.status === 'ORDERED' || po.status === 'DRAFT'
    )
  }, [pendingPurchaseOrders])

  const showToast = useCallback(
    (msg: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
      if (!msg) return
      setToastMessage(msg)
      setToastType(type)

      // Notify global toast system
      if (globalToast && globalToast.showToast) {
        globalToast.showToast(msg, { type })
      } else {
        emitGlobalToast(msg, type)
      }

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)

      toastTranslateY.setValue(-60)
      toastOpacity.setValue(0)

      Animated.parallel([
        Animated.spring(toastTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start()

      toastTimeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastTranslateY, {
            toValue: -60,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToastMessage('')
        })
      }, 2600)
    },
    [globalToast, toastTranslateY, toastOpacity]
  )

  function isValidUuid(str?: string | null): boolean {
    if (!str) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  }

  const handleLinkPendingPO = (po: PurchaseOrder) => {
    setSelectedPoId(po.id)
    setPoNumber(po.poNumber)
    setSupplierName(po.supplierName)
    if (po.items && po.items.length > 0) {
      const loadedItems: StockInLineItem[] = po.items.map((it, idx) => {
        let realVariantId = it.variantId
        // If not a valid UUID, attempt to resolve from loaded catalogProducts
        if (!isValidUuid(realVariantId) && catalogProducts.length > 0) {
          for (const prod of catalogProducts) {
            if (prod.variants) {
              const matched = prod.variants.find(
                (v) => v.sku === it.sku || v.sku?.toLowerCase() === it.sku?.toLowerCase()
              )
              if (matched && isValidUuid(matched.id)) {
                realVariantId = matched.id
                break
              }
            }
          }
          // If still not matched, fall back to first variant of first product
          if (!isValidUuid(realVariantId) && catalogProducts[0]?.variants?.[0]?.id) {
            realVariantId = catalogProducts[0].variants[0].id
          }
        }

        return {
          id: `po-item-${it.id || idx}-${Date.now()}`,
          variant_id: realVariantId,
          name: it.productName,
          sku: it.sku,
          category: 'Inventory',
          expected_qty: it.quantity,
          received_qty: it.quantity,
          unit_cost: it.unitCost,
                    current_stock: 0,
        }
      })
      setItems(loadedItems)
      showToast(`Linked ${po.poNumber} (${loadedItems.length} items loaded)`)
    } else {
      showToast(`Linked ${po.poNumber}`)
    }
  }

  const handleUnlinkPO = () => {
    setSelectedPoId(null)
    setPoNumber('')
    setSupplierName('')
    showToast('Unlinked PO — Direct Intake Mode')
  }

  // Load live products from backend for the catalog picker
  const loadCatalogProducts = useCallback(async () => {
    setCatalogLoading(true)
    try {
      const res = await getProducts({ page: 1 })
      const list: Product[] = Array.isArray(res) ? res : res?.data || []
      if (list.length > 0) {
        setCatalogProducts(list)
      }
    } catch {
      // Gracefully handle offline / connection issues
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetchSuppliers()
      if (Array.isArray(res)) {
        setSuppliers(res)
      }
    } catch {
      // Gracefully handle offline
    }
  }, [])

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (visible) {
      loadCatalogProducts()
      loadSuppliers()
      const isRealVariant = variant && typeof variant === 'object' && typeof variant.id === 'string' && variant.id.length > 0 && !('nativeEvent' in variant)
      const isRealProduct = product && typeof product === 'object' && typeof product.id === 'string' && typeof product.name === 'string' && product.name.length > 0 && !('nativeEvent' in product)

      if (isRealVariant) {
        const purchaseCost = parseFloat(String((variant as ProductVariant)?.cost_price_override || product?.purchase_price || '0')) || 0
        const attrSummary = variant.attribute_values?.map((av) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
        const displayName = (variant as ProductVariant).name || (attrSummary ? `${product?.name || 'Product'} (${attrSummary})` : `${product?.name || 'Product'} - ${variant.sku}`)

        const initItem: StockInLineItem = {
          id: `stockin-${variant.id}-${Date.now()}`,
          variant_id: variant.id,
          name: displayName,
          sku: variant.sku || 'SKU',
          barcode: variant.barcode || product?.barcode || null,
          category: product?.category?.name || 'Inventory',
          expected_qty: 1,
          received_qty: 1,
          unit_cost: purchaseCost,
          current_stock: variant.quantity_on_hand ?? 0,
        }
        setItems([initItem])
      } else if (isRealProduct) {
        if (product.variants && product.variants.length > 0) {
          const initItems: StockInLineItem[] = product.variants.map((v, idx) => {
            const purchaseCost = parseFloat(String(v.cost_price_override || product.purchase_price || '0')) || 0
            const attrSummary = v.attribute_values?.map((av) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
            const displayName = v.name || (attrSummary ? `${product.name} (${attrSummary})` : `${product.name} - ${v.sku}`)

            return {
              id: `stockin-${v.id || idx}-${Date.now()}`,
              variant_id: v.id,
              name: displayName,
              sku: v.sku,
              barcode: v.barcode || product.barcode || null,
              category: product.category?.name || 'Inventory',
              expected_qty: 1,
              received_qty: 1,
              unit_cost: purchaseCost,
              current_stock: v.quantity_on_hand ?? 0,
            }
          })
          setItems(initItems)
        } else {
          const purchaseCost = parseFloat(String(product.purchase_price || '0')) || 0
          const initItem: StockInLineItem = {
            id: `stockin-${product.id}-${Date.now()}`,
            variant_id: product.id,
            name: product.name,
            sku: product.sku || 'SKU-UNKNOWN',
            barcode: product.barcode || null,
            category: product.category?.name || 'Inventory',
            expected_qty: 1,
            received_qty: 1,
            unit_cost: purchaseCost,
            current_stock: 0,
          }
          setItems([initItem])
        }
      } else if (!selectedPoId) {
        setItems([])
        setPoNumber('')
        setSupplierName('')
        setNotes('')
        setShowManualNotes(false)
      }
    }
  }, [visible, product, variant, selectedPoId, loadCatalogProducts])

  const handleOpenCatalog = useCallback(() => {
    setCatalogOpen(true)
    loadCatalogProducts()
  }, [loadCatalogProducts])

  const handleSelectFromPicker = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    handleSelectMultipleFromPicker([{ product: prod, variant: v, quantity: 1 }])
  }

  const handleSelectMultipleFromPicker = (selectedList: SelectedProductItem[]) => {
    setItems((prev) => {
      const next = [...prev]
      selectedList.forEach((it) => {
        const prod = it.product
        const v = it.variant
        const targetVariantId = v?.id || prod.variants?.[0]?.id || prod.id
        const targetSku = v?.sku || prod.sku || 'SKU-UNKNOWN'
        const targetStock = v?.quantity_on_hand ?? (prod.variants?.[0]?.quantity_on_hand ?? 0)
        const purchaseCost = parseFloat(String((v as ProductVariant)?.cost_price_override || prod.purchase_price || '0')) || 0
        const attrSummary = v?.attribute_values?.map((av: ScannedAttributeValue) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
        const displayName = v ? ((v as ProductVariant).name || (attrSummary ? `${prod.name} (${attrSummary})` : `${prod.name} - ${v.sku}`)) : prod.name

        const existingIdx = next.findIndex((i) => i.variant_id === targetVariantId)
        if (existingIdx >= 0) {
          // Picker reflects current totals: confirm sets the line to the chosen quantity (no double-count)
          next[existingIdx] = {
            ...next[existingIdx],
            received_qty: Math.max(1, Math.round(it.quantity || 1)),
          }
        } else {
          next.unshift({
            id: `si-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            variant_id: targetVariantId,
            productId: prod.id,
            parentProductName: prod.name,
            name: displayName,
            sku: targetSku,
            barcode: v?.barcode || prod.barcode || null,
            category: prod.category?.name || 'Inventory',
            expected_qty: 0,
            received_qty: it.quantity,
            unit_cost: purchaseCost,
            current_stock: targetStock,
          })
        }
      })
      return next
    })
    showToast(`Added ${selectedList.length} item${selectedList.length > 1 ? 's' : ''}`)
    setCatalogOpen(false)
  }

  // Barcode Scanner Hook for Stock In
  const {
    scannerOpen,
    setScannerOpen,
    loading: scanLoading,
    handleScanCode,
    lastFeedback: scanFeedback,
    triggerFeedback,
  } = useBarcodeScan({
    mode: 'stock-in',
    customToast: showToast,
    closeScannerOnFound: false,
    onBeforeProcess: (code) => {
      const existingItem = items.find((i) => i.sku === code || i.variant_id === code || i.barcode === code)
      if (existingItem) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === existingItem.id ? { ...i, received_qty: i.received_qty + 1 } : i
          )
        )
        triggerFeedback({
          message: `+1 ${existingItem.name}`,
          submessage: `Total staged: ${existingItem.received_qty + 1}`,
          type: 'success',
          timestamp: Date.now(),
        })
        showToast(`+1 ${existingItem.name}`)
        return true
      }
      return false
    },
    onFoundVariant: (variant, product) => {
      const newItem: StockInLineItem = {
        id: `si-${Date.now()}`,
        variant_id: variant.id,
        name: product?.name ? `${product.name} (${variant.sku})` : 'Product',
        sku: variant.sku,
        barcode: variant.barcode || product?.barcode || null,
        category: 'Inventory',
        expected_qty: 0,
        received_qty: 1,
        unit_cost: parseFloat(product?.purchase_price || '0') || 0,
        current_stock: variant.quantity_on_hand,
      }
      setItems((prev) => [newItem, ...prev])
      showToast(`Added ${newItem.name}`)
    },
    onFoundProduct: (product, variants) => {
      const firstVariant = variants[0]
      const newItem: StockInLineItem = {
        id: `si-${Date.now()}`,
        variant_id: firstVariant ? firstVariant.id : product.id,
        name: product.name,
        sku: firstVariant?.sku || product.barcode || 'SKU',
        barcode: firstVariant?.barcode || product.barcode || null,
        category: 'Inventory',
        expected_qty: 0,
        received_qty: 1,
        unit_cost: parseFloat(product.purchase_price || '0') || 0,
        current_stock: firstVariant ? firstVariant.quantity_on_hand : 0,
      }
      setItems((prev) => [newItem, ...prev])
      showToast(`Added ${newItem.name}`)
    },
  })
  const updateReceivedQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = Math.max(0, item.received_qty + delta)
          return { ...item, received_qty: next }
        }
        return item
      })
    )
  }

  const setReceivedQtyDirect = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, received_qty: Math.max(0, qty) } : item))
    )
  }

  const updateUnitCost = (id: string, text: string) => {
    const val = parseFloat(text) || 0
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unit_cost: val } : item))
    )
  }



  interface StockInGroup {
    groupKey: string
    parentName: string
    items: StockInLineItem[]
    totalQty: number
    totalCost: number
  }

  const groupedStockInItems = useMemo<StockInGroup[]>(() => {
    const groups: Record<string, StockInGroup> = {}
    items.forEach((it) => {
      const parentName = it.parentProductName || (it.name ? it.name.split(' (')[0].split(' - ')[0] : 'Product')
      const groupKey = it.productId || it.parentProductName || parentName
      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          parentName,
          items: [],
          totalQty: 0,
          totalCost: 0,
        }
      }
      groups[groupKey].items.push(it)
      groups[groupKey].totalQty += it.received_qty
      groups[groupKey].totalCost += it.received_qty * it.unit_cost
    })
    return Object.values(groups)
  }, [items])

  const handleRemoveStockInItemWithConfirm = (item: StockInLineItem) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${item.name}" from this intake?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setItems((prev) => prev.filter((i) => i.id !== item.id))
            showToast('Removed item from intake')
          },
        },
      ]
    )
  }

  const handleRemoveStockInParentGroupWithConfirm = (group: StockInGroup) => {
    Alert.alert(
      'Remove All Variants',
      `Are you sure you want to remove all ${group.items.length} variants of "${group.parentName}" from this intake?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: () => {
            const idsToRemove = new Set(group.items.map((i) => i.id))
            setItems((prev) => prev.filter((i) => !idsToRemove.has(i.id)))
            showToast(`Removed all variants of ${group.parentName}`)
          },
        },
      ]
    )
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const totalLoggedItems = items.filter((i) => i.received_qty > 0).length
  const totalValue = items.reduce((sum, item) => sum + item.received_qty * item.unit_cost, 0)
  const totalReceivedUnits = items.reduce((sum, item) => sum + item.received_qty, 0)

  const handleResetForm = () => {
    setItems([])
    setSelectedPoId(null)
    setSupplierName('')
    setNotes('')
    setPoNumber('')
    setShowManualNotes(false)
  }

  const handleCompleteIntake = async () => {
    if (!can('inventory:restock')) {
      Alert.alert('Access Restricted', 'You do not have permission to perform stock intake.')
      return
    }

    if (totalLoggedItems === 0) {
      Alert.alert(
        'No Items Received',
        'Please add products and enter received quantities before completing intake.'
      )
      return
    }

    const activeItemsToValidate = items.filter((i) => i.received_qty > 0)
    for (const item of activeItemsToValidate) {
      if (!item.received_qty || item.received_qty <= 0 || !Number.isInteger(item.received_qty)) {
        Alert.alert('Validation Error', `Item "${item.name}" must have a valid received quantity of at least 1.`)
        return
      }
      if (item.unit_cost === undefined || item.unit_cost === null || isNaN(item.unit_cost) || item.unit_cost < 0) {
        Alert.alert('Validation Error', `Item "${item.name}" must have a valid unit cost (>= 0).`)
        return
      }
    }

    setIsSubmitting(true)
    const noteParts: string[] = []
    if (poNumber.trim()) noteParts.push(`PO: ${poNumber.trim()}`)
    if (supplierName.trim()) noteParts.push(`Supplier: ${supplierName.trim()}`)
    if (notes.trim()) noteParts.push(notes.trim())

    const activeItems = items.filter((i) => i.received_qty > 0)
    for (const item of activeItems) {
      if (!isValidUuid(item.variant_id) && catalogProducts.length > 0) {
        for (const prod of catalogProducts) {
          if (prod.variants) {
            const matched = prod.variants.find(
              (v) => v.sku === item.sku || v.sku?.toLowerCase() === item.sku?.toLowerCase()
            )
            if (matched && isValidUuid(matched.id)) {
              item.variant_id = matched.id
              break
            }
          }
        }
        if (!isValidUuid(item.variant_id) && catalogProducts[0]?.variants?.[0]?.id) {
          item.variant_id = catalogProducts[0].variants[0].id
        }
      }
    }

    const payload: RestockPayload = {
      session_date: new Date().toISOString().split('T')[0],
      notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
      items: activeItems.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.received_qty,
        unit_cost: i.unit_cost,
        scanned_barcode: i.sku,
      })),
    }

    try {
      await restockInventory(payload)
      if (selectedPoId && onLinkPoReceived) {
        onLinkPoReceived(selectedPoId)
      }
      Alert.alert(
        'Intake Completed Successfully',
        `Logged ${totalReceivedUnits} units across ${totalLoggedItems} item(s).\nTotal intake value: $${totalValue.toFixed(2)}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              handleResetForm()
              onSuccess?.()
              onClose()
            },
          },
        ]
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record restock inventory.'
      Alert.alert(
        'Restock Error',
        `${msg}\n\nPlease check your backend connection.`,
        [{ text: 'OK' }]
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea}>
        {Boolean(toastMessage) && (
          <Animated.View
            style={[
              styles.toastContainer,
              {
                transform: [{ translateY: toastTranslateY }],
                opacity: toastOpacity,
              },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.toastPill}>
              <Ionicons
                name={
                  toastType === 'success'
                    ? 'checkmark-circle'
                    : toastType === 'warning'
                    ? 'warning'
                    : toastType === 'error'
                    ? 'alert-circle'
                    : 'information-circle'
                }
                size={18}
                color={
                  toastType === 'success'
                    ? '#34D399'
                    : toastType === 'warning'
                    ? '#FBBF24'
                    : toastType === 'error'
                    ? '#F87171'
                    : tokens.colors.primaryContainer
                }
                style={styles.toastIcon}
              />
              <Text style={styles.toastText} numberOfLines={2}>
                {toastMessage}
              </Text>
            </View>
          </Animated.View>
        )}

        <CameraScannerModal
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanCode={async (code) => {
            await handleScanCode(code)
          }}
          isLoading={scanLoading}
          title="Stock Intake Scanner"
          scannedItems={items.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            barcode: item.barcode,
            quantity: item.received_qty,
            priceOrCost: item.unit_cost,
            priceOrCostLabel: 'Cost',
          }))}
          totalCount={items.reduce((sum, it) => sum + it.received_qty, 0)}
          totalValue={items.reduce((sum, it) => sum + (it.unit_cost || 0) * it.received_qty, 0)}
          onUpdateItemQuantity={(id, delta) => updateReceivedQty(id, delta)}
          onRemoveItem={(id) => handleRemoveItem(id)}
          primaryActionLabel="Done & Review Intake"
          primaryActionIcon="checkmark-circle-outline"
          onPrimaryAction={() => setScannerOpen(false)}
          feedback={scanFeedback}
        />

        {/* Product Catalog Selection Modal */}
        <ProductPickerModal
          visible={catalogOpen}
          title="Select Products for Intake"
          subtitle="Grouped by product catalog with live stock & costs"
          priceType="cost"
          products={catalogProducts}
          existingItems={items.map((it) => ({
            variantId: it.variant_id,
            sku: it.sku,
            productName: it.name,
            quantity: it.received_qty,
          }))}
          onClose={() => setCatalogOpen(false)}
          onSelect={handleSelectFromPicker}
          onSelectMultiple={handleSelectMultipleFromPicker}
          onRefreshCatalog={loadCatalogProducts}
        />

        <View style={styles.container}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeRow}>
                <View style={[styles.statusPill, { backgroundColor: '#E0F2FE' }]}>
                  <View style={[styles.statusDot, { backgroundColor: tokens.colors.primaryContainer }]} />
                  <Text style={[styles.statusPillText, { color: tokens.colors.primaryContainer, fontWeight: '700' }]}>
                    New Stock Intake
                  </Text>
                </View>
                {poNumber ? (
                  <View style={styles.poBadge}>
                    <Text style={styles.poBadgeText}>{poNumber}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.supplierTitle}>
                {supplierName.trim() ? supplierName.trim() : 'New Stock Intake'}
              </Text>
              <Text style={styles.dateSubtitle}>
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })} • {poNumber ? `Linked PO: ${poNumber}` : 'Direct Stock In'}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                testID="btn-stock-in-scan"
                style={styles.scanShortcutBtn}
                onPress={() => setScannerOpen(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Scan barcode to add item"
              >
                <Ionicons name="barcode-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.scanShortcutText}>Scan</Text>
              </TouchableOpacity>

              <TextInput
                ref={hardwareInputRef}
                style={styles.hiddenHardwareScanner}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={() => {
                  if (barcodeInput.trim()) {
                    handleScanCode(barcodeInput.trim())
                    setBarcodeInput('')
                  }
                  hardwareInputRef.current?.focus()
                }}
                autoFocus={true}
                showSoftInputOnFocus={false}
                blurOnSubmit={false}
              />

              <TouchableOpacity
                testID="btn-close-stock-in"
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close stock in modal"
              >
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Line Items */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Pending Purchase Orders Banner (Only if pending POs exist or if one is linked) */}
            {selectedPoId ? (
              <View style={styles.linkedPoCard}>
                <View style={styles.linkedPoLeft}>
                  <Ionicons name="link" size={16} color={tokens.colors.primaryContainer} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkedPoTitle}>Linked to {poNumber}</Text>
                    <Text style={styles.linkedPoSub}>{supplierName || 'Pending PO'} • Auto-filled items</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.unlinkPoBtn} onPress={handleUnlinkPO}>
                  <Ionicons name="close-circle-outline" size={14} color={tokens.colors.statusError} />
                  <Text style={styles.unlinkPoText}>Unlink</Text>
                </TouchableOpacity>
              </View>
            ) : pendingPOs.length > 0 ? (
              <View style={styles.pendingPoBanner}>
                <View style={styles.pendingPoHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="document-text-outline" size={16} color={tokens.colors.primaryContainer} />
                    <Text style={styles.pendingPoTitle}>Pending POs ({pendingPOs.length})</Text>
                  </View>
                  <Text style={styles.pendingPoHint}>Tap to pre-fill items & supplier</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingPoChipsList}>
                  {pendingPOs.map((po) => (
                    <TouchableOpacity
                      key={po.id}
                      style={styles.pendingPoChip}
                      onPress={() => handleLinkPendingPO(po)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.pendingPoChipTop}>
                        <Text style={styles.pendingPoChipNum}>{po.poNumber}</Text>
                        <Text style={styles.pendingPoChipCost}>${po.totalCost.toFixed(2)}</Text>
                      </View>
                      <Text style={styles.pendingPoChipSup} numberOfLines={1}>{po.supplierName}</Text>
                      <View style={styles.pendingPoChipAction}>
                        <Ionicons name="arrow-forward-circle" size={14} color={tokens.colors.primaryContainer} />
                        <Text style={styles.pendingPoChipActionText}>Link & Intake</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Optional Delivery Metadata Inputs Card (Omitted by default unless PO is linked or manually opened) */}
            {Boolean(showManualNotes || selectedPoId || poNumber || supplierName) && (
              <View style={styles.metaCard}>
                {suppliers.length > 0 && !selectedPoId && (
                  <View style={{ marginBottom: tokens.spacing.sm }}>
                    <Text style={styles.noteLabel}>QUICK SELECT REGISTERED SUPPLIER</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingTop: 4 }}>
                      {suppliers.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={[
                            {
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: tokens.borderRadius.xs,
                              borderWidth: 1,
                              borderColor: supplierName === s.name ? tokens.colors.primary : tokens.colors.borderSubtle,
                              backgroundColor: supplierName === s.name ? tokens.colors.primaryFixed : tokens.colors.surfaceContainerLowest,
                            },
                          ]}
                          onPress={() => setSupplierName(supplierName === s.name ? '' : s.name)}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: supplierName === s.name ? '700' : '500',
                              color: supplierName === s.name ? tokens.colors.primary : tokens.colors.textPrimary,
                            }}
                          >
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.metaRow}>
                  <View style={styles.metaCol}>
                    <Text style={styles.noteLabel}>PO / INTAKE REFERENCE (OPTIONAL)</Text>
                    <TextInput
                      style={styles.metaInput}
                      value={poNumber}
                      onChangeText={setPoNumber}
                      placeholder="e.g. PO-2026-001 (or leave blank)"
                      placeholderTextColor={tokens.colors.textDisabled}
                    />
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.noteLabel}>SUPPLIER / VENDOR NAME (OPTIONAL)</Text>
                    <TextInput
                      style={styles.metaInput}
                      value={supplierName}
                      onChangeText={setSupplierName}
                      placeholder="e.g. Phnom Penh Apparel Suppliers"
                      placeholderTextColor={tokens.colors.textDisabled}
                    />
                  </View>
                </View>

                <View style={{ marginTop: tokens.spacing.sm }}>
                  <Text style={styles.noteLabel}>DELIVERY NOTES / MEMO (OPTIONAL)</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional consignment notes, invoice # or shipping memo"
                    placeholderTextColor={tokens.colors.textDisabled}
                  />
                </View>
              </View>
            )}

            {/* Line Items Header & Action Buttons */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  Intake Items ({items.length})
                </Text>
                <Text style={styles.sectionSub}>Verify quantities and unit costs</Text>
              </View>

              <TouchableOpacity
                style={styles.browseProductsBtn}
                onPress={handleOpenCatalog}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={16} color={tokens.colors.onPrimary} />
                <Text style={styles.browseProductsBtnText}>+ Add Product</Text>
              </TouchableOpacity>
            </View>

            {/* Empty State if no items added yet */}
            {items.length === 0 ? (
              <View style={styles.emptyIntakeContainer}>
                <Ionicons name="cube-outline" size={52} color={tokens.colors.primaryFixedDim} />
                <Text style={styles.emptyIntakeTitle}>No Items Added to Intake Yet</Text>
                <Text style={styles.emptyIntakeSub}>
                  Scan barcodes with camera/scanner or browse the product catalog to add items.
                </Text>
                <View style={styles.emptyActionRow}>
                  <TouchableOpacity
                    style={styles.emptyActionBtnPrimary}
                    onPress={handleOpenCatalog}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="list" size={18} color={tokens.colors.onPrimary} />
                    <Text style={styles.emptyActionBtnPrimaryText}>Browse Products</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emptyActionBtnSecondary}
                    onPress={() => setScannerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="barcode-outline" size={18} color={tokens.colors.primaryContainer} />
                    <Text style={styles.emptyActionBtnSecondaryText}>Scan Barcode</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              groupedStockInItems.map((group) => {
                const isMultiVariant = group.items.length > 1
                return (
                  <View key={group.groupKey} style={[styles.itemCard, { padding: 0, overflow: 'hidden' }]}>
                    <ProductGroupHeader
                      parentName={group.parentName}
                      variantCount={group.items.length}
                      totalQty={group.totalQty}
                      totalCost={group.totalCost}
                      onRemoveAll={() => handleRemoveStockInParentGroupWithConfirm(group)}
                    />

                    {group.items.map((item) => (
                      <View key={item.id} style={[{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                        {/* Item Top Info */}
                        <View style={styles.itemTopRow}>
                          <View style={[styles.thumbnailBox, isMultiVariant && { width: 32, height: 32 }]}>
                            <Ionicons name={isMultiVariant ? 'git-branch-outline' : 'cube-outline'} size={isMultiVariant ? 16 : 22} color={tokens.colors.primaryContainer} />
                          </View>

                          <View style={styles.itemInfoCol}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {isMultiVariant
                                ? (item.name && item.name.includes('(') ? item.name.split('(')[1].replace(')', '') : item.name || 'Variant')
                                : item.name || 'Product'}
                            </Text>
                            <View style={styles.itemMetaRow}>
                              {Boolean(item.sku) && (
                                <CopyableBadge
                                  type="sku"
                                  value={item.sku}
                                  compact
                                  onToast={showToast}
                                />
                              )}
                              {Boolean(item.barcode) && (
                                <CopyableBadge
                                  type="barcode"
                                  value={item.barcode}
                                  compact
                                  prefixIcon
                                  onToast={showToast}
                                />
                              )}
                              {item.current_stock !== undefined && (
                                <Text style={styles.expectedText}>
                                  Stock: <Text style={styles.boldText}>{item.current_stock}</Text>
                                  {' → '}
                                  <Text style={[styles.boldText, { color: tokens.colors.statusSuccess }]}>
                                    {(item.current_stock ?? 0) + item.received_qty}
                                  </Text>
                                  <Text style={{ color: tokens.colors.primary, fontWeight: '700' }}>
                                    {' '}(+{item.received_qty})
                                  </Text>
                                </Text>
                              )}
                            </View>
                          </View>

                          <TouchableOpacity
                            style={styles.trashBtn}
                            onPress={() => handleRemoveStockInItemWithConfirm(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color={tokens.colors.statusError} />
                          </TouchableOpacity>
                        </View>

                        {/* Quantity Stepper & Cost Inputs Row */}
                        <View style={styles.inputsGrid}>
                          {/* Received Stepper */}
                          <View style={styles.inputCol}>
                            <Text style={styles.fieldLabel}>RECEIVED QTY</Text>
                            <View style={styles.stepperContainer}>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => updateReceivedQty(item.id, -1)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="remove" size={16} color={tokens.colors.textPrimary} />
                              </TouchableOpacity>

                              <TextInput
                                style={styles.stepperValue}
                                value={String(item.received_qty)}
                                onChangeText={(txt) => {
                                  const clean = txt.replace(/[^0-9]/g, '')
                                  const num = parseInt(clean, 10)
                                  setReceivedQtyDirect(item.id, isNaN(num) ? 0 : num)
                                }}
                                keyboardType="numeric"
                                selectTextOnFocus
                              />

                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => updateReceivedQty(item.id, 1)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add" size={16} color={tokens.colors.textPrimary} />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Unit Cost */}
                          <View style={styles.inputCol}>
                            <Text style={styles.fieldLabel}>UNIT COST ($)</Text>
                            <TextInput
                              style={styles.textInput}
                              value={String(item.unit_cost)}
                              onChangeText={(text) => updateUnitCost(item.id, text)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={tokens.colors.textDisabled}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )
              })
            )}

            {/* Bottom Quick Add Action */}
            {items.length > 0 && (
              <TouchableOpacity
                testID="btn-add-more-products"
                style={styles.addUnexpectedBtn}
                onPress={handleOpenCatalog}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.addUnexpectedText}>+ Add More Products to Intake</Text>
              </TouchableOpacity>
            )}

            {/* Optional Supplier / Memo Toggle (Omitted from main screen unless requested) */}
            {Boolean(!selectedPoId) && (
              <TouchableOpacity
                style={styles.toggleNotesBtn}
                onPress={() => setShowManualNotes((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showManualNotes ? 'chevron-up-circle-outline' : 'add-circle-outline'}
                  size={16}
                  color={tokens.colors.secondary}
                />
                <Text style={styles.toggleNotesText}>
                  {showManualNotes ? 'Hide Supplier / Memo Fields' : '+ Add Supplier / Intake Notes (Optional)'}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Sticky Bottom Intake Summary Bar */}
          <View style={styles.footer}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLoggedText}>
                {totalLoggedItems} item(s) • {totalReceivedUnits} total units
              </Text>
              <Text style={styles.summaryValueText}>
                Total Value: <Text style={styles.valueHighlight}>${totalValue.toFixed(2)}</Text>
              </Text>
            </View>

            <TouchableOpacity
              testID="btn-complete-intake"
              style={[
                styles.completeBtn,
                (totalLoggedItems === 0 || isSubmitting) && styles.completeBtnDisabled,
              ]}
              onPress={handleCompleteIntake}
              disabled={totalLoggedItems === 0 || isSubmitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Complete inventory intake"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={tokens.colors.onPrimary} />
                  <Text style={styles.completeBtnText}>Complete Intake</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  poBadge: {
    backgroundColor: tokens.colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
  },
  poBadgeText: {
    color: tokens.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.badgeSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.statusSuccess,
  },
  statusPillText: {
    color: tokens.colors.statusSuccess,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  supplierTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dateSubtitle: {
    color: tokens.colors.secondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    gap: 4,
  },
  scanShortcutText: {
    color: tokens.colors.primaryContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  metaCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  metaCol: {
    flex: 1,
  },
  noteLabel: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaInput: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
    paddingHorizontal: 10,
    color: tokens.colors.onBackground,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  sectionTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
  },
  sectionSub: {
    color: tokens.colors.secondary,
    fontSize: 12,
  },
  browseProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  browseProductsBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyIntakeContainer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.spacing.sm,
  },
  emptyIntakeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: tokens.spacing.sm,
  },
  emptyIntakeSub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  emptyActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  emptyActionBtnPrimaryText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    gap: 6,
  },
  emptyActionBtnSecondaryText: {
    color: tokens.colors.primaryContainer,
    fontSize: 13,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    ...tokens.shadows.cardInnerDepth,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  thumbnailBox: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.thumbnail,
    backgroundColor: tokens.colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  itemInfoCol: {
    flex: 1,
  },
  itemName: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  itemSkuBadge: {
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.borderRadius.xs,
  },
  itemSkuText: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  expectedText: {
    color: tokens.colors.secondary,
    fontSize: 11,
  },
  trashBtn: {
    padding: 6,
  },
  boldText: {
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    paddingTop: tokens.spacing.sm,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    color: tokens.colors.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
  },
  stepperBtn: {
    width: 32,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: tokens.colors.onBackground,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hiddenHardwareScanner: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    maxWidth: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  toastIcon: {
    marginRight: 8,
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
    paddingHorizontal: 8,
    color: tokens.colors.onBackground,
    fontSize: 12,
    fontWeight: '600',
  },
  addUnexpectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.primaryContainer,
    borderStyle: 'dashed',
    borderRadius: tokens.borderRadius.card,
    paddingVertical: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    gap: 6,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  addUnexpectedText: {
    color: tokens.colors.primaryContainer,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    ...tokens.shadows.actionSheet,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLoggedText: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValueText: {
    color: tokens.colors.onBackground,
    fontSize: 13,
    fontWeight: '600',
  },
  valueHighlight: {
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.lg,
    height: tokens.touchTarget.actionButtonHeight,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  completeBtnDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.6,
  },
  completeBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },

  /* Catalog Picker Styles */
  catalogContainer: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  catalogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  catalogSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  catalogSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    marginHorizontal: tokens.spacing.md,
    marginVertical: tokens.spacing.sm,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
  },
  catalogSearchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  catalogListContent: {
    padding: tokens.spacing.md,
    paddingBottom: 40,
    gap: 8,
  },
  catalogItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    padding: 12,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  catalogItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  catalogItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  catalogItemSku: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontFamily: 'monospace',
  },
  catalogItemStock: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  catalogItemPriceCol: {
    alignItems: 'flex-end',
  },
  catalogItemCost: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  catalogItemCostLabel: {
    fontSize: 10,
    color: tokens.colors.secondary,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: tokens.colors.secondary,
  },
  emptyCatalogContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: tokens.spacing.lg,
  },
  emptyCatalogTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 12,
  },
  emptyCatalogSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
  },

  /* Pending PO Banner & Linked PO Card Styles */
  pendingPoBanner: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    padding: tokens.spacing.sm + 2,
    marginBottom: tokens.spacing.md,
  },
  pendingPoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs + 2,
    paddingHorizontal: 4,
  },
  pendingPoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  pendingPoHint: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  pendingPoChipsList: {
    gap: 8,
    paddingVertical: 4,
  },
  pendingPoChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    padding: 10,
    minWidth: 160,
    maxWidth: 200,
    ...tokens.shadows.card,
  },
  pendingPoChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  pendingPoChipNum: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    fontFamily: 'monospace',
  },
  pendingPoChipCost: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  pendingPoChipSup: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginBottom: 6,
  },
  pendingPoChipAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: tokens.borderRadius.xs,
    alignSelf: 'flex-start',
  },
  pendingPoChipActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  linkedPoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
    marginBottom: tokens.spacing.md,
  },
  linkedPoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  linkedPoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  linkedPoSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  unlinkPoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#FEE2E2',
  },
  unlinkPoText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.statusError,
  },
  toggleNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: tokens.spacing.sm,
    marginVertical: tokens.spacing.xs,
  },
  toggleNotesText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
})


