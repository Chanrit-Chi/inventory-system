import React from 'react'
import { View } from 'react-native'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { VariantPickerModal } from '../components/VariantPickerModal'
import { OrderReceiptModal } from '../components/OrderReceiptModal'
import { ListPickerModal } from '../components/pos/ListPickerModal'
import { SellerPickerModal } from '../components/pos/SellerPickerModal'
import { SellerDailySummaryModal } from '../components/seller/SellerDailySummaryModal'
import { usePosScreen } from './pos/hooks/usePosScreen'
import { PosHeaderToolbar } from './pos/components/PosHeaderToolbar'
import { PosProductCatalogGrid } from './pos/components/PosProductCatalogGrid'
import { PosCartBottomBar } from './pos/components/PosCartBottomBar'
import { PosCheckoutModal } from './pos/components/PosCheckoutModal'
import { styles } from './pos/PosScreen.styles'

export interface PosScreenProps {
  onNavigate?: (tab: import('../types').TabType) => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onOpenScanner?: () => void
  onOpenSidebar?: () => void
  cartHook?: ReturnType<typeof import('../hooks/useCart').useCart>
  offlineQueueHook?: ReturnType<typeof import('../hooks/useOfflineQueue').useOfflineQueue>
  onCheckoutStateChange?: (isActive: boolean) => void
}

export default function PosScreen({
  onNavigate,
  onOpenScanner,
  onOpenSidebar,
  cartHook,
  offlineQueueHook,
  onCheckoutStateChange,
}: PosScreenProps) {
  const [dailySummaryModalOpen, setDailySummaryModalOpen] = React.useState(false)
  const {
    // Search & Category
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategory,
    setSelectedCategory,
    // Collapsible Header
    headerTranslateY,
    headerOpacity,
    onScroll,
    onLayoutHeader,
    headerHeight,
    // Products
    filteredProducts,
    isLoadingProducts,
    productsError,
    refreshing,
    onRefresh,
    loadMoreProducts,
    loadingMoreProducts,
    hasMoreProducts,
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
    // Checkout
    checkoutSheetOpen,
    setCheckoutSheetOpen,
    checkoutStep,
    handleSetCheckoutStep,
    receiptOpen,
    completedOrder,
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
    totalItemCount,
    cartTotal,
    stockWarnings,
    hasOutOfStockItems,
    updateQuantity,
    removeFromCart,
    setItemQuantity,
    clearCart,
    addVariantToCart,
    addMultipleItemsToCart,
    // Customer Lookup
    phone,
    name,
    setPhone,
    setName,
    matchedCustomer,
    customerSuggestions,
    customerLookupStatus,
    loyaltyInfo,
    dismissSuggestions,
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
    // Channels
    channels,
    activeChannel,
    setActiveChannel,
    // Product selection
    handleSelectProduct,
  } = usePosScreen({
    onNavigate,
    onOpenScanner,
    onOpenSidebar,
    cartHook,
    offlineQueueHook,
    onCheckoutStateChange,
  })

  return (
    <View style={styles.container}>
      {!checkoutSheetOpen && (
        <>
          {/* Collapsible Header Toolbar */}
          <PosHeaderToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            headerTranslateY={headerTranslateY}
            headerOpacity={headerOpacity}
            onLayoutHeader={onLayoutHeader}
          />

          {/* Product Catalog Grid */}
          <PosProductCatalogGrid
            products={filteredProducts}
            isLoadingProducts={isLoadingProducts && filteredProducts.length === 0}
            productsError={productsError}
            headerHeight={headerHeight}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onScroll={onScroll}
            onRetry={onRefresh}
            onSelectProduct={handleSelectProduct}
            onLoadMore={loadMoreProducts}
            loadingMore={loadingMoreProducts}
            hasMore={hasMoreProducts}
          />

          {/* Floating Cart Bottom Bar */}
          <PosCartBottomBar
            totalItems={totalItemCount}
            totalPrice={cartTotal}
            onPress={() => setCheckoutSheetOpen(true)}
          />
        </>
      )}

      {/* Multi-Step Checkout Modal */}
      <PosCheckoutModal
        visible={checkoutSheetOpen}
        checkoutStep={checkoutStep}
        onSetCheckoutStep={handleSetCheckoutStep}
        onClose={() => {
          setCheckoutSheetOpen(false)
          handleSetCheckoutStep(1)
        }}
        totalItemCount={totalItemCount}
        cart={cart}
        stockWarnings={stockWarnings}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        setItemQuantity={setItemQuantity}
        clearCart={clearCart}
        hasOutOfStockItems={hasOutOfStockItems}
        formMethods={formMethods}
        channels={channels}
        activeChannel={activeChannel}
        onOpenChannelPicker={() => setChannelPickerOpen(true)}
        users={staffUsers}
        selectedSeller={selectedSeller}
        currentUserId={currentUser?.id}
        onOpenSellerPicker={() => setSellerPickerOpen(true)}
        onResetSellerToMe={handleResetSellerToMe}
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
        isDelivery={Boolean(isDelivery)}
        deliveryCompanies={deliveryCompanies}
        selectedDeliveryCompany={selectedDeliveryCompany}
        onOpenDeliveryPicker={() => setDeliveryPickerOpen(true)}
        deliveryZones={deliveryZones}
        selectedDeliveryZone={selectedDeliveryZone}
        onOpenDeliveryZonePicker={() => setDeliveryZonePickerOpen(true)}
        activePaymentMethod={activePaymentMethod}
        setActivePaymentMethod={setActivePaymentMethod}
        selectedBank={selectedBank}
        onOpenBankPicker={() => setBankPickerOpen(true)}
        cartTotal={cartTotal}
        checkoutLoading={checkoutLoading}
        onSubmitCheckout={executeCheckout}
      />

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanCode={async (code) => {
          await handleScanCode(code)
        }}
        isLoading={scanLoading}
        scannedItems={cart.map((item) => ({
          id: item.variantId,
          name: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          priceOrCost: item.unitPrice,
          imageUrl: item.imageUrl,
        }))}
        totalCount={totalItemCount}
        totalValue={cartTotal}
        onUpdateItemQuantity={(id, delta) => updateQuantity(id, delta)}
        onRemoveItem={(id) => removeFromCart(id)}
        primaryActionLabel="Go to Register"
        onPrimaryAction={() => setScannerOpen(false)}
        feedback={scanFeedback}
      />

      {/* Variant Picker Modal */}
      <VariantPickerModal
        visible={pickerOpen}
        product={pickerProduct}
        variants={pickerVariants}
        onAddMultipleVariants={(items) => {
          if (pickerProduct) {
            const itemsToAdd = items.map(({ variant, quantity }) => {
              const rawPrice =
                variant.selling_price_override ??
                variant.selling_price ??
                variant.product?.selling_price ??
                pickerProduct.selling_price ??
                '0'
              const unitPrice = parseFloat(String(rawPrice)) || 0
              const availableStock = variant.quantity_on_hand ?? 0
              const attrs = variant.attribute_values
                ?.map((av) => `${av.attribute?.name ? av.attribute.name + ': ' : ''}${av.value_name}`)
                .join(', ')
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
        onSelectVariant={(variant) => {
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
        selectedId={formMethods.watch('channelId') || activeChannel?.id}
        onSelect={(item) => {
          formMethods.setValue('channelId', item.id)
          const found = channels.find((c) => c.id === item.id) || null
          setActiveChannel(found)
          setChannelPickerOpen(false)
        }}
      />

      {/* Delivery Service Picker */}
      <ListPickerModal
        visible={deliveryPickerOpen}
        onClose={() => setDeliveryPickerOpen(false)}
        title="Select Delivery Service"
        titleIcon="car-outline"
        items={deliveryCompanyPickerItems}
        selectedId={deliveryCompanies.find((c) => c.name === selectedDeliveryCompany)?.id}
        onSelect={(item) => {
          setSelectedDeliveryCompany(item.title)
          setDeliveryPickerOpen(false)
        }}
      />

      {/* Delivery Zone Picker */}
      <ListPickerModal
        visible={deliveryZonePickerOpen}
        onClose={() => setDeliveryZonePickerOpen(false)}
        title="Select Delivery Zone"
        titleIcon="map-outline"
        items={deliveryZonePickerItems}
        selectedId={selectedDeliveryZone?.id}
        onSelect={(item) => {
          if (item.id === 'custom') {
            setSelectedDeliveryZone({
              id: 'custom',
              name: 'Custom / Negotiated',
              cost: 0,
              isActive: true,
              isDefault: false,
            })
          } else {
            const found = deliveryZones.find((z) => z.id === item.id) || null
            setSelectedDeliveryZone(found)
          }
          setDeliveryZonePickerOpen(false)
        }}
      />

      {/* Bank Picker */}
      <ListPickerModal
        visible={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        title="Select Bank"
        titleIcon="business-outline"
        items={bankPickerItems}
        selectedId={selectedBank?.id}
        onSelect={(item) => {
          const found = bankAccounts.find((b) => b.id === item.id) || null
          setSelectedBank(found)
          setBankPickerOpen(false)
        }}
      />

      {/* Sales Representative Picker */}
      <SellerPickerModal
        visible={sellerPickerOpen}
        onClose={() => setSellerPickerOpen(false)}
        users={staffUsers}
        selectedSellerId={selectedSeller?.id || null}
        currentUserId={currentUser?.id}
        onSelectSeller={handleSelectSeller}
        onResetToMe={handleResetSellerToMe}
      />

      {/* Seller Daily Sales Summary & Reconciliation Modal */}
      <SellerDailySummaryModal
        visible={dailySummaryModalOpen}
        onClose={() => setDailySummaryModalOpen(false)}
        currentUser={currentUser || null}
      />
    </View>
  )
}