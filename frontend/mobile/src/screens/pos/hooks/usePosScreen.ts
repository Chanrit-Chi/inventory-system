import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Alert, LayoutAnimation, Animated, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import * as Crypto from 'expo-crypto'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../api/queryKeys'
import {
  getProducts,
  getSalesChannels,
  checkoutOrder,
  fetchDeliveryCompanies,
  fetchDeliveryZones,
  fetchBankAccounts,
  fetchCategories,
  fetchStaffMembers,
  updateOrderStatus,
  updateOrder,
} from '../../../api/endpoints'
import { useAuth } from '../../../context/AuthContext'
import { useProducts } from '../../../hooks/queries/useProductsQuery'
import { useCart } from '../../../hooks/useCart'
import { useBarcodeScan } from '../../../hooks/useBarcodeScan'
import { useCustomerLookup } from '../../../hooks/useCustomerLookup'
import { useOfflineQueue } from '../../../hooks/useOfflineQueue'
import { useDebounce } from '../../../hooks/useDebounce'
import { useCollapsibleHeader } from '../../../hooks/useCollapsibleHeader'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { posCheckoutSchema, type PosCheckoutFormValues } from '../../../utils/validation'
import { round2 } from '../../../utils/money'
import type {
  Product,
  ScannedProduct,
  ScannedVariant,
  SalesChannel,
  CheckoutPayload,
  Order,
  BankAccount,
  DeliveryCompany,
  DeliveryZone,
  Customer,
  CartItem,
  UserAccount,
} from '../../../types'
import type { ScanResult } from '../../../types'
import type { CustomerLoyaltyInfo } from '../../../hooks/useCustomerLookup'
import { useAppActions } from '../../../context/AppContext'

interface UsePosScreenProps {
  onNavigate?: (tab: import('../../../types').TabType) => void
  onOpenScanner?: () => void
  onOpenSidebar?: () => void
  cartHook?: ReturnType<typeof useCart>
  offlineQueueHook?: ReturnType<typeof useOfflineQueue>
  onCheckoutStateChange?: (isActive: boolean) => void
}

interface UsePosScreenReturn {
  // Search & Category
  searchQuery: string
  setSearchQuery: (s: string) => void
  debouncedSearchQuery: string
  selectedCategory: string
  setSelectedCategory: (c: string) => void
  categories: string[]

  // Collapsible Header
  headerTranslateY: Animated.AnimatedInterpolation<number>
  headerOpacity: Animated.AnimatedInterpolation<number>
  onScroll: (event: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void
  onLayoutHeader: (e: LayoutChangeEvent) => void
  headerHeight: number

  // Products
  products: Product[]
  filteredProducts: Product[]
  isLoadingProducts: boolean
  productsError: string | null
  refreshing: boolean
  setRefreshing: (v: boolean) => void
  onRefresh: () => Promise<void>

  // Channels
  channels: SalesChannel[]
  activeChannel: SalesChannel | null
  setActiveChannel: (c: SalesChannel | null) => void

  // Scanner & Variant Picker
  scannerOpen: boolean
  setScannerOpen: (v: boolean) => void
  scanLoading: boolean
  scanFeedback?: any
  pickerOpen: boolean
  setPickerOpen: (v: boolean) => void
  pickerProduct: ScannedProduct | null
  pickerVariants: ScannedVariant[]
  setPickerProduct: (p: ScannedProduct | null) => void
  setPickerVariants: (v: ScannedVariant[]) => void
  handleScanCode: (code: string) => Promise<ScanResult | null>
  handleSelectProduct: (product: Product) => void

  // Checkout
  checkoutSheetOpen: boolean
  setCheckoutSheetOpen: (v: boolean) => void
  checkoutStep: 1 | 2 | 3
  handleSetCheckoutStep: (step: 1 | 2 | 3) => void
  receiptOpen: boolean
  setReceiptOpen: (v: boolean) => void
  completedOrder: Order | null
  setCompletedOrder: (o: Order | null) => void
  checkoutLoading: boolean
  activePaymentMethod: string
  setActivePaymentMethod: (m: string) => void
  formMethods: ReturnType<typeof useForm<PosCheckoutFormValues>>
  isDelivery: boolean
  executeCheckout: (data: PosCheckoutFormValues) => Promise<void>
  handleNewSale: () => void

  // Bank Selection
  bankAccounts: BankAccount[]
  selectedBank: BankAccount | null
  setSelectedBank: (b: BankAccount | null) => void

  // Pickers
  channelPickerOpen: boolean
  setChannelPickerOpen: (v: boolean) => void
  deliveryPickerOpen: boolean
  setDeliveryPickerOpen: (v: boolean) => void
  deliveryZonePickerOpen: boolean
  setDeliveryZonePickerOpen: (v: boolean) => void
  bankPickerOpen: boolean
  setBankPickerOpen: (v: boolean) => void
  sellerPickerOpen: boolean
  setSellerPickerOpen: (v: boolean) => void
  staffUsers: UserAccount[]
  selectedSeller: UserAccount | null
  setSelectedSeller: (u: UserAccount | null) => void
  handleSelectSeller: (u: UserAccount) => void
  handleResetSellerToMe: () => void
  currentUser: UserAccount | null

  // Delivery & Logistics
  deliveryCompanies: DeliveryCompany[]
  selectedDeliveryCompany: string
  setSelectedDeliveryCompany: (s: string) => void
  deliveryZones: DeliveryZone[]
  selectedDeliveryZone: DeliveryZone | null
  setSelectedDeliveryZone: (d: DeliveryZone | null) => void

  // Cart
  cart: CartItem[]
  addVariantToCart: (variant: ScannedVariant, productName: string, productImageUrl?: string | null) => void
  addMultipleItemsToCart: (items: Array<{
    variantId: string
    sku?: string
    productName: string
    quantity: number
    unitPrice: number
    availableStock?: number
    imageUrl?: string | null
    attributesSummary?: string
  }>) => void
  updateQuantity: (variantId: string, delta: number) => void
  setItemQuantity: (variantId: string, quantity: number) => void
  removeFromCart: (variantId: string) => void
  clearCart: () => void
  cartTotal: number
  totalItemCount: number
  stockWarnings: Record<string, string>
  hasOutOfStockItems: boolean

  // Customer Lookup
  phone: string
  setPhone: (p: string) => void
  name: string
  setName: (n: string) => void
  matchedCustomer: Customer | null
  customerSuggestions: Customer[]
  customerLookupStatus: 'idle' | 'searching' | 'found' | 'not_found' | 'error'
  loyaltyInfo: CustomerLoyaltyInfo | null
  selectCustomer: (c: Customer) => void
  dismissSuggestions: () => void
  resetCustomer: () => void
  handleSelectCustomer: (cust: Customer) => void
  handleResetCustomer: () => void

  // Order actions
  handleUpdateOrderStatus: (orderId: string, status: string, paymentMethod?: string, notes?: string) => Promise<void>
  handleUpdateOrder: (orderId: string, payload: { status?: string; payment_method?: string; notes?: string; delivery_address?: string; region?: string }) => Promise<void>
  handleOpenScannerUnified: () => void

  // Picker items
  channelPickerItems: Array<{ id: string; title: string; subtitle?: string }>
  deliveryCompanyPickerItems: Array<{ id: string; title: string }>
  deliveryZonePickerItems: Array<{ id: string; title: string; subtitle?: string }>
  bankPickerItems: Array<{ id: string; title: string; subtitle?: string }>
}

export function usePosScreen({
  onNavigate,
  onOpenScanner: propOpenScanner,
  onOpenSidebar,
  cartHook: propCartHook,
  offlineQueueHook: propOfflineQueueHook,
  onCheckoutStateChange,
}: UsePosScreenProps): UsePosScreenReturn {
  const queryClient = useQueryClient()
  const appActions = useAppActions()

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

  // Products state & TanStack Query sync
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: queryProducts,
    isLoading: isLoadingQueryProducts,
    error: queryProductsError,
    refetch: refetchProducts,
  } = useProducts({ per_page: 200 })

  // Auto-sync products and categories when query cache updates
  const prevRawProductsRef = useRef<Product[] | undefined>(undefined)
  useEffect(() => {
    if (queryProducts && queryProducts !== prevRawProductsRef.current) {
      prevRawProductsRef.current = queryProducts
      setProducts(queryProducts)
      const cats = Array.from(
        new Set(
          queryProducts
            .map((p) => p.category?.name)
            .filter((c): c is string => Boolean(c))
        )
      )
      setCategories(['All', ...cats])
    }
  }, [queryProducts])

  // Channels state
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<SalesChannel | null>(null)

  // Barcode Scanner & Variant Selection Hook
  const {
    scannerOpen,
    setScannerOpen,
    loading: scanLoading,
    pickerOpen,
    setPickerOpen,
    pickerProduct,
    pickerVariants,
    handleScanCode,
    setPickerProduct,
    setPickerVariants,
    lastFeedback: scanFeedback,
  } = useBarcodeScan({
    mode: 'cart',
    blockInactive: true,
    closeScannerOnFound: false,
    onFoundVariant: (variant, product) => {
      return addVariantToCart(variant, product?.name ?? 'Product', product?.image_url)
    },
  })

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
        seller_id?: string | null
      }
    ) => {
      const updated = await updateOrder(orderId, payload)
      setCompletedOrder((prev) =>
        prev && prev.id === orderId
          ? updated || {
              ...prev,
              notes: payload.notes !== undefined ? payload.notes : prev.notes,
              delivery_address:
                payload.delivery_address !== undefined
                  ? payload.delivery_address
                  : prev.delivery_address,
              region: payload.region !== undefined ? payload.region : prev.region,
              seller_id: payload.seller_id !== undefined ? payload.seller_id : prev.seller_id,
            }
          : prev
      )
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
    },
    [queryClient]
  )

  // Bank Selection State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null)

  const { currentUser } = useAuth()
  const [staffUsers, setStaffUsers] = useState<UserAccount[]>([])
  const [selectedSeller, setSelectedSeller] = useState<UserAccount | null>(currentUser || null)
  const [sellerPickerOpen, setSellerPickerOpen] = useState(false)

  const [channelPickerOpen, setChannelPickerOpen] = useState(false)
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false)
  const [deliveryZonePickerOpen, setDeliveryZonePickerOpen] = useState(false)
  const [bankPickerOpen, setBankPickerOpen] = useState(false)

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

  const formMethods = useForm<PosCheckoutFormValues>({
    resolver: zodResolver(posCheckoutSchema),
    defaultValues: {
      channelId: '',
      sellerId: currentUser?.id || '',
      deliveryAddress: '',
      discountInput: '',
      discountType: 'flat',
      taxInput: '',
      taxType: 'flat',
      taxRate: '0',
      orderStatus: 'paid',
      customDeliveryFee: '',
      isDelivery: false,
      customerName: '',
      customerPhone: '',
    },
  })

  const { setValue, watch } = formMethods
  const isDelivery = watch('isDelivery')

  useEffect(() => {
    if (currentUser && !selectedSeller) {
      setSelectedSeller(currentUser)
      setValue('sellerId', currentUser.id)
    }
  }, [currentUser, selectedSeller, setValue])

  const handleSelectSeller = useCallback(
    (user: UserAccount) => {
      setSelectedSeller(user)
      setValue('sellerId', user.id)
    },
    [setValue]
  )

  const handleResetSellerToMe = useCallback(() => {
    if (currentUser) {
      setSelectedSeller(currentUser)
      setValue('sellerId', currentUser.id)
    }
  }, [currentUser, setValue])

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
    name,
    setPhone,
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
  const { enqueueMutation } = offlineQueue

  const handleSelectCustomer = useCallback((cust: Customer) => {
    selectCustomer(cust)
    setValue('customerName', cust.name, { shouldValidate: true })
    setValue('customerPhone', cust.phone, { shouldValidate: true })
    if (cust.address) {
      setValue('deliveryAddress', cust.address, { shouldValidate: true, shouldDirty: true })
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
        setValue('deliveryAddress', matchedCustomer.address, { shouldValidate: true, shouldDirty: true })
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

      const { discount, customerName, customerPhone, deliveryAddress } = cartHook.checkoutPreset
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
      if (deliveryAddress) {
        setValue('deliveryAddress', deliveryAddress, { shouldValidate: true, shouldDirty: true })
        setValue('isDelivery', true)
      }
    }
  }, [cartHook.checkoutPreset, setValue, setName, setPhone])

  const loadData = useCallback(async () => {
    setIsLoadingProducts(true)
    setProductsError(null)
    try {
      const [prodRes, chanRes, delCoRes, delZnRes, bankRes, catRes, staffRes] = await Promise.allSettled([
        getProducts({ per_page: 200 }),
        getSalesChannels(),
        fetchDeliveryCompanies(),
        fetchDeliveryZones(),
        fetchBankAccounts(),
        fetchCategories(),
        fetchStaffMembers(),
      ])

      if (prodRes.status === 'fulfilled' && prodRes.value?.data) {
        const list = prodRes.value.data
        setProducts(list)
        const cats = Array.from(
          new Set(
            list
              .map((p) => p.category?.name)
              .filter((c): c is string => Boolean(c))
          )
        )
        setCategories(['All', ...cats])
      } else if (prodRes.status === 'rejected') {
        setProductsError('Unable to load products. Please check network.')
      }

      if (chanRes.status === 'fulfilled') {
        const chanList: SalesChannel[] = Array.isArray(chanRes.value)
          ? chanRes.value
          : ((chanRes.value as Record<string, unknown> | null)?.data as SalesChannel[] | null) || []
        setChannels(chanList)
        const defaultChan = chanList.find((c) => c.is_default) || chanList[0] || null
        setActiveChannel(defaultChan)
        if (defaultChan) {
          setValue('channelId', defaultChan.id)
        }
      }

      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value)) {
        setStaffUsers(staffRes.value)
      }

      if (delCoRes.status === 'fulfilled' && delCoRes.value?.data) {
        setDeliveryCompanies(delCoRes.value.data)
        if (delCoRes.value.data.length > 0) {
          setSelectedDeliveryCompany(delCoRes.value.data[0].name)
        }
      }

      if (delZnRes.status === 'fulfilled' && delZnRes.value?.data) {
        setDeliveryZones(delZnRes.value.data)
        if (delZnRes.value.data.length > 0) {
          setSelectedDeliveryZone(delZnRes.value.data[0])
        }
      }

      if (bankRes.status === 'fulfilled' && bankRes.value?.data) {
        setBankAccounts(bankRes.value.data)
        const defBank = bankRes.value.data.find((b) => b.isDefault) || bankRes.value.data[0] || null
        setSelectedBank(defBank)
      }

      if (catRes.status === 'fulfilled' && catRes.value?.data) {
        const catNames = catRes.value.data.map((c) => c.name)
        setCategories((prev) => Array.from(new Set([...prev, ...catNames])))
      }
    } finally {
      setIsLoadingProducts(false)
    }
  }, [setValue])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled([
        refetchProducts(),
        loadData(),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [refetchProducts, loadData, queryClient])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'All' ||
        p.category?.name === selectedCategory
      if (!matchCat) return false

      if (!debouncedSearchQuery.trim()) return true
      const q = debouncedSearchQuery.toLowerCase()
      const matchName = p.name.toLowerCase().includes(q)
      const matchSku = p.sku?.toLowerCase().includes(q)
      const matchBarcode = p.barcode?.toLowerCase().includes(q)
      const matchVariant = p.variants?.some(
        (v) =>
          v.sku.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          v.attribute_values?.some((av) => av.value_name.toLowerCase().includes(q))
      )
      return matchName || matchSku || matchBarcode || matchVariant
    })
  }, [products, selectedCategory, debouncedSearchQuery])

  // Map product to variants/detail picker (single & variable both open detail picker)
  const handleSelectProduct = useCallback(
    (product: Product) => {
      const rawVariants = product.variants || []
      const activeVariants = rawVariants.filter((v) => v.is_active !== false)

      if (rawVariants.length > 0 && activeVariants.length === 0) {
        Alert.alert(
          'Product Deactivated',
          `All variants for "${product.name}" are currently deactivated.`
        )
        return
      }

      const scannedProd: ScannedProduct = {
        id: product.id,
        name: product.name,
        selling_price: String(product.selling_price || '0'),
        image_url: product.image_url,
        barcode: product.barcode ?? null,
      }

      if (activeVariants.length === 0) {
        const fallbackVariant: ScannedVariant = {
          id: product.id,
          product_id: product.id,
          sku: product.sku || 'SKU-SINGLE',
          barcode: product.barcode ?? null,
          quantity_on_hand: 9999,
          selling_price: String(product.selling_price || '0'),
          selling_price_override: null,
        }
        setPickerProduct(scannedProd)
        setPickerVariants([fallbackVariant])
        setPickerOpen(true)
        return
      }

      const scannedVars: ScannedVariant[] = activeVariants.map((v) => ({
        id: v.id,
        product_id: product.id,
        sku: v.sku,
        barcode: v.barcode ?? null,
        quantity_on_hand: v.quantity_on_hand ?? 0,
        selling_price:
          v.selling_price_override ||
          v.selling_price ||
          String(product.selling_price || '0'),
        selling_price_override: v.selling_price_override ?? null,
        attribute_values: v.attribute_values,
      }))
      setPickerProduct(scannedProd)
      setPickerVariants(scannedVars)
      setPickerOpen(true)
    },
    [setPickerProduct, setPickerVariants, setPickerOpen]
  )

  const executeCheckout = async (data: PosCheckoutFormValues) => {
    if (checkoutLoading) return

    // Use centralized stock validation from useCart hook
    if (hasOutOfStockItems) {
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

    if (cart.length > 0) {
      subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    }

    const discountAmount = round2(
      discountType === 'percentage' ? subtotal * (parsedDiscount / 100) : parsedDiscount
    )

    const taxAmount = round2(
      taxType === 'percentage' ? subtotal * (parsedTax / 100) : parsedTax
    )

    const taxRateVal = round2(
      taxType === 'percentage' ? parsedTax : subtotal > 0 ? (taxAmount / subtotal) * 100 : 0
    )

    const finalTotal = round2(Math.max(0, subtotal - discountAmount + deliveryCost + taxAmount))

    const payload: CheckoutPayload = {
      client_mutation_id: mutationId,
      channel_id: channelId,
      items: cart.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      payment_method:
        activePaymentMethod === 'Bank'
          ? `${selectedBank?.bankName || 'Bank'} Transfer`
          : 'Cash',
      payment_amount: finalTotal,
      customer: phone.trim()
        ? {
            name: name.trim() || phone.trim(),
            phone: phone.trim(),
          }
        : undefined,
      delivery_company: isDelivery ? selectedDeliveryCompany : undefined,
      delivery_address:
        isDelivery && data.deliveryAddress?.trim() ? data.deliveryAddress.trim() : undefined,
      delivery_cost: isDelivery ? deliveryCost : undefined,
      region: isDelivery ? selectedDeliveryZone?.name : undefined,
      discount: discountAmount,
      tax_type: taxType,
      tax_amount: taxAmount,
      tax_rate: taxRateVal,
      status: data.orderStatus || 'paid',
      seller_id: selectedSeller?.id || data.sellerId || currentUser?.id,
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
      if (err && typeof err === 'object' && 'isNetworkError' in err && (err as { isNetworkError: boolean }).isNetworkError) {
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
    if (currentUser) {
      setSelectedSeller(currentUser)
      setValue('sellerId', currentUser.id)
    }
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

  // Pickers config
  const channelPickerItems = useMemo(() => channels.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: c.platform ? `Platform: ${c.platform}` : undefined,
  })), [channels])

  const deliveryCompanyPickerItems = useMemo(() => deliveryCompanies.map((c) => ({
    id: c.id,
    title: c.name,
  })), [deliveryCompanies])

  const deliveryZonePickerItems = useMemo(() => [
    ...deliveryZones.map((z) => ({
      id: z.id,
      title: z.name,
      subtitle: `$${z.cost.toFixed(2)} delivery`,
    })),
    {
      id: 'custom',
      title: 'Custom / Negotiated Fee',
      subtitle: 'Manual negotiated price',
    },
  ], [deliveryZones])

  const bankPickerItems = useMemo(() => bankAccounts.map((b) => ({
    id: b.id,
    title: b.bankName,
    subtitle: `${b.accountName} • ${b.accountNumber}`,
  })), [bankAccounts])

  return {
    // Search & Category
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,

    // Collapsible Header
    headerTranslateY,
    headerOpacity,
    onScroll,
    onLayoutHeader,
    headerHeight,

    // Products
    products,
    filteredProducts,
    isLoadingProducts,
    productsError,
    refreshing,
    setRefreshing,
    onRefresh,

    // Channels
    channels,
    activeChannel,
    setActiveChannel,

    // Scanner & Variant Picker
    scannerOpen,
    setScannerOpen,
    scanLoading,
    scanFeedback,
    pickerOpen,
    setPickerOpen,
    pickerProduct,
    pickerVariants,
    setPickerProduct,
    setPickerVariants,
    handleScanCode,
    handleSelectProduct,

    // Checkout
    checkoutSheetOpen,
    setCheckoutSheetOpen,
    checkoutStep,
    handleSetCheckoutStep,
    receiptOpen,
    setReceiptOpen,
    completedOrder,
    setCompletedOrder,
    checkoutLoading,
    activePaymentMethod,
    setActivePaymentMethod,
    formMethods,
    isDelivery,
    executeCheckout,
    handleNewSale,

    // Bank Selection
    bankAccounts,
    selectedBank,
    setSelectedBank,

    // Pickers
    channelPickerOpen,
    setChannelPickerOpen,
    deliveryPickerOpen,
    setDeliveryPickerOpen,
    deliveryZonePickerOpen,
    setDeliveryZonePickerOpen,
    bankPickerOpen,
    setBankPickerOpen,
    sellerPickerOpen,
    setSellerPickerOpen,
    staffUsers,
    selectedSeller,
    setSelectedSeller,
    handleSelectSeller,
    handleResetSellerToMe,
    currentUser,

    // Delivery & Logistics
    deliveryCompanies,
    selectedDeliveryCompany,
    setSelectedDeliveryCompany,
    deliveryZones,
    selectedDeliveryZone,
    setSelectedDeliveryZone,

    // Cart
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

    // Customer Lookup
    phone,
    setPhone,
    name,
    setName,
    matchedCustomer,
    customerSuggestions,
    customerLookupStatus,
    loyaltyInfo,
    selectCustomer,
    dismissSuggestions,
    resetCustomer,
    handleSelectCustomer,
    handleResetCustomer,

    // Order actions
    handleUpdateOrderStatus,
    handleUpdateOrder,
    handleOpenScannerUnified,

    // Picker items
    channelPickerItems,
    deliveryCompanyPickerItems,
    deliveryZonePickerItems,
    bankPickerItems,
  }
}