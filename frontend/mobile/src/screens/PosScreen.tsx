import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  ScrollView,
  LayoutAnimation,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Crypto from 'expo-crypto'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import {
  getProducts,
  getSalesChannels,
  checkoutOrder,
  scanBarcode,
  fetchDeliveryCompanies,
  fetchDeliveryZones,
  fetchBankAccounts,
  fetchCategories,
  updateOrderStatus,
  updateOrder,
} from '../api/endpoints'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'

import { useCart } from '../hooks/useCart'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { useCustomerLookup } from '../hooks/useCustomerLookup'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useDebounce } from '../hooks/useDebounce'
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader'
import { useProducts, useCategories, ProductFilters } from '../hooks/queries/useProductsQuery'
import { ProductCard } from '../components/ProductCard'
import { CartList } from '../components/CartList'
import { CustomerLookupRow } from '../components/CustomerLookupRow'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { VariantPickerModal } from '../components/VariantPickerModal'
import { OrderReceiptModal } from '../components/OrderReceiptModal'
import { ServerErrorState } from '../components/ServerErrorState'
import { getChannelPlatformMeta } from './SalesChannelsScreen'
import { ListPickerModal, PickerItem } from '../components/pos/ListPickerModal'
import { round2 } from '../utils/money'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { posCheckoutSchema, PosCheckoutFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { CheckoutStep2Form } from '../components/pos/CheckoutStep2Form'
import { CheckoutStep3Summary } from '../components/pos/CheckoutStep3Summary'
import type {
  Product,
  ScannedProduct,
  ScannedVariant,
  SalesChannel,
  PaymentMethod,
  CheckoutPayload,
  Order,
  BankAccount,
  DeliveryCompany,
  DeliveryZone,
  Customer,
} from '../types'

const SAMPLE_PRODUCTS: Product[] = []
const POS_PRODUCT_FILTERS: ProductFilters = { per_page: 200 }

export interface PosScreenProps {
  onNavigate?: (tab: import('../types').TabType) => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onOpenScanner?: () => void
  onOpenSidebar?: () => void
  cartHook?: ReturnType<typeof useCart>
  offlineQueueHook?: ReturnType<typeof useOfflineQueue>
  onCheckoutStateChange?: (isActive: boolean) => void
}

export default function PosScreen({
  onNavigate,
  onOpenScanner: propOpenScanner,
  onOpenSidebar,
  cartHook: propCartHook,
  offlineQueueHook: propOfflineQueueHook,
  onCheckoutStateChange,
}: PosScreenProps) {
  const queryClient = useQueryClient()

  // Search & Category filter
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 250)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>([])

  // Collapsible Search & Category Header on Scroll
  const {
    headerTranslateY,
    headerOpacity,
    onScroll,
    onLayoutHeader,
    headerHeight,
  } = useCollapsibleHeader({ initialHeaderHeight: 110 })

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)

  // Channels state
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<SalesChannel | null>(null)

  // Modals state
  
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerProduct, setPickerProduct] = useState<ScannedProduct | null>(null)
  const [pickerVariants, setPickerVariants] = useState<ScannedVariant[]>([])
  const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1)

  const handleSetCheckoutStep = useCallback((step: 1 | 2 | 3) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setCheckoutStep(step)
  }, [])
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [activePaymentMethod, setActivePaymentMethod] = useState<string>('Cash')

  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, status: string, paymentMethod?: string, notes?: string) => {
      await updateOrderStatus(orderId, status, paymentMethod, notes)
      setCompletedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status } : prev))
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
    },
    [queryClient]
  )

  const handleUpdateOrder = useCallback(
    async (
      orderId: string,
      payload: {
        status?: string
        payment_method?: string
        notes?: string
        delivery_address?: string
        region?: string
      }
    ) => {
      await updateOrder(orderId, payload)
      setCompletedOrder((prev) =>
        prev && prev.id === orderId
          ? {
              ...prev,
              notes: payload.notes !== undefined ? payload.notes : prev.notes,
              delivery_address:
                payload.delivery_address !== undefined
                  ? payload.delivery_address
                  : prev.delivery_address,
              region: payload.region !== undefined ? payload.region : prev.region,
            }
          : prev
      )
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      ])
    },
    [queryClient]
  )

  // Bank Selection State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null)

  const [channelPickerOpen, setChannelPickerOpen] = useState(false)
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false)
  const [deliveryZonePickerOpen, setDeliveryZonePickerOpen] = useState(false)
  const [bankPickerOpen, setBankPickerOpen] = useState(false)
  
  const step2ScrollRef = useRef<ScrollView>(null)

  // Notify parent of checkout state changes
  useEffect(() => {
    if (onCheckoutStateChange) {
      onCheckoutStateChange(checkoutSheetOpen)
    }
  }, [checkoutSheetOpen, onCheckoutStateChange])

  // Delivery & Logistics Options State
  const [deliveryCompanies, setDeliveryCompanies] = useState<DeliveryCompany[]>([])
  const [selectedDeliveryCompany, setSelectedDeliveryCompany] = useState<string>('')

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<DeliveryZone | null>(null)

  const { control, setValue, getValues, watch, trigger, handleSubmit, formState: { errors } } = useForm<PosCheckoutFormValues>({
    resolver: zodResolver(posCheckoutSchema),
    defaultValues: {
      channelId: '',
      deliveryAddress: '',
      discountInput: '',
      discountType: 'flat',
      taxInput: '',
      taxType: 'flat',
      taxRate: '0',
      orderStatus: 'paid',
      customDeliveryFee: '',
      isDelivery: true,
      customerName: '',
      customerPhone: '',
    },
  })

  const deliveryAddress = watch('deliveryAddress') || ''
  const discountInput = watch('discountInput') || ''
  const discountType = watch('discountType') || 'flat'
  const taxInput = watch('taxInput') || ''
  const taxType = watch('taxType') || 'flat'
  const taxRate = watch('taxRate') || '0'
  const orderStatus = watch('orderStatus') || 'paid'
  const customDeliveryFee = watch('customDeliveryFee') || ''
  const isDelivery = watch('isDelivery')

  const lastScannedCode = useRef<string>('')

  // Hooks: Use shared hooks from App if provided, fallback to local instances
  const localCart = useCart()
  const cartHook = propCartHook || localCart
  const {
    cart,
    addVariantToCart,
    addMultipleItemsToCart,
    updateQuantity,
    setItemQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    totalItemCount,
    stockWarnings,
    hasOutOfStockItems,
  } = cartHook

  const {
    phone,
    setPhone,
    name,
    setName,
    matchedCustomer,
    suggestions: customerSuggestions,
    status: customerLookupStatus,
    loyaltyInfo,
    selectCustomer,
    dismissSuggestions,
    resetCustomer,
  } = useCustomerLookup()

  const localOfflineQueue = useOfflineQueue()
  const offlineQueue = propOfflineQueueHook || localOfflineQueue
  const {
    pendingCount,
    enqueueMutation,
  } = offlineQueue

  const handleSelectCustomer = useCallback((cust: Customer) => {
    selectCustomer(cust)
    setValue('customerName', cust.name, { shouldValidate: true })
    setValue('customerPhone', cust.phone, { shouldValidate: true })
    if (cust.address) {
      setValue('deliveryAddress', cust.address)
    }
    if (cust.preferred_delivery_company) {
      setSelectedDeliveryCompany(cust.preferred_delivery_company)
    }
  }, [selectCustomer, setValue])

  const handleResetCustomer = useCallback(() => {
    resetCustomer()
    setValue('customerPhone', '')
    setValue('customerName', '')
    setValue('deliveryAddress', '')
  }, [resetCustomer, setValue])

  // Pre-fill delivery address and company when customer is looked up
  const lastMatchedCustomerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (matchedCustomer && matchedCustomer.id !== lastMatchedCustomerIdRef.current) {
      lastMatchedCustomerIdRef.current = matchedCustomer.id
      if (matchedCustomer.address) {
        setValue('deliveryAddress', matchedCustomer.address)
      }
      if (matchedCustomer.preferred_delivery_company) {
        setSelectedDeliveryCompany(matchedCustomer.preferred_delivery_company)
      }
      setValue('customerName', matchedCustomer.name, { shouldValidate: true })
      setValue('customerPhone', matchedCustomer.phone, { shouldValidate: true })
    }
  }, [matchedCustomer, setValue])

  // Pre-fill discount and customer details from quotation preset if present
  const lastAppliedPresetRef = useRef<string>('')
  useEffect(() => {
    if (cartHook.checkoutPreset) {
      const serialized = JSON.stringify(cartHook.checkoutPreset)
      if (lastAppliedPresetRef.current === serialized) return
      lastAppliedPresetRef.current = serialized

      const { discount, customerName, customerPhone } = cartHook.checkoutPreset
      if (discount !== undefined && discount !== null && Number(discount) > 0) {
        setValue('discountInput', String(discount), { shouldValidate: true })
      }
      if (customerName) {
        setValue('customerName', customerName, { shouldValidate: true })
        setName(customerName)
      }
      if (customerPhone) {
        setValue('customerPhone', customerPhone, { shouldValidate: true })
        setPhone(customerPhone)
      }
    }
  }, [cartHook.checkoutPreset, setValue, setName, setPhone])

  const { data: queryProducts, isLoading: isQueryProductsLoading } = useProducts(POS_PRODUCT_FILTERS)
  const { data: queryCategories } = useCategories()

  const prevQueryProductsRef = useRef<Product[] | undefined>(undefined)
  useEffect(() => {
    if (queryProducts && queryProducts.length > 0 && queryProducts !== prevQueryProductsRef.current) {
      prevQueryProductsRef.current = queryProducts
      setProducts(queryProducts)
    }
  }, [queryProducts])

  const prevQueryCategoriesRef = useRef<any[] | undefined>(undefined)
  useEffect(() => {
    if (queryCategories && Array.isArray(queryCategories) && queryCategories !== prevQueryCategoriesRef.current) {
      prevQueryCategoriesRef.current = queryCategories
      const names = queryCategories.map((c: any) => c.name).filter(Boolean)
      if (names.length > 0) {
        setCategories(names)
      }
    }
  }, [queryCategories])

  // Load remaining sales channels & logistics from API
  const hasSetDefaults = useRef(false)
  const loadData = useCallback(async () => {
    setIsLoadingProducts(isQueryProductsLoading)
    try {
      const [chanRes, compRes, zoneRes, bankRes] = await Promise.allSettled([
        getSalesChannels(),
        fetchDeliveryCompanies(),
        fetchDeliveryZones(),
        fetchBankAccounts(),
      ])

      if (chanRes.status === 'fulfilled' && chanRes.value && chanRes.value.length > 0) {
        setChannels(chanRes.value)
        const defaultChan =
          chanRes.value.find(c => c.is_default || c.isDefault) ??
          chanRes.value.find(
            c => c.name.toLowerCase().includes('facebook') && c.name.toLowerCase().includes('kc shop')
          ) ?? chanRes.value[0]
        setActiveChannel(defaultChan)
        setValue('channelId', defaultChan.id, { shouldValidate: true })
      } else {
        setChannels([])
      }

      if (compRes.status === 'fulfilled' && compRes.value.success && Array.isArray(compRes.value.data)) {
        setDeliveryCompanies(compRes.value.data)
        const defComp = compRes.value.data.find(c => c.isDefault) ?? compRes.value.data[0]
        if (defComp && !hasSetDefaults.current) {
          setSelectedDeliveryCompany(defComp.name)
        }
      }

      if (zoneRes.status === 'fulfilled' && zoneRes.value.success && Array.isArray(zoneRes.value.data)) {
        setDeliveryZones(zoneRes.value.data)
        const defZone = zoneRes.value.data.find(z => z.isDefault) ?? zoneRes.value.data[0]
        if (defZone && !hasSetDefaults.current) {
          setSelectedDeliveryZone(defZone)
        }
      }

      if (bankRes.status === 'fulfilled' && bankRes.value.success && Array.isArray(bankRes.value.data)) {
        setBankAccounts(bankRes.value.data)
        const defBank = bankRes.value.data.find(b => b.isDefault) ?? bankRes.value.data[0]
        if (defBank && !hasSetDefaults.current) {
          setSelectedBank(defBank)
        }
      }

      hasSetDefaults.current = true
    } catch {
      setProducts([])
      setChannels([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [setValue])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Derive dynamic list of categories from DB and loaded products
  const availableCategories = useMemo(() => {
    const list = ['All']
    categories.forEach(c => {
      if (c && !list.includes(c)) list.push(c)
    })
    products.forEach(p => {
      const cat = p.category?.name
      if (cat && !list.includes(cat)) list.push(cat)
    })
    return list
  }, [categories, products])

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase()
    const cat = selectedCategory.toLowerCase()
    return products.filter(product => {
      // Inactive products (and their variants) are hidden from sale
      if (product.is_active === false) return false

      const matchCat =
        selectedCategory === 'All' ||
        (product.category?.name && product.category.name.toLowerCase() === cat)

      const matchSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (product.barcode && product.barcode.toLowerCase().includes(q)) ||
        product.variants?.some(
          v =>
            (v.barcode && v.barcode.toLowerCase().includes(q)) ||
            (v.sku && v.sku.toLowerCase().includes(q)) ||
            (v.name && v.name.toLowerCase().includes(q))
        )

      return matchCat && matchSearch
    }).map(product => ({
      ...product,
      // Strip inactive variants so they can't be added to the cart
      variants: product.variants?.filter(v => v.is_active !== false),
    }))
  }, [products, selectedCategory, debouncedSearchQuery])

  // Memoized picker data for ListPickerModal
  const channelPickerItems = useMemo<PickerItem[]>(() => 
    channels.filter(c => c.is_active !== false).map(chan => {
      const meta = getChannelPlatformMeta(chan)
      return {
        id: chan.id,
        title: chan.name,
        subtitle: `${chan.code ? `[${chan.code}] • ` : ''}${meta.label}`,
        icon: meta.icon,
        iconColor: meta.color,
        iconBg: meta.bg,
      }
    }),
    [channels]
  )

  const deliveryCompanyPickerItems = useMemo<PickerItem[]>(() =>
    deliveryCompanies.map(comp => ({
      id: comp.id,
      title: comp.name,
      subtitle: `${comp.phone ? `${comp.phone} • ` : ''}${comp.isDefault ? 'Default Logistics' : 'Express Delivery'}`,
      icon: (comp as any).logoIcon || 'car',
      iconColor: (comp as any).color || tokens.colors.primaryContainer,
      iconBg: `${(comp as any).color || tokens.colors.primaryContainer}18`,
    })),
    [deliveryCompanies]
  )

  const deliveryZonePickerItems = useMemo<PickerItem[]>(() => [
    ...deliveryZones.map(zone => ({
      id: zone.id,
      title: zone.name,
      subtitle: `${(parseFloat(String(zone.cost || '0')) || 0).toFixed(2)} delivery fee`,
      icon: 'map',
      iconColor: tokens.colors.primaryContainer,
    })),
    {
      id: 'custom',
      title: 'Custom Negotiation',
      subtitle: 'Manual negotiated input',
      icon: 'create-outline',
      iconColor: tokens.colors.primaryContainer,
    },
  ], [deliveryZones])

  const bankPickerItems = useMemo<PickerItem[]>(() =>
    bankAccounts.map(bank => ({
      id: bank.id,
      title: bank.bankName,
      subtitle: `${bank.accountName} \u2022 ${bank.accountNumber}`,
      icon: 'business',
      iconColor: tokens.colors.primaryContainer,
    })),
    [bankAccounts]
  )

  const handleSelectChannel = useCallback((item: PickerItem) => {
    const chan = channels.find(c => c.id === item.id)
    if (chan) {
      setActiveChannel(chan)
      setValue('channelId', chan.id, { shouldValidate: true })
    }
    setChannelPickerOpen(false)
  }, [channels, setValue])

  const handleSelectDeliveryCompany = useCallback((item: PickerItem) => {
    setSelectedDeliveryCompany(item.title)
    setDeliveryPickerOpen(false)
  }, [])

  const handleSelectDeliveryZone = useCallback((item: PickerItem) => {
    if (item.id === 'custom') {
      setSelectedDeliveryZone({ id: 'custom', name: 'Custom Negotiation', cost: 0, isActive: true } as DeliveryZone)
    } else {
      const zone = deliveryZones.find(z => z.id === item.id)
      if (zone) setSelectedDeliveryZone(zone)
    }
    setDeliveryZonePickerOpen(false)
  }, [deliveryZones])

  const handleSelectBank = useCallback((item: PickerItem) => {
    const bank = bankAccounts.find(b => b.id === item.id)
    if (bank) setSelectedBank(bank)
    setBankPickerOpen(false)
  }, [bankAccounts])

  // Cart quantity map per product (variantId -> qty lookup, O(cart + products))
  const productCartQtyMap = useMemo(() => {
    const variantQty = new Map<string, number>()
    for (const item of cart) {
      variantQty.set(item.variantId, (variantQty.get(item.variantId) || 0) + item.quantity)
    }

    const map: Record<string, number> = {}
    for (const p of products) {
      let qty = 0
      if (p.variants) {
        for (const v of p.variants) {
          qty += variantQty.get(v.id) || 0
        }
      }
      qty += variantQty.get(p.id) || 0
      if (qty > 0) map[p.id] = qty
    }
    return map
  }, [cart, products])

  // Keep latest cart/handlers in refs so card handlers stay referentially stable
  const cartRef = useRef(cart)
  cartRef.current = cart
  const addToCartRef = useRef<(product: Product) => void>(() => {})

  // Product Card handlers
  const handleAddToCart = useCallback((product: Product) => {
    const totalStock =
      product.variants && product.variants.length > 0
        ? product.variants.reduce((sum, v) => sum + (v.quantity_on_hand ?? 0), 0)
        : (product as { quantity_on_hand?: number }).quantity_on_hand ?? 0

    if (totalStock <= 0) {
      return
    }

    if (!product.variants || product.variants.length === 0) {
      const stock = (product as { quantity_on_hand?: number }).quantity_on_hand ?? 0
      if (stock <= 0) return

      const scannedVar: ScannedVariant = {
        id: product.id,
        sku: product.sku,
        barcode: product.barcode ?? null,
        quantity_on_hand: stock,
        selling_price: String(product.selling_price),
        selling_price_override: null,
      }
      addVariantToCart(scannedVar, product.name, product.image_url)
      return
    }

    if (product.variants.length === 1) {
      const v = product.variants[0]
      if ((v.quantity_on_hand ?? 0) <= 0) {
        return
      }
      const scannedVar: ScannedVariant = {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode ?? null,
        quantity_on_hand: v.quantity_on_hand ?? 0,
        selling_price: v.selling_price_override || v.selling_price || String(product.selling_price),
        selling_price_override: null,
        attribute_values: v.attribute_values,
      }
      addVariantToCart(scannedVar, product.name, product.image_url)
    } else {
      // Multi-variant product -> open variant picker modal
      const scannedProd: ScannedProduct = {
        id: product.id,
        name: product.name,
        selling_price: String(product.selling_price),
        barcode: product.barcode,
        image_url: product.image_url,
      }
      const scannedVars: ScannedVariant[] = product.variants.map(v => ({
        id: v.id,
        product_id: product.id,
        sku: v.sku,
        barcode: v.barcode ?? null,
        quantity_on_hand: v.quantity_on_hand ?? 0,
        selling_price: v.selling_price_override || v.selling_price || String(product.selling_price),
        selling_price_override: null,
        attribute_values: v.attribute_values,
      }))
      setPickerProduct(scannedProd)
      setPickerVariants(scannedVars)
      setPickerOpen(true)
    }
  }, [addVariantToCart])

  addToCartRef.current = handleAddToCart

  const findCartItemForProduct = (product: Product) =>
    cartRef.current.find(
      ci => product.variants?.some(v => v.id === ci.variantId) || product.id === ci.variantId
    )

  const handleIncreaseProduct = useCallback((product: Product) => {
    const cartItem = findCartItemForProduct(product)
    if (cartItem) {
      if (cartItem.availableStock > 0 && cartItem.quantity < cartItem.availableStock) {
        updateQuantity(cartItem.variantId, 1)
      }
    } else {
      addToCartRef.current(product)
    }
  }, [updateQuantity])

  const handleDecreaseProduct = useCallback((product: Product) => {
    const cartItem = findCartItemForProduct(product)
    if (cartItem) {
      updateQuantity(cartItem.variantId, -1)
    }
  }, [updateQuantity])

  const handlePressProduct = handleAddToCart

  // Barcode Scan Handler
  const handleScanCode = useCallback(async (code: string) => {
    if (scanLoading || code === lastScannedCode.current) return
    lastScannedCode.current = code
    setScanLoading(true)

    try {
      const result = await scanBarcode(code)
      if (result.type === 'variant' && result.variant) {
        // Blocked sale: deactivated product or variant
        if (result.variant.is_active === false || result.product?.is_active === false) {
          setScannerOpen(false)
          Alert.alert(
            'Product Deactivated',
            `"${result.variant.name || result.variant.sku}" is currently deactivated and cannot be sold.\n\nPlease reactivate it in Products → Product Overview before selling.`
          )
          return
        }
        addVariantToCart(result.variant, result.product?.name ?? 'Product', result.product?.image_url)
        setScannerOpen(false)
      } else if (result.type === 'product' && result.variants && result.variants.length > 0) {
        if (result.product?.is_active === false) {
          setScannerOpen(false)
          Alert.alert(
            'Product Deactivated',
            `"${result.product.name}" is currently deactivated and cannot be sold.\n\nPlease reactivate it in Products → Product Overview before selling.`
          )
          return
        }
        // Only offer active variants in the picker
        const activeVariants = result.variants.filter((v) => v.is_active !== false)
        if (activeVariants.length === 0) {
          setScannerOpen(false)
          Alert.alert(
            'Product Deactivated',
            `All variants of "${result.product.name}" are currently deactivated.\n\nPlease reactivate them in Products → Product Overview before selling.`
          )
          return
        }
        setPickerProduct(result.product)
        setPickerVariants(activeVariants)
        setScannerOpen(false)
        setPickerOpen(true)
      } else {
        Alert.alert('Scan Result', `No product found matching code "${code}"`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scan item.'
      Alert.alert('Scan Result', msg)
    } finally {
      setScanLoading(false)
      setTimeout(() => {
        lastScannedCode.current = ''
      }, 1200)
    }
  }, [scanLoading, addVariantToCart])

const executeCheckout = async (data: PosCheckoutFormValues) => {
    if (checkoutLoading) return

    if (hasOutOfStockItems || cart.some(item => item.availableStock <= 0 || item.quantity > item.availableStock)) {
      Alert.alert(
        'Stock Unavailable',
        'One or more items in your cart are out of stock or exceed available stock. Please adjust quantities before completing checkout.'
      )
      return
    }

    setCheckoutLoading(true)

    const channelId = data.channelId || activeChannel?.id || channels[0]?.id
    if (!channelId) {
      Alert.alert('Configuration Error', 'No sales channel available. Please check your settings.')
      setCheckoutLoading(false)
      return
    }
    const mutationId = Crypto.randomUUID()

    const parsedDiscount = parseFloat(data.discountInput || '0') || 0
    const discountType = data.discountType || 'flat'
    const parsedTax = parseFloat(data.taxInput || data.taxRate || '0') || 0
    const taxType = data.taxType || 'flat'
    const deliveryCost = (() => {
      if (!isDelivery || !selectedDeliveryZone) return 0
      if (selectedDeliveryZone.id === 'custom') {
        return round2(parseFloat(data.customDeliveryFee || '0') || 0)
      }
      return selectedDeliveryZone.cost
    })()
    let subtotal = cartTotal

    // Calculate subtotal from cart
    if (cart.length > 0) {
      subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    }

    const discountAmount = round2(
      discountType === 'percentage'
        ? subtotal * (parsedDiscount / 100)
        : parsedDiscount
    )

    const taxAmount = round2(
      taxType === 'percentage'
        ? subtotal * (parsedTax / 100)
        : parsedTax
    )

    const taxRate = round2(
      taxType === 'percentage'
        ? parsedTax
        : (subtotal > 0 ? (taxAmount / subtotal) * 100 : 0)
    )

    const finalTotal = round2(Math.max(0, subtotal - discountAmount + deliveryCost + taxAmount))

    const payload: CheckoutPayload = {
      client_mutation_id: mutationId,
      channel_id: channelId,
      items: cart.map(item => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      payment_method: activePaymentMethod === 'Bank' ? `${selectedBank?.bankName || 'Bank'} Transfer` : 'Cash',
      payment_amount: finalTotal,
      customer: phone.trim()
        ? {
            name: name.trim() || phone.trim(),
            phone: phone.trim(),
          }
        : undefined,
      delivery_company: isDelivery ? selectedDeliveryCompany : undefined,
      delivery_address: isDelivery && data.deliveryAddress?.trim() ? data.deliveryAddress.trim() : undefined,
      delivery_cost: isDelivery ? deliveryCost : undefined,
      region: isDelivery ? selectedDeliveryZone?.name : undefined,
      discount: discountAmount,
      tax_type: taxType,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      status: data.orderStatus || 'paid',
    }

    try {
      const order = await checkoutOrder(payload)
      setCompletedOrder(order)
      setCheckoutSheetOpen(false)
      handleSetCheckoutStep(1)
      clearCart()
      resetCustomer()
      setValue('discountInput', '')
      setValue('taxInput', '')
      setValue('deliveryAddress', '')
      setReceiptOpen(true)
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
      loadData()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Checkout failed.'
      if ((err as any).isNetworkError) {
        enqueueMutation(payload)
        Alert.alert(
          'Saved Offline',
          'Network connection unavailable. Order has been saved to offline queue and will sync automatically.',
          [
            {
              text: 'OK',
              onPress: () => {
                setCheckoutSheetOpen(false)
                handleSetCheckoutStep(1)
                clearCart()
                resetCustomer()
                setValue('discountInput', '')
                setValue('discountType', 'flat')
                setValue('taxInput', '')
                setValue('taxType', 'flat')
                setValue('orderStatus', 'paid')
                setValue('deliveryAddress', '')
              },
            },
          ]
        )
      } else {
        Alert.alert('Checkout Error', errMsg)
      }
    } finally {
      setCheckoutLoading(false)
      setActivePaymentMethod('Cash')
    }
  }

  const handleNewSale = () => {
    setReceiptOpen(false)
    setCompletedOrder(null)
    clearCart()
    resetCustomer()
    setValue('discountInput', '')
    setValue('discountType', 'flat')
    setValue('taxInput', '')
    setValue('taxType', 'flat')
    setValue('orderStatus', 'paid')
    setValue('deliveryAddress', '')
  }

  const handleOpenScannerUnified = () => {
    if (propOpenScanner) {
      propOpenScanner()
    } else {
      setScannerOpen(true)
    }
  }

  const renderProductCard = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      cartQuantity={productCartQtyMap[item.id] || 0}
      mode="sales"
      onAddToCart={handleAddToCart}
      onIncrease={handleIncreaseProduct}
      onDecrease={handleDecreaseProduct}
      onPress={handlePressProduct}
    />
  ), [productCartQtyMap, handleAddToCart, handleIncreaseProduct, handleDecreaseProduct, handlePressProduct])

  return (
    <View style={styles.container}>
      {Boolean(!checkoutSheetOpen) && (
        <>
          {/* Animated Collapsible Header (Search Bar + Category Filter Pills) */}
          <Animated.View
            onLayout={onLayoutHeader}
            style={[
              styles.collapsibleHeaderWrap,
              {
                transform: [{ translateY: headerTranslateY }],
                opacity: headerOpacity,
              },
            ]}
          >
            {/* Sticky Header: Search Bar */}
            <View style={styles.header}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={tokens.colors.secondary} />
                <TextInput
                  testID="input-pos-search"
                  style={styles.searchInput}
                  placeholder="Search product, category, SKU, barcode..."
                  placeholderTextColor={tokens.colors.textDisabled}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {Boolean(searchQuery.length > 0) && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={tokens.colors.secondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Category Horizontal Filter Pills */}
            <View style={styles.categoriesWrapper}>
              <FlatList
                horizontal
                data={availableCategories}
                keyExtractor={item => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesList}
                renderItem={({ item }) => {
                  const isSelected = selectedCategory === item
                  return (
                    <TouchableOpacity
                      testID={`btn-filter-${item.toLowerCase()}`}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(item)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )
                }}
              />
            </View>
          </Animated.View>

          {/* 2-Column Fast Product Catalog Grid */}
          <View style={styles.gridContainer}>
            {isLoadingProducts ? (
              <View style={[styles.loadingContainer, { paddingTop: headerHeight + 20 }]}>
                <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
                <Text style={styles.loadingText}>Loading register catalog...</Text>
              </View>
            ) : filteredProducts.length === 0 ? (
              <View style={[styles.emptyContainer, { paddingTop: headerHeight + 30 }]}>
                <Ionicons name="search-outline" size={48} color={tokens.colors.secondary} />
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySub}>
                  Try adjusting your search terms or category filters.
                </Text>
              </View>
            ) : (
              <Animated.FlatList
                data={filteredProducts}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={[styles.gridContent, { paddingTop: headerHeight + 8 }]}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={renderProductCard}
              />
            )}
          </View>

      {/* Floating Sticky Bottom Cart Summary Bar (Visible when Cart Has Items) */}
      {totalItemCount > 0 && (
        <View style={styles.floatingCartBar}>
          <TouchableOpacity
            testID="btn-open-checkout-sheet"
            style={styles.floatingCartInner}
            onPress={() => setCheckoutSheetOpen(true)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`View Cart: ${totalItemCount} items, Total: $${cartTotal.toFixed(2)}`}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.floatingCountBadge}>
                <Text style={styles.floatingCountText}>{totalItemCount}</Text>
              </View>
              <View>
                <Text style={styles.floatingTotalLabel}>Total Amount</Text>
                <Text style={styles.floatingTotalValue}>${cartTotal.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.floatingCheckoutCta}>
              <Text style={styles.floatingCheckoutText}>Checkout</Text>
              <Ionicons name="chevron-forward" size={18} color={tokens.colors.onPrimary} />
            </View>
          </TouchableOpacity>
        </View>
      )}
        </>
      )}

      {/* Full-Screen Checkout Screen */}
      {Boolean(checkoutSheetOpen) && (
        <View style={styles.checkoutSheetSafeArea}>
          <View style={styles.checkoutSheetContainer}>
            {/* Header */}
            <View style={styles.checkoutSheetHeader}>
              <View style={styles.checkoutSheetHeaderTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {checkoutStep > 1 && (
                    <TouchableOpacity
                      onPress={() => handleSetCheckoutStep((checkoutStep - 1) as 1 | 2 | 3)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="arrow-back" size={24} color={tokens.colors.onBackground} />
                    </TouchableOpacity>
                  )}
                  <View>
                    <Text style={styles.checkoutSheetTitle}>
                      {checkoutStep === 1 ? 'Current Sale' : checkoutStep === 2 ? 'Checkout Details' : 'Order Summary'}
                    </Text>
                    <Text style={styles.checkoutSheetSub}>
                      {checkoutStep === 1
                        ? `${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'} in cart`
                        : checkoutStep === 2 
                        ? 'Fulfillment & Discounts' 
                        : 'Review & Confirm'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="btn-close-checkout-sheet"
                  style={styles.closeSheetBtn}
                  onPress={() => {
                    setCheckoutSheetOpen(false)
                    handleSetCheckoutStep(1)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close checkout sheet"
                >
                  <Ionicons name="close" size={20} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>
              
              {/* Stepper Indicator */}
              <View style={styles.stepperContainer}>
                <View style={[styles.stepDot, checkoutStep >= 1 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, checkoutStep >= 1 && styles.stepDotTextActive]}>1</Text>
                </View>
                <View style={[styles.stepLine, checkoutStep >= 2 && styles.stepLineActive]} />
                <View style={[styles.stepDot, checkoutStep >= 2 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, checkoutStep >= 2 && styles.stepDotTextActive]}>2</Text>
                </View>
                <View style={[styles.stepLine, checkoutStep >= 3 && styles.stepLineActive]} />
                <View style={[styles.stepDot, checkoutStep >= 3 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, checkoutStep >= 3 && styles.stepDotTextActive]}>3</Text>
                </View>
              </View>
            </View>

            {/* Cart Items List - Step 1 */}
            {checkoutStep === 1 && (
              <View style={styles.cartListContainer}>
                <CartList
                  cart={cart}
                  stockWarnings={stockWarnings}
                  onIncrease={id => updateQuantity(id, 1)}
                  onDecrease={id => updateQuantity(id, -1)}
                  onRemove={removeFromCart}
                  onSetQuantity={setItemQuantity}
                  onClearCart={clearCart}
                />
              </View>
            )}

            {/* Step 2 Content */}
            {checkoutStep === 2 && (
              <CheckoutStep2Form
                scrollRef={step2ScrollRef}
                control={control}
                setValue={setValue}
                errors={errors}
                channels={channels}
                activeChannel={activeChannel}
                channelId={watch('channelId')}
                onOpenChannelPicker={() => setChannelPickerOpen(true)}
                phone={phone}
                name={name}
                setPhone={setPhone}
                setName={setName}
                matchedCustomer={matchedCustomer}
                customerSuggestions={customerSuggestions}
                customerLookupStatus={customerLookupStatus}
                loyaltyInfo={loyaltyInfo}
                onSelectCustomer={handleSelectCustomer}
                dismissSuggestions={dismissSuggestions}
                onResetCustomer={handleResetCustomer}
                isDelivery={isDelivery}
                deliveryCompanies={deliveryCompanies}
                selectedDeliveryCompany={selectedDeliveryCompany}
                onOpenDeliveryPicker={() => setDeliveryPickerOpen(true)}
                deliveryZones={deliveryZones}
                selectedDeliveryZone={selectedDeliveryZone}
                onOpenDeliveryZonePicker={() => setDeliveryZonePickerOpen(true)}
                discountType={discountType}
                taxType={taxType}
                activePaymentMethod={activePaymentMethod}
                setActivePaymentMethod={setActivePaymentMethod}
                selectedBank={selectedBank}
                onOpenBankPicker={() => setBankPickerOpen(true)}
              />
            )}

            {/* Step 3 Content (Summary) */}
            {checkoutStep === 3 && (
              <CheckoutStep3Summary
                cart={cart}
                cartTotal={cartTotal}
                totalItemCount={totalItemCount}
                discountType={discountType}
                discountInput={discountInput}
                taxType={taxType}
                taxInput={taxInput}
                taxRate={taxRate}
                isDelivery={isDelivery}
                selectedDeliveryZone={selectedDeliveryZone}
                customDeliveryFee={customDeliveryFee}
                channels={channels}
                activeChannel={activeChannel}
                channelId={watch('channelId')}
                customerName={watch('customerName')}
                customerPhone={watch('customerPhone')}
                deliveryAddress={watch('deliveryAddress')}
                activePaymentMethod={activePaymentMethod}
                selectedBank={selectedBank}
                orderStatus={orderStatus as 'paid' | 'pending'}
                onSetOrderStatus={(status: 'paid' | 'pending') => setValue('orderStatus', status)}
              />
            )}

            {/* Bottom Action Bar */}
            {checkoutStep === 1 && (
              <View style={styles.stepOneActionContainer}>
                <TouchableOpacity
                  style={[
                    styles.continueToDetailsBtn,
                    (cart.length === 0 || hasOutOfStockItems) && styles.continueToDetailsBtnDisabled,
                  ]}
                  onPress={() => handleSetCheckoutStep(2)}
                  disabled={cart.length === 0 || hasOutOfStockItems}
                >
                  <Text style={styles.continueToDetailsText}>
                    {hasOutOfStockItems ? 'Resolve Stock Warnings to Proceed' : 'Next: Checkout Details'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={tokens.colors.onPrimary} />
                </TouchableOpacity>
              </View>
            )}

            {checkoutStep === 2 && (
              <View style={styles.stepOneActionContainer}>
                <TouchableOpacity
                  style={styles.continueToDetailsBtn}
                  onPress={async () => {
                    const isValid = await trigger()
                    if (isValid) {
                      handleSetCheckoutStep(3)
                    }
                  }}
                >
                  <Text style={styles.continueToDetailsText}>Review Summary</Text>
                  <Ionicons name="arrow-forward" size={20} color={tokens.colors.onPrimary} />
                </TouchableOpacity>
              </View>
            )}

            {checkoutStep === 3 && (
              <View style={styles.stepThreeActionContainer}>
                <TouchableOpacity
                  style={styles.stepThreeBackBtn}
                  onPress={() => handleSetCheckoutStep(2)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-back" size={16} color={tokens.colors.onBackground} />
                  <Text style={styles.stepThreeBackText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.stepThreeConfirmBtn,
                    {
                      backgroundColor: orderStatus === 'pending' ? '#D97706' : tokens.colors.statusSuccess
                    }
                  ]}
                  onPress={handleSubmit(executeCheckout)}
                  disabled={checkoutLoading}
                  activeOpacity={0.85}
                >
                  {checkoutLoading ? (
                    <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons
                        name={orderStatus === 'pending' ? 'time' : 'checkmark-circle'}
                        size={18}
                        color={tokens.colors.onPrimary}
                      />
                      <Text style={styles.stepThreeConfirmText} numberOfLines={1}>
                        {orderStatus === 'pending' ? 'Confirm (Pending)' : 'Confirm (Paid)'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanCode={handleScanCode}
        isLoading={scanLoading}
      />

      {/* Variant Picker Modal */}
      <VariantPickerModal
        visible={pickerOpen}
        product={pickerProduct}
        variants={pickerVariants}
        onAddMultipleVariants={items => {
          if (pickerProduct) {
            const itemsToAdd = items.map(({ variant, quantity }) => {
              const rawPrice = variant.selling_price_override ?? variant.selling_price ?? variant.product?.selling_price ?? pickerProduct.selling_price ?? '0'
              const unitPrice = parseFloat(String(rawPrice)) || 0
              const availableStock = variant.quantity_on_hand ?? 0
              const attrs = variant.attribute_values?.map(av => `${av.attribute?.name ? av.attribute.name + ': ' : ''}${av.value_name}`).join(', ')
              return {
                variantId: variant.id,
                sku: variant.sku,
                productName: pickerProduct.name,
                quantity,
                unitPrice,
                availableStock,
                imageUrl: pickerProduct.image_url,
                attributesSummary: attrs || undefined,
              }
            })
            addMultipleItemsToCart(itemsToAdd)
          }
          setPickerOpen(false)
          setPickerProduct(null)
        }}
        onSelectVariant={variant => {
          if (pickerProduct) {
            addVariantToCart(variant, pickerProduct.name, pickerProduct.image_url)
          }
          setPickerOpen(false)
          setPickerProduct(null)
        }}
        onClose={() => {
          setPickerOpen(false)
          setPickerProduct(null)
        }}
      />

      {/* Order Confirmation Receipt Modal */}
      <OrderReceiptModal
        visible={receiptOpen}
        order={completedOrder}
        matchedCustomer={matchedCustomer}
        onNewSale={handleNewSale}
        onNavigateSettings={() => onNavigate?.('settings')}
        onUpdateStatus={handleUpdateOrderStatus}
        onUpdateOrder={handleUpdateOrder}
      />

      {/* Sales Channel Picker */}
      <ListPickerModal
        visible={channelPickerOpen}
        onClose={() => setChannelPickerOpen(false)}
        title="Select Sales Channel"
        titleIcon="share-social"
        items={channelPickerItems}
        selectedId={watch('channelId') || activeChannel?.id}
        onSelect={handleSelectChannel}
      />

      {/* Delivery Service Picker */}
      <ListPickerModal
        visible={deliveryPickerOpen}
        onClose={() => setDeliveryPickerOpen(false)}
        title="Select Delivery Service"
        titleIcon="car-outline"
        items={deliveryCompanyPickerItems}
        selectedId={deliveryCompanies.find(c => c.name === selectedDeliveryCompany)?.id}
        onSelect={handleSelectDeliveryCompany}
      />

      {/* Delivery Zone Picker */}
      <ListPickerModal
        visible={deliveryZonePickerOpen}
        onClose={() => setDeliveryZonePickerOpen(false)}
        title="Select Delivery Zone"
        titleIcon="map-outline"
        items={deliveryZonePickerItems}
        selectedId={selectedDeliveryZone?.id}
        onSelect={handleSelectDeliveryZone}
      />

      {/* Bank Picker */}
      <ListPickerModal
        visible={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        title="Select Bank"
        titleIcon="business-outline"
        items={bankPickerItems}
        selectedId={selectedBank?.id}
        onSelect={handleSelectBank}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  collapsibleHeaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: tokens.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.background,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: tokens.spacing.md,
    height: 44,
    gap: 8,
    ...tokens.shadows.cardInnerDepth,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.body.fontSize,
    paddingVertical: 0,
  },

  categoriesWrapper: {
    paddingVertical: tokens.spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  categoriesList: {
    paddingHorizontal: tokens.spacing.md,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.primaryFixed,
    borderColor: tokens.colors.primaryContainer,
  },
  categoryChipText: {
    color: tokens.colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: tokens.colors.primary,
  },
  gridContainer: {
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  gridContent: {
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xxl + 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  loadingText: {
    color: tokens.colors.secondary,
    fontSize: 12,
    marginTop: tokens.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  emptyTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    marginTop: tokens.spacing.sm,
  },
  emptySub: {
    color: tokens.colors.secondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: tokens.spacing.md,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    zIndex: 50,
  },
  floatingCartInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceInverse,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
    ...tokens.shadows.floatingCart,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  floatingCountBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCountText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  floatingTotalLabel: {
    color: tokens.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  floatingTotalValue: {
    color: tokens.colors.surfaceBase,
    fontSize: tokens.typography.priceDisplay.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  floatingCheckoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  floatingCheckoutText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  checkoutSheetSafeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  checkoutSheetContainer: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  checkoutSheetHeader: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.background,
  },
  checkoutSheetHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkoutSheetTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineLarge ? tokens.typography.headlineLarge.fontSize : 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  checkoutSheetSub: {
    color: tokens.colors.secondary,
    fontSize: 12,
  },
  closeSheetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartListContainer: {
    flex: 1,
  },













  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  stepDotTextActive: {
    color: tokens.colors.onPrimary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: tokens.colors.surfaceMuted,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },



























  // Delivery Fulfillment Section Styles
























  stepOneActionContainer: {
    padding: tokens.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 24 : tokens.spacing.md,
    backgroundColor: 'transparent',
  },
  continueToDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
  },
  continueToDetailsBtnDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.6,
  },
  continueToDetailsText: {
    color: tokens.colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  stepThreeActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 24 : tokens.spacing.md,
    gap: 10,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  stepThreeBackBtn: {
    width: 85,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  stepThreeBackText: {
    color: tokens.colors.onBackground,
    fontSize: 14,
    fontWeight: '700',
  },
  stepThreeConfirmBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 12,
    gap: 6,
    ...tokens.shadows.card,
  },
  stepThreeConfirmText: {
    color: tokens.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  // Channel Selection in Checkout Sheet








  // Dropdown Styles for Channel & Delivery Picker







})

