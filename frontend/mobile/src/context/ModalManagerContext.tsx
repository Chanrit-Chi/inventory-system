import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import type { Product, Order, Customer, ProductVariant } from '../types'

// Modal types
type ModalType =
  | 'scanner'
  | 'stockIn'
  | 'stockAdjustment'
  | 'purchaseOrder'
  | 'auth'
  | 'variantPicker'
  | 'receipt'

interface BaseModalState {
  visible: boolean
}

interface ScannerModalState extends BaseModalState {
  type: 'scanner'
}

interface StockInModalState extends BaseModalState {
  type: 'stockIn'
  product: Product | null
  variant: ProductVariant | null
}

interface StockAdjustmentModalState extends BaseModalState {
  type: 'stockAdjustment'
  product: Product | null
  variant: ProductVariant | null
}

interface PurchaseOrderModalState extends BaseModalState {
  type: 'purchaseOrder'
  mode: 'list' | 'create'
  supplierId?: string
}

interface AuthModalState extends BaseModalState {
  type: 'auth'
}

interface VariantPickerModalState extends BaseModalState {
  type: 'variantPicker'
  product: Product | null
  variants: ProductVariant[]
}

interface ReceiptModalState extends BaseModalState {
  type: 'receipt'
  order: Order | null
}

type ModalState =
  | ScannerModalState
  | StockInModalState
  | StockAdjustmentModalState
  | PurchaseOrderModalState
  | AuthModalState
  | VariantPickerModalState
  | ReceiptModalState

interface ModalManagerContextValue {
  // Current modal state
  modals: Record<ModalType, BaseModalState & Partial<ModalState>>

  // Scanner
  scannerOpen: boolean
  setScannerOpen: (open: boolean) => void

  // Stock In
  stockInOpen: boolean
  stockInProduct: Product | null
  stockInVariant: ProductVariant | null
  openStockIn: (product?: Product | null, variant?: ProductVariant | null) => void
  closeStockIn: () => void

  // Stock Adjustment
  stockAdjOpen: boolean
  stockAdjProduct: Product | null
  stockAdjVariant: ProductVariant | null
  openStockAdjustment: (product?: Product | null, variant?: ProductVariant | null) => void
  closeStockAdjustment: () => void

  // Purchase Order
  purchaseOrderModalOpen: boolean
  poModalConfig: { mode: 'list' | 'create'; supplierId?: string }
  openPurchaseOrder: (opts?: { mode?: 'list' | 'create'; supplierId?: string }) => void
  closePurchaseOrder: () => void

  // Auth
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void

  // Variant Picker
  pickerOpen: boolean
  pickerProduct: Product | null
  pickerVariants: ProductVariant[]
  openVariantPicker: (product: Product, variants: ProductVariant[]) => void
  closeVariantPicker: () => void

  // Receipt
  receiptOpen: boolean
  viewingOrder: Order | null
  openReceipt: (order: Order) => void
  closeReceipt: () => void

  // Generic close all
  closeAllModals: () => void
}

const initialModals: Record<ModalType, BaseModalState & Partial<ModalState>> = {
  scanner: { type: 'scanner', visible: false },
  stockIn: { type: 'stockIn', visible: false, product: null, variant: null },
  stockAdjustment: { type: 'stockAdjustment', visible: false, product: null, variant: null },
  purchaseOrder: { type: 'purchaseOrder', visible: false, mode: 'list' },
  auth: { type: 'auth', visible: false },
  variantPicker: { type: 'variantPicker', visible: false, product: null, variants: [] },
  receipt: { type: 'receipt', visible: false, order: null },
}

const ModalManagerContext = createContext<ModalManagerContextValue | undefined>(undefined)

export function ModalManagerProvider({ children }: { children: ReactNode }) {
  // Scanner
  const [scannerOpen, setScannerOpen] = useState(false)

  // Stock In
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null)
  const [stockInVariant, setStockInVariant] = useState<ProductVariant | null>(null)

  // Stock Adjustment
  const [stockAdjOpen, setStockAdjOpen] = useState(false)
  const [stockAdjProduct, setStockAdjProduct] = useState<Product | null>(null)
  const [stockAdjVariant, setStockAdjVariant] = useState<ProductVariant | null>(null)

  // Purchase Order
  const [purchaseOrderModalOpen, setPurchaseOrderModalOpen] = useState(false)
  const [poModalConfig, setPoModalConfig] = useState<{ mode: 'list' | 'create'; supplierId?: string }>({ mode: 'list' })

  // Auth
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Variant Picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null)
  const [pickerVariants, setPickerVariants] = useState<ProductVariant[]>([])

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null)

  // Helper to check if object is a valid product/variant (not synthetic event)
  const isValidEntity = useCallback((entity: unknown): boolean => {
    return entity !== null && typeof entity === 'object' && typeof (entity as { id?: unknown }).id === 'string' && !('nativeEvent' in entity)
  }, [])

  // Stock In
  const openStockIn = useCallback((product?: Product | null, variant?: ProductVariant | null) => {
    setStockInProduct(product && isValidEntity(product) ? product : null)
    setStockInVariant(variant && isValidEntity(variant) ? variant : null)
    setStockInOpen(true)
  }, [isValidEntity])

  const closeStockIn = useCallback(() => {
    setStockInOpen(false)
    setStockInProduct(null)
    setStockInVariant(null)
  }, [])

  // Stock Adjustment
  const openStockAdjustment = useCallback((product?: Product | null, variant?: ProductVariant | null) => {
    setStockAdjProduct(product && isValidEntity(product) ? product : null)
    setStockAdjVariant(variant && isValidEntity(variant) ? variant : null)
    setStockAdjOpen(true)
  }, [isValidEntity])

  const closeStockAdjustment = useCallback(() => {
    setStockAdjOpen(false)
    setStockAdjProduct(null)
    setStockAdjVariant(null)
  }, [])

  // Purchase Order
  const openPurchaseOrder = useCallback((opts?: { mode?: 'list' | 'create'; supplierId?: string }) => {
    setPoModalConfig({ mode: opts?.mode ?? 'list', supplierId: opts?.supplierId })
    setPurchaseOrderModalOpen(true)
  }, [])

  const closePurchaseOrder = useCallback(() => {
    setPurchaseOrderModalOpen(false)
    setPoModalConfig({ mode: 'list' })
  }, [])

  // Auth
  const openAuthModal = useCallback(() => {
    setAuthModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false)
  }, [])

  // Variant Picker
  const openVariantPicker = useCallback((product: Product, variants: ProductVariant[]) => {
    setPickerProduct(product)
    setPickerVariants(variants)
    setPickerOpen(true)
  }, [])

  const closeVariantPicker = useCallback(() => {
    setPickerOpen(false)
    setPickerProduct(null)
    setPickerVariants([])
  }, [])

  // Receipt
  const openReceipt = useCallback((order: Order) => {
    setViewingOrder(order)
    setReceiptOpen(true)
  }, [])

  const closeReceipt = useCallback(() => {
    setReceiptOpen(false)
    setViewingOrder(null)
  }, [])

  // Close all
  const closeAllModals = useCallback(() => {
    setScannerOpen(false)
    closeStockIn()
    closeStockAdjustment()
    closePurchaseOrder()
    setAuthModalOpen(false)
    closeVariantPicker()
    closeReceipt()
  }, [closeStockIn, closeStockAdjustment, closePurchaseOrder, closeVariantPicker, closeReceipt])

  const modals = useMemo<Record<ModalType, BaseModalState & Partial<ModalState>>>(() => ({
    scanner: { type: 'scanner', visible: scannerOpen },
    stockIn: { type: 'stockIn', visible: stockInOpen, product: stockInProduct, variant: stockInVariant },
    stockAdjustment: { type: 'stockAdjustment', visible: stockAdjOpen, product: stockAdjProduct, variant: stockAdjVariant },
    purchaseOrder: { type: 'purchaseOrder', visible: purchaseOrderModalOpen, mode: poModalConfig.mode, supplierId: poModalConfig.supplierId },
    auth: { type: 'auth', visible: authModalOpen },
    variantPicker: { type: 'variantPicker', visible: pickerOpen, product: pickerProduct, variants: pickerVariants },
    receipt: { type: 'receipt', visible: receiptOpen, order: viewingOrder },
  }), [
    scannerOpen,
    stockInOpen, stockInProduct, stockInVariant,
    stockAdjOpen, stockAdjProduct, stockAdjVariant,
    purchaseOrderModalOpen, poModalConfig,
    authModalOpen,
    pickerOpen, pickerProduct, pickerVariants,
    receiptOpen, viewingOrder,
  ])

  const value = useMemo<ModalManagerContextValue>(() => ({
    modals,
    scannerOpen,
    setScannerOpen,
    stockInOpen,
    stockInProduct,
    stockInVariant,
    openStockIn,
    closeStockIn,
    stockAdjOpen,
    stockAdjProduct,
    stockAdjVariant,
    openStockAdjustment,
    closeStockAdjustment,
    purchaseOrderModalOpen,
    poModalConfig,
    openPurchaseOrder,
    closePurchaseOrder,
    authModalOpen,
    openAuthModal,
    closeAuthModal,
    pickerOpen,
    pickerProduct,
    pickerVariants,
    openVariantPicker,
    closeVariantPicker,
    receiptOpen,
    viewingOrder,
    openReceipt,
    closeReceipt,
    closeAllModals,
  }), [
    modals,
    scannerOpen, setScannerOpen,
    stockInOpen, stockInProduct, stockInVariant, openStockIn, closeStockIn,
    stockAdjOpen, stockAdjProduct, stockAdjVariant, openStockAdjustment, closeStockAdjustment,
    purchaseOrderModalOpen, poModalConfig, openPurchaseOrder, closePurchaseOrder,
    authModalOpen, openAuthModal, closeAuthModal,
    pickerOpen, pickerProduct, pickerVariants, openVariantPicker, closeVariantPicker,
    receiptOpen, viewingOrder, openReceipt, closeReceipt,
    closeAllModals,
  ])

  return <ModalManagerContext.Provider value={value}>{children}</ModalManagerContext.Provider>
}

export function useModalManager(): ModalManagerContextValue {
  const context = useContext(ModalManagerContext)
  if (!context) {
    throw new Error('useModalManager must be used within a ModalManagerProvider')
  }
  return context
}