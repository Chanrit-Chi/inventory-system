import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PosScreen.styles'
import { CartList } from '../../../components/CartList'
import { CheckoutStep2Form } from '../../../components/pos/CheckoutStep2Form'
import { CheckoutStep3Summary } from '../../../components/pos/CheckoutStep3Summary'
import type { UseFormReturn } from 'react-hook-form'
import type { PosCheckoutFormValues } from '../../../utils/validation'
import type {
  CartItem,
  SalesChannel,
  Customer,
  DeliveryCompany,
  DeliveryZone,
  BankAccount,
  UserAccount,
} from '../../../types'

export interface PosCheckoutModalProps {
  visible: boolean
  checkoutStep: 1 | 2 | 3
  onSetCheckoutStep: (step: 1 | 2 | 3) => void
  onClose: () => void
  totalItemCount: number
  cart: CartItem[]
  stockWarnings: { [variantId: string]: string }
  updateQuantity: (id: string, delta: number) => void
  removeFromCart: (id: string) => void
  setItemQuantity: (id: string, qty: number) => void
  clearCart: () => void
  hasOutOfStockItems: boolean
  formMethods: UseFormReturn<PosCheckoutFormValues>
  channels: SalesChannel[]
  activeChannel: SalesChannel | null
  onOpenChannelPicker: () => void
  users?: UserAccount[]
  selectedSeller?: UserAccount | null
  currentUserId?: string | null
  onOpenSellerPicker?: () => void
  onResetSellerToMe?: () => void
  phone: string
  name: string
  setPhone: (p: string) => void
  setName: (n: string) => void
  matchedCustomer: Customer | null
  customerSuggestions: Customer[]
  customerLookupStatus: 'idle' | 'searching' | 'found' | 'not_found' | 'error'
  loyaltyInfo: { points?: number; tier?: string; availableForRedemption?: boolean } | null
  onSelectCustomer: (c: Customer) => void
  dismissSuggestions: () => void
  onResetCustomer: () => void
  isDelivery: boolean
  deliveryCompanies: DeliveryCompany[]
  selectedDeliveryCompany?: string
  onOpenDeliveryPicker: () => void
  deliveryZones: DeliveryZone[]
  selectedDeliveryZone: DeliveryZone | null
  onOpenDeliveryZonePicker: () => void
  activePaymentMethod: string
  setActivePaymentMethod: (m: string) => void
  selectedBank: BankAccount | null
  onOpenBankPicker: () => void
  cartTotal: number
  checkoutLoading: boolean
  onSubmitCheckout: (data: PosCheckoutFormValues) => void
}

export const PosCheckoutModal: React.FC<PosCheckoutModalProps> = ({
  visible,
  checkoutStep,
  onSetCheckoutStep,
  onClose,
  totalItemCount,
  cart,
  stockWarnings,
  updateQuantity,
  removeFromCart,
  setItemQuantity,
  clearCart,
  hasOutOfStockItems,
  formMethods,
  channels,
  activeChannel,
  onOpenChannelPicker,
  users = [],
  selectedSeller,
  currentUserId,
  onOpenSellerPicker,
  onResetSellerToMe,
  phone,
  name,
  setPhone,
  setName,
  matchedCustomer,
  customerSuggestions,
  customerLookupStatus,
  loyaltyInfo,
  onSelectCustomer,
  dismissSuggestions,
  onResetCustomer,
  isDelivery,
  deliveryCompanies,
  selectedDeliveryCompany,
  onOpenDeliveryPicker,
  deliveryZones,
  selectedDeliveryZone,
  onOpenDeliveryZonePicker,
  activePaymentMethod,
  setActivePaymentMethod,
  selectedBank,
  onOpenBankPicker,
  cartTotal,
  checkoutLoading,
  onSubmitCheckout,
}) => {
  if (!visible) return null

  const {
    control,
    setValue,
    watch,
    trigger,
    handleSubmit,
    formState: { errors },
  } = formMethods

  const discountType = watch('discountType')
  const discountInput = watch('discountInput')
  const taxType = watch('taxType')
  const taxInput = watch('taxInput')
  const taxRate = watch('taxRate')
  const customDeliveryFee = watch('customDeliveryFee')
  const orderStatus = watch('orderStatus')
  const scrollRef = React.useRef<ScrollView | null>(null)

  return (
    <View style={styles.checkoutSheetSafeArea}>
      <View style={styles.checkoutSheetContainer}>
        {/* Header */}
        <View style={styles.checkoutSheetHeader}>
          <View style={styles.checkoutSheetHeaderTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {checkoutStep > 1 && (
                <TouchableOpacity
                  onPress={() => onSetCheckoutStep((checkoutStep - 1) as 1 | 2 | 3)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={24} color={tokens.colors.onBackground} />
                </TouchableOpacity>
              )}
              <View>
                <Text style={styles.checkoutSheetTitle}>
                  {checkoutStep === 1
                    ? 'Current Sale'
                    : checkoutStep === 2
                    ? 'Checkout Details'
                    : 'Order Summary'}
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
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close checkout sheet"
            >
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Stepper Indicator */}
          <View style={styles.stepperContainer}>
            <View style={[styles.stepDot, checkoutStep >= 1 && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, checkoutStep >= 1 && styles.stepDotTextActive]}>
                1
              </Text>
            </View>
            <View style={[styles.stepLine, checkoutStep >= 2 && styles.stepLineActive]} />
            <View style={[styles.stepDot, checkoutStep >= 2 && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, checkoutStep >= 2 && styles.stepDotTextActive]}>
                2
              </Text>
            </View>
            <View style={[styles.stepLine, checkoutStep >= 3 && styles.stepLineActive]} />
            <View style={[styles.stepDot, checkoutStep >= 3 && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, checkoutStep >= 3 && styles.stepDotTextActive]}>
                3
              </Text>
            </View>
          </View>
        </View>

        {/* Step 1: Cart Items List */}
        {checkoutStep === 1 && (
          <View style={styles.cartListContainer}>
            <CartList
              cart={cart}
              stockWarnings={stockWarnings}
              onIncrease={(id) => updateQuantity(id, 1)}
              onDecrease={(id) => updateQuantity(id, -1)}
              onRemove={removeFromCart}
              onSetQuantity={setItemQuantity}
              onClearCart={clearCart}
            />
          </View>
        )}

        {/* Step 2: Customer, Channels & Fulfillment */}
        {checkoutStep === 2 && (
          <CheckoutStep2Form
            scrollRef={scrollRef}
            control={control}
            setValue={setValue}
            errors={errors}
            channels={channels}
            activeChannel={activeChannel}
            channelId={watch('channelId')}
            onOpenChannelPicker={onOpenChannelPicker}
            users={users}
            selectedSeller={selectedSeller}
            currentUserId={currentUserId}
            onOpenSellerPicker={onOpenSellerPicker}
            onResetSellerToMe={onResetSellerToMe}
            phone={phone}
            name={name}
            setPhone={setPhone}
            setName={setName}
            matchedCustomer={matchedCustomer}
            customerSuggestions={customerSuggestions}
            customerLookupStatus={customerLookupStatus}
            loyaltyInfo={loyaltyInfo as any}
            onSelectCustomer={onSelectCustomer}
            dismissSuggestions={dismissSuggestions}
            onResetCustomer={onResetCustomer}
            isDelivery={isDelivery}
            deliveryCompanies={deliveryCompanies}
            selectedDeliveryCompany={selectedDeliveryCompany || ''}
            onOpenDeliveryPicker={onOpenDeliveryPicker}
            deliveryZones={deliveryZones}
            selectedDeliveryZone={selectedDeliveryZone}
            onOpenDeliveryZonePicker={onOpenDeliveryZonePicker}
            discountType={discountType}
            taxType={taxType}
            activePaymentMethod={activePaymentMethod}
            setActivePaymentMethod={setActivePaymentMethod}
            selectedBank={selectedBank}
            onOpenBankPicker={onOpenBankPicker}
          />
        )}

        {/* Step 3: Summary & Confirmation */}
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

        {/* Bottom Actions */}
        {checkoutStep === 1 && (
          <View style={styles.stepOneActionContainer}>
            <TouchableOpacity
              style={[
                styles.continueToDetailsBtn,
                (cart.length === 0 || hasOutOfStockItems) &&
                  styles.continueToDetailsBtnDisabled,
              ]}
              onPress={() => onSetCheckoutStep(2)}
              disabled={cart.length === 0 || hasOutOfStockItems}
            >
              <Text style={styles.continueToDetailsText}>
                {hasOutOfStockItems
                  ? 'Resolve Stock Warnings to Proceed'
                  : 'Next: Checkout Details'}
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
                  onSetCheckoutStep(3)
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
              onPress={() => onSetCheckoutStep(2)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={16} color={tokens.colors.onBackground} />
              <Text style={styles.stepThreeBackText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.stepThreeConfirmBtn,
                {
                  backgroundColor:
                    orderStatus === 'pending' ? '#D97706' : tokens.colors.statusSuccess,
                },
              ]}
              onPress={handleSubmit(onSubmitCheckout)}
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
  )
}
