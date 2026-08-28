import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  UIManager,
  StatusBar as RNStatusBar,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as NavigationBar from 'expo-navigation-bar'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from './src/theme/tokens'
import { useCart } from './src/hooks/useCart'
import { useOfflineQueue } from './src/hooks/useOfflineQueue'
import { usePermissions } from './src/hooks/usePermissions'
import { useBarcodeScan } from './src/hooks/useBarcodeScan'
import { useNetworkStatus } from './src/hooks/useNetworkStatus'
import { updateOrderStatus, updateOrder } from './src/api/endpoints'
import { BottomTabBar } from './src/components/BottomTabBar'
import { NetworkStatusBanner } from './src/components/NetworkStatusBanner'
import { CameraScannerModal } from './src/components/CameraScannerModal'
import { OrderReceiptModal } from './src/components/OrderReceiptModal'
import { StockInModal } from './src/components/StockInModal'
import { StockAdjustmentModal } from './src/components/StockAdjustmentModal'
import { PurchaseOrderModal } from './src/components/PurchaseOrderModal'
import { VariantPickerModal } from './src/components/VariantPickerModal'
import { AuthModal } from './src/components/AuthModal'
import { HubScreen } from './src/screens/HubScreen'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { BrandingProvider, useBranding } from './src/context/BrandingContext'
import NetInfo from '@react-native-community/netinfo'
import LoginScreen from './src/screens/LoginScreen'
import HomeScreen from './src/screens/HomeScreen'
import PosScreen from './src/screens/PosScreen'
import TransactionsScreen from './src/screens/TransactionsScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import QuotationsScreen from './src/screens/QuotationsScreen'
import InvoicesScreen from './src/screens/InvoicesScreen'
import ProductsScreen from './src/screens/ProductsScreen'
import { PurchaseOrdersScreen } from './src/screens/PurchaseOrdersScreen'
import CustomersScreen from './src/screens/CustomersScreen'
import SuppliersScreen from './src/screens/SuppliersScreen'
import ExpensesScreen from './src/screens/ExpensesScreen'
import ReportsScreen from './src/screens/ReportsScreen'
import AdminUsersScreen from './src/screens/AdminUsersScreen'
import AdminRolesScreen from './src/screens/AdminRolesScreen'
import CategoriesAttributesScreen from './src/screens/CategoriesAttributesScreen'
import BankAccountsScreen from './src/screens/BankAccountsScreen'
import { DeliveryCompaniesScreen } from './src/screens/DeliveryCompaniesScreen'
import { DeliveryZonesScreen } from './src/screens/DeliveryZonesScreen'
import { SalesChannelsScreen } from './src/screens/SalesChannelsScreen'
import PayrollScreen from './src/screens/PayrollScreen'
import { usePurchaseOrders } from './src/hooks/usePurchaseOrders'
import type {
  TabType,
  Order,
  Product,
  ScannedProduct,
  ScannedVariant,
  QuotationItem,
  Customer,
} from './src/types'

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, asyncStoragePersister } from './src/api/queryClient'
import { queryKeys } from './src/api/queryKeys'
import { ErrorBoundary } from './src/components/ErrorBoundary'

import { ToastProvider } from './src/context/ToastContext'

export default function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <AuthProvider>
          <BrandingProvider>
            <ToastProvider>
              <AppShell />
            </ToastProvider>
          </BrandingProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}

import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { AppProvider, useAppActions } from './src/context/AppContext'

const Tab = createBottomTabNavigator()

import { useNavigation } from '@react-navigation/native'

const noop = () => {}

const ScreenWrapper = React.memo(({ ScreenComponent }: { ScreenComponent: any }) => {
  const actions = useAppActions();
  const navigation = useNavigation<any>();
  const { canAccessTab } = usePermissions();
  const navigateToTab = React.useCallback(
    (tab: any) => {
      if (typeof tab !== 'string') {
        return;
      }
      if (!canAccessTab(tab as any)) {
        Alert.alert('Access Restricted', 'You do not have permission to access this module.')
        return
      }
      navigation.navigate(tab);
    },
    [navigation, canAccessTab]
  );
  return (
    <ScreenComponent
      onNavigate={navigateToTab}
      onOpenStockIn={actions.onOpenStockIn}
      onOpenStockAdjustment={actions.onOpenStockAdjustment}
      onOpenPurchaseOrder={actions.onOpenPurchaseOrder}
      onOpenPurchaseOrders={actions.onOpenPurchaseOrders}
      initialSubTab={actions.productsSubTab}
      onOpenScanner={actions.onOpenScanner}
      onSelectOrder={actions.onSelectOrder}
      onConvertQuoteToCart={actions.onConvertQuoteToCart}
      onCheckoutStateChange={actions.onCheckoutStateChange}
      onOpenAuth={actions.onAuthModalOpen}
      onSelectCustomerForPOS={actions.onSelectCustomerForPOS}
      onOpenSidebar={noop}
      cartHook={actions.cartHook}
      offlineQueueHook={actions.offlineQueueHook}
      purchaseOrders={actions.purchaseOrders}
      onAddPO={actions.addPurchaseOrder}
      onMarkPoReceived={actions.markPoReceived}
      staffName={actions.currentUser?.name}
      currentUser={actions.currentUser}
      userRole={actions.currentUser?.role}
      refreshTrigger={actions.orderRefreshTrigger}
      activeCartCount={actions.cartHook?.totalItemCount}
      onSelectTab={(tab: any) => {
        if (typeof tab === 'string') navigation.navigate(tab)
      }}
    />
  );
});

const HomeTab = () => <ScreenWrapper ScreenComponent={HomeScreen} />
const PosTab = () => <ScreenWrapper ScreenComponent={PosScreen} />
const QuotationsTab = () => <ScreenWrapper ScreenComponent={QuotationsScreen} />
const InvoicesTab = () => <ScreenWrapper ScreenComponent={InvoicesScreen} />
const ProductsTab = () => <ScreenWrapper ScreenComponent={ProductsScreen} />
const PurchaseOrdersTab = () => <ScreenWrapper ScreenComponent={PurchaseOrdersScreen} />
const CategoriesTab = () => <ScreenWrapper ScreenComponent={CategoriesAttributesScreen} />
const SuppliersTab = () => <ScreenWrapper ScreenComponent={SuppliersScreen} />
const CustomersTab = () => <ScreenWrapper ScreenComponent={CustomersScreen} />
const ExpensesTab = () => <ScreenWrapper ScreenComponent={ExpensesScreen} />
const ReportsTab = () => <ScreenWrapper ScreenComponent={ReportsScreen} />
const AdminUsersTab = () => <ScreenWrapper ScreenComponent={AdminUsersScreen} />
const AdminRolesTab = () => <ScreenWrapper ScreenComponent={AdminRolesScreen} />
const TransactionsTab = () => <ScreenWrapper ScreenComponent={TransactionsScreen} />
const SalesChannelsTab = () => <ScreenWrapper ScreenComponent={SalesChannelsScreen} />
const BankAccountsTab = () => <ScreenWrapper ScreenComponent={BankAccountsScreen} />
const DeliveryCompaniesTab = () => <ScreenWrapper ScreenComponent={DeliveryCompaniesScreen} />
const DeliveryZonesTab = () => <ScreenWrapper ScreenComponent={DeliveryZonesScreen} />
const SettingsTab = () => <ScreenWrapper ScreenComponent={SettingsScreen} />
const HubTab = () => <ScreenWrapper ScreenComponent={HubScreen} />
const PayrollTab = () => <ScreenWrapper ScreenComponent={PayrollScreen} />

const GlobalHeader = ({
  branding,
  pendingCount,
  isSyncing,
  handleSyncOffline,
  handleOpenScanner,
  setAuthModalOpen,
  isCheckoutActive,
  currentRoute,
}: any) => {

  if (currentRoute === 'pos' && isCheckoutActive) {
    return null;
  }

  return (
    <View style={styles.globalHeader}>
      <View style={styles.headerLeftGroup}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setAuthModalOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.brandRow}>
            {branding.logo_url ? (
              <Image
                source={{ uri: branding.logo_url }}
                style={styles.brandLogoImg}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={require('./assets/KC SHOP-No BG.png')}
                style={styles.brandLogoImg}
                resizeMode="contain"
              />
            )}
            <Text style={styles.brandName} numberOfLines={1}>{branding.store_name || 'KC Inventory'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.headerRight}>
        {pendingCount > 0 && (
          <TouchableOpacity
            testID="btn-global-sync-queue"
            style={styles.offlineQueueBtn}
            onPress={handleSyncOffline}
            disabled={isSyncing}
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={tokens.colors.statusWarning} />
            ) : (
              <>
                <Ionicons name="sync" size={14} color={tokens.colors.statusWarning} />
                <Text style={styles.offlineQueueText}>{pendingCount}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="btn-global-scanner"
          style={styles.scannerBtn}
          onPress={handleOpenScanner}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Ionicons name="barcode-outline" size={18} color={tokens.colors.onPrimary} />
          <Text style={styles.scannerBtnText}>Scan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const RootNavigator = React.memo(({
  branding,
  pendingCount,
  isSyncing,
  handleSyncOffline,
  handleOpenScanner,
  setAuthModalOpen,
  isCheckoutActive,
  totalItemCount,
  currentRoute,
  networkStatus,
}: any) => {
  return (
    <View style={styles.screenContainer}>
      <GlobalHeader 
        branding={branding} 
        pendingCount={pendingCount} 
        isSyncing={isSyncing}
        handleSyncOffline={handleSyncOffline}
        handleOpenScanner={handleOpenScanner}
        setAuthModalOpen={setAuthModalOpen}
        isCheckoutActive={isCheckoutActive}
        currentRoute={currentRoute}
      />
      {networkStatus && (
        <NetworkStatusBanner
          connectionState={networkStatus.connectionState}
          isChecking={networkStatus.isChecking}
          onRetry={networkStatus.checkConnection}
          customMessage={networkStatus.errorMessage}
        />
      )}
      <Tab.Navigator
        tabBar={(props) => {
          const activeRouteName = props.state.routes[props.state.index].name;
          return (
            <BottomTabBar
              activeTab={activeRouteName as any}
              onSelectTab={(tab) => props.navigation.navigate(tab)}
              cartItemCount={totalItemCount}
              pendingSyncCount={pendingCount}
            />
          );
        }}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="home" component={HomeTab} />
        <Tab.Screen name="pos" component={PosTab} />
        <Tab.Screen name="products" component={ProductsTab} />
        <Tab.Screen name="purchase-orders" component={PurchaseOrdersTab} />
        <Tab.Screen name="transactions" component={TransactionsTab} />
        <Tab.Screen name="hub" component={HubTab} />
        <Tab.Screen name="quotations" component={QuotationsTab} />
        <Tab.Screen name="invoices" component={InvoicesTab} />
        <Tab.Screen name="categories" component={CategoriesTab} />
        <Tab.Screen name="suppliers" component={SuppliersTab} />
        <Tab.Screen name="customers" component={CustomersTab} />
        <Tab.Screen name="expenses" component={ExpensesTab} />
        <Tab.Screen name="reports" component={ReportsTab} />
        <Tab.Screen name="admin" component={AdminUsersTab} />
        <Tab.Screen name="roles" component={AdminRolesTab} />
        <Tab.Screen name="sales-channels" component={SalesChannelsTab} />
        <Tab.Screen name="bank-accounts" component={BankAccountsTab} />
        <Tab.Screen name="delivery-companies" component={DeliveryCompaniesTab} />
        <Tab.Screen name="delivery-zones" component={DeliveryZonesTab} />
        <Tab.Screen name="settings" component={SettingsTab} />
        <Tab.Screen name="payroll" component={PayrollTab} />
      </Tab.Navigator>
    </View>
  );
});

function AppShell() {
  const { currentUser, isAuthenticated, isRestoring, updateProfile } = useAuth()
  const { branding } = useBranding()
  const [currentRoute, setCurrentRoute] = useState<string>('home')
  const { canAccessTab } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [isCheckoutActive, setIsCheckoutActive] = useState(false)

  // Ensure activeTab is accessible by current user
  React.useEffect(() => {
    if (currentUser && !canAccessTab(activeTab)) {
      setActiveTab('home')
    }
  }, [activeTab, canAccessTab, currentUser])

  // Configure Android System Navigation Bar
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync('dark').catch(() => {})
    }
  }, [])

  // Shared Cart State
  const cartHook = useCart()
  const {
    totalItemCount,
    addVariantToCart,
    addMultipleItemsToCart,
    replaceCartWithItems,
  } = cartHook

  // Offline Queue State
  const offlineQueueHook = useOfflineQueue()
  const {
    pendingCount,
    isSyncing,
    syncQueue,
  } = offlineQueueHook

  // Global Network & Backend Connection Status
  const networkStatus = useNetworkStatus()

  // Shared Purchase Orders State (with Local Persistence & Live Status Tracking)
  const poHook = usePurchaseOrders()
  const {
    purchaseOrders,
    pendingPurchaseOrders,
    addPurchaseOrder,
    markPoReceived,
  } = poHook

  // Global Scanner & Variant Picker Hook
  const {
    scannerOpen,
    setScannerOpen,
    openScanner: handleOpenScanner,
    loading: scanLoading,
    pickerOpen,
    setPickerOpen,
    pickerProduct,
    pickerVariants,
    closePicker,
    handleScanCode,
  } = useBarcodeScan({
    onFoundVariant: (variant, product) => {
      addVariantToCart(variant, product?.name || 'Product')
      const label = variant.barcode || variant.sku
      Alert.alert(
        'Product Added',
        `Added ${product?.name || 'Product'} (${label}) to cart.`,
        [
          {
            text: 'Go to Register',
            onPress: () => {
              setScannerOpen(false)
              setActiveTab('pos')
            },
          },
          {
            text: 'Keep Scanning',
            onPress: () => setScannerOpen(true),
          },
        ]
      )
    },
  })

  // Global Stock In Modal State
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null)
  const [stockInVariant, setStockInVariant] = useState<any>(null)

  // Global Stock Adjustment Modal State
  const [stockAdjOpen, setStockAdjOpen] = useState(false)
  const [stockAdjProduct, setStockAdjProduct] = useState<Product | null>(null)
  const [stockAdjVariant, setStockAdjVariant] = useState<any>(null)

  // Global Purchase Order Modal Dialog State
  const [purchaseOrderModalOpen, setPurchaseOrderModalOpen] = useState(false)
  const [poModalConfig, setPoModalConfig] = useState<{ mode?: 'list' | 'create'; supplierId?: string }>({ mode: 'list' })

  const handleOpenPurchaseOrder = useCallback((opts?: { mode?: 'list' | 'create'; supplierId?: string }) => {
    setPoModalConfig(opts || { mode: 'list' })
    setPurchaseOrderModalOpen(true)
  }, [])

  // Products SubTab State for Direct Navigation (e.g. from Hub Purchase Orders)
  const [productsSubTab, setProductsSubTab] = useState<'catalog' | 'movements' | 'purchaseOrders'>('catalog')

  // Receipt Modal State for viewing transactions
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const handleOpenStockIn = useCallback((product?: any, variant?: any) => {
    const isRealProduct = product && typeof product === 'object' && typeof product.id === 'string' && !('nativeEvent' in product)
    const isRealVariant = variant && typeof variant === 'object' && typeof variant.id === 'string' && !('nativeEvent' in variant)
    setStockInProduct(isRealProduct ? (product as Product) : null)
    setStockInVariant(isRealVariant ? variant : null)
    setStockInOpen(true)
  }, [])

  const handleOpenStockAdjustment = useCallback((product?: any, variant?: any) => {
    const isRealProduct = product && typeof product === 'object' && typeof product.id === 'string' && !('nativeEvent' in product)
    const isRealVariant = variant && typeof variant === 'object' && typeof variant.id === 'string' && !('nativeEvent' in variant)
    setStockAdjProduct(isRealProduct ? (product as Product) : null)
    setStockAdjVariant(isRealVariant ? variant : null)
    setStockAdjOpen(true)
  }, [])

  const handleOpenAuthModal = useCallback(() => {
    setAuthModalOpen(true)
  }, [])

  const handleSyncOffline = useCallback(async () => {
    const success = await syncQueue()
    if (success) {
      Alert.alert('Sync Successful', 'All offline transactions have been synchronized.')
    } else {
      Alert.alert('Sync Incomplete', 'Some transactions could not be synced. Will retry automatically.')
    }
  }, [syncQueue])

  // Auto-sync offline queue when network connectivity is restored
  useEffect(() => {
    let wasOffline = false
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false
      if (isConnected && wasOffline && pendingCount > 0) {
        syncQueue()
      }
      wasOffline = !isConnected
    })
    return () => unsubscribe()
  }, [syncQueue, pendingCount])

  // Conversion: Quotation Items -> POS Cart
  const handleConvertQuoteToCart = useCallback(
    (quoteItems: QuotationItem[], quoteNumber?: string, preset?: any) => {
      const cartItems = quoteItems.map((item, idx) => ({
        variantId: item.variant_id || item.id || `quote-item-${idx}`,
        sku: item.sku || 'SKU-CUSTOM',
        productName: item.product_name || 'Quoted Product',
        quantity: typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 1,
        unitPrice: typeof item.unit_price === 'number' ? item.unit_price : Number(item.unit_price) || 0,
        availableStock: (item as any).available_stock ?? 0,
      }))

      replaceCartWithItems(cartItems, preset)
      setActiveTab('pos')
      Alert.alert(
        'Quotation Loaded',
        `Transferred ${quoteItems.length} items from quotation ${quoteNumber || ''} into active POS Register cart.`,
        [{ text: 'View Register', onPress: () => setActiveTab('pos') }]
      )
    },
    [replaceCartWithItems]
  )

  const handleSelectOrder = useCallback((order: Order) => {
    setViewingOrder(order)
    setReceiptOpen(true)
  }, [])

  const [orderRefreshTrigger, setOrderRefreshTrigger] = useState(0)
  const [orderUpdateError, setOrderUpdateError] = useState<{ message: string; onRetry: () => void } | null>(null)

  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, newStatus: string, paymentMethod?: string, notes?: string) => {
      setOrderUpdateError(null)
      try {
        await updateOrderStatus(orderId, newStatus, paymentMethod, notes)

        setViewingOrder((prev) => {
          if (!prev || prev.id !== orderId) return prev
          return {
            ...prev,
            status: newStatus,
            notes: notes !== undefined ? notes : prev.notes,
            payments:
              paymentMethod && prev.payments && prev.payments.length > 0
                ? [{ ...prev.payments[0], payment_method: paymentMethod }]
                : prev.payments,
          }
        })
        setOrderRefreshTrigger((t) => t + 1)
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        ])
      } catch (err: any) {
        const errorMsg = err?.message || 'Could not update order status.'
        setOrderUpdateError({
          message: errorMsg,
          onRetry: () => handleUpdateOrderStatus(orderId, newStatus, paymentMethod, notes),
        })
        Alert.alert('Update Failed', errorMsg)
      }
    },
    []
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
      setOrderUpdateError(null)
      try {
        await updateOrder(orderId, payload)

        setViewingOrder((prev) => {
          if (!prev || prev.id !== orderId) return prev
          return {
            ...prev,
            notes: payload.notes !== undefined ? payload.notes : prev.notes,
            delivery_address:
              payload.delivery_address !== undefined
                ? payload.delivery_address
                : prev.delivery_address,
            region: payload.region !== undefined ? payload.region : prev.region,
          }
        })
        setOrderRefreshTrigger((t) => t + 1)
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        ])
      } catch (err: any) {
        const errorMsg = err?.message || 'Could not update order details.'
        setOrderUpdateError({
          message: errorMsg,
          onRetry: () => handleUpdateOrder(orderId, payload),
        })
        Alert.alert('Update Failed', errorMsg)
      }
    },
    []
  )

  const handleNewSaleFromReceipt = useCallback(() => {
    setReceiptOpen(false)
    setViewingOrder(null)
    setActiveTab('pos')
  }, [])

  const handleNavigate = useCallback((tab: TabType) => {
    if (!canAccessTab(tab)) {
      Alert.alert('Access Restricted', 'You do not have permission to access this module.')
      return
    }
    setActiveTab(tab)
  }, [canAccessTab])

  const handleSelectCustomerForPOS = useCallback(
    (customer: Customer) => {
      if (customer && cartHook.setCheckoutPreset) {
        cartHook.setCheckoutPreset({
          customerName: customer.name,
          customerPhone: customer.phone,
        })
      }
    },
    [cartHook.setCheckoutPreset]
  )

  const appContextValue = useMemo(
    () => ({
      onNavigate: noop as (tab: any) => void,
      onOpenScanner: handleOpenScanner,
      onOpenStockIn: handleOpenStockIn,
      onOpenStockAdjustment: handleOpenStockAdjustment,
      onOpenPurchaseOrder: handleOpenPurchaseOrder,
      productsSubTab: productsSubTab,
      setProductsSubTab: setProductsSubTab,
      onSelectOrder: handleSelectOrder,
      onConvertQuoteToCart: handleConvertQuoteToCart,
      onCheckoutStateChange: setIsCheckoutActive,
      onAuthModalOpen: handleOpenAuthModal,
      onSelectCustomerForPOS: handleSelectCustomerForPOS,
      cartHook: cartHook,
      offlineQueueHook: offlineQueueHook,
      purchaseOrders: purchaseOrders,
      addPurchaseOrder: addPurchaseOrder,
      markPoReceived: markPoReceived,
      currentUser: currentUser,
      orderRefreshTrigger: orderRefreshTrigger,
    }),
    [
      handleOpenScanner,
      handleOpenStockIn,
      handleOpenStockAdjustment,
      handleOpenPurchaseOrder,
      productsSubTab,
      handleSelectOrder,
      handleConvertQuoteToCart,
      handleOpenAuthModal,
      handleSelectCustomerForPOS,
      cartHook,
      offlineQueueHook,
      purchaseOrders,
      addPurchaseOrder,
      markPoReceived,
      currentUser,
      orderRefreshTrigger,
    ]
  )

  if (isRestoring) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
          <StatusBar style="dark" backgroundColor={tokens.colors.background} />
          <View style={{ alignItems: 'center', gap: 16 }}>
            {branding.logo_url ? (
              <Image
                source={{ uri: branding.logo_url }}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={require('./assets/KC SHOP-No BG.png')}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
              />
            )}
            <Text style={{ fontSize: 18, fontWeight: '800', color: tokens.colors.onBackground, letterSpacing: -0.5 }}>{branding.store_name || 'KC Inventory'}</Text>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" backgroundColor={tokens.colors.background} />
          <LoginScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" backgroundColor={tokens.colors.background} />

        <View style={styles.root}>
          {Boolean(orderUpdateError) && (
            <View style={styles.orderErrorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.orderErrorText} numberOfLines={2}>
                {orderUpdateError?.message}
              </Text>
              <TouchableOpacity
                style={styles.orderRetryBtn}
                onPress={() => {
                  const retry = orderUpdateError?.onRetry
                  setOrderUpdateError(null)
                  retry?.()
                }}
              >
                <Text style={styles.orderRetryText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.orderDismissBtn}
                onPress={() => setOrderUpdateError(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}
          <AppProvider value={appContextValue}>
            <NavigationContainer
              onStateChange={(state) => {
                const route = state?.routes[state.index]?.name;
                if (route) setCurrentRoute(route);
              }}
            >
              <RootNavigator
                branding={branding}
                pendingCount={pendingCount}
                isSyncing={isSyncing}
                handleSyncOffline={handleSyncOffline}
                handleOpenScanner={handleOpenScanner}
                setAuthModalOpen={setAuthModalOpen}
                isCheckoutActive={isCheckoutActive}
                totalItemCount={totalItemCount}
                currentRoute={currentRoute}
                networkStatus={networkStatus}
              />
            </NavigationContainer>
          </AppProvider>

          {/* Global Barcode / Receipt Camera Scanner Modal */}
          <CameraScannerModal
            visible={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScanCode={async (code) => {
              await handleScanCode(code)
            }}
            isLoading={scanLoading}
          />

          {/* Global Stock Intake / Receiving Modal */}
          <StockInModal
            visible={stockInOpen}
            product={stockInProduct}
            variant={stockInVariant}
            onClose={() => {
              setStockInOpen(false)
              setStockInProduct(null)
              setStockInVariant(null)
            }}
            pendingPurchaseOrders={pendingPurchaseOrders}
            onLinkPoReceived={markPoReceived}
          />

          {/* Global Inventory Count Adjustment Modal */}
          <StockAdjustmentModal
            visible={stockAdjOpen}
            product={stockAdjProduct}
            variant={stockAdjVariant}
            onClose={() => {
              setStockAdjOpen(false)
              setStockAdjProduct(null)
              setStockAdjVariant(null)
            }}
          />

          {/* Global Purchase Orders Dialog Modal */}
          <PurchaseOrderModal
            visible={purchaseOrderModalOpen}
            onClose={() => setPurchaseOrderModalOpen(false)}
            purchaseOrders={purchaseOrders}
            onAddPO={addPurchaseOrder}
            onMarkPoReceived={markPoReceived}
            onOpenStockIn={handleOpenStockIn}
            initialMode={poModalConfig.mode || 'list'}
            preSelectedSupplierId={poModalConfig.supplierId}
          />

          {/* Global Auth / Profile Modal */}
          <AuthModal
            visible={authModalOpen}
            currentUser={currentUser}
            onClose={() => setAuthModalOpen(false)}
            onUpdateProfile={updateProfile}
          />

          {/* Global Variant Picker Modal */}
          <VariantPickerModal
            visible={pickerOpen}
            product={pickerProduct}
            variants={pickerVariants}
            onSelectVariant={(variant) => {
              if (pickerProduct) {
                addVariantToCart(variant, pickerProduct.name)
                Alert.alert(
                  'Variant Selected',
                  `Added ${pickerProduct.name} (${variant.sku}) to cart.`,
                  [
                    {
                      text: 'Open Register',
                      onPress: () => {
                        setPickerOpen(false)
                        setActiveTab('pos')
                      },
                    },
                    {
                      text: 'OK',
                      onPress: () => setPickerOpen(false),
                    },
                  ]
                )
              } else {
                setPickerOpen(false)
              }
            }}
            onClose={closePicker}
          />

          {/* Order Receipt Modal (for viewing historical or recent orders) */}
          <OrderReceiptModal
            visible={receiptOpen}
            order={viewingOrder}
            onClose={() => {
              setReceiptOpen(false)
              setViewingOrder(null)
            }}
            onNewSale={handleNewSaleFromReceipt}
            onNavigateSettings={() => handleNavigate('settings')}
            onUpdateStatus={handleUpdateOrderStatus}
            onUpdateOrder={handleUpdateOrder}
          />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  globalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm + 4,
    paddingBottom: tokens.spacing.sm + 4,
    backgroundColor: tokens.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerLeftGroup: {
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  headerLeft: {
    flexDirection: 'column',
    flexShrink: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoImg: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  offlineQueueBtn: {
    minHeight: 36,
    paddingHorizontal: tokens.spacing.sm + 2,
    backgroundColor: tokens.colors.badgeWarningBg,
    borderRadius: tokens.borderRadius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.statusWarning,
    gap: 4,
  },
  offlineQueueText: {
    color: tokens.colors.statusWarning,
    fontSize: 11,
    fontWeight: '700',
  },
  scannerBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
    ...tokens.shadows.card,
  },
  scannerBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  screenContainer: {
    flex: 1,
  },
  orderErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    zIndex: 999,
  },
  orderErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },
  orderRetryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  orderRetryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  orderDismissBtn: {
    padding: 4,
  },
})
