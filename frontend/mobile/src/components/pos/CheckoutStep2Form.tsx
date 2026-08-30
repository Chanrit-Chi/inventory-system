import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { Control, FieldErrors, UseFormSetValue } from 'react-hook-form'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'
import { ControlledInput } from '../ControlledInput'
import { CustomerLookupRow } from '../CustomerLookupRow'
import { getChannelPlatformMeta } from '../../screens/SalesChannelsScreen'
import type { CustomerLoyaltyInfo } from '../../hooks/useCustomerLookup'
import type {
  SalesChannel,
  DeliveryCompany,
  DeliveryZone,
  BankAccount,
  Customer,
  UserAccount,
} from '../../types'
import type { PosCheckoutFormValues } from '../../utils/validation'

export interface CheckoutStep2FormProps {
  scrollRef: React.RefObject<ScrollView | null>
  control: Control<PosCheckoutFormValues>
  setValue: UseFormSetValue<PosCheckoutFormValues>
  errors: FieldErrors<PosCheckoutFormValues>
  channels: SalesChannel[]
  activeChannel: SalesChannel | null
  channelId?: string
  onOpenChannelPicker: () => void
  users?: UserAccount[]
  selectedSeller?: UserAccount | null
  currentUserId?: string | null
  onOpenSellerPicker?: () => void
  onResetSellerToMe?: () => void
  phone: string
  name: string
  setPhone: (v: string) => void
  setName: (v: string) => void
  matchedCustomer: Customer | null
  customerSuggestions: Customer[]
  customerLookupStatus: 'idle' | 'searching' | 'found' | 'not_found' | 'error'
  loyaltyInfo?: CustomerLoyaltyInfo | null
  onSelectCustomer: (c: Customer) => void
  dismissSuggestions: () => void
  onResetCustomer: () => void
  isDelivery: boolean
  deliveryCompanies: DeliveryCompany[]
  selectedDeliveryCompany: string
  onOpenDeliveryPicker: () => void
  deliveryZones: DeliveryZone[]
  selectedDeliveryZone: DeliveryZone | null
  onOpenDeliveryZonePicker: () => void
  discountType: 'flat' | 'percentage'
  taxType: 'flat' | 'percentage'
  activePaymentMethod: string
  setActivePaymentMethod: (method: string) => void
  selectedBank: BankAccount | null
  onOpenBankPicker: () => void
}

export function CheckoutStep2Form({
  scrollRef,
  control,
  setValue,
  errors,
  channels,
  activeChannel,
  channelId,
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
  discountType,
  taxType,
  activePaymentMethod,
  setActivePaymentMethod,
  selectedBank,
  onOpenBankPicker,
}: CheckoutStep2FormProps) {
  const currentChannel =
    channels.find((c) => c.id === (channelId || activeChannel?.id)) ||
    activeChannel ||
    channels[0]
  const currentMeta = currentChannel ? getChannelPlatformMeta(currentChannel) : null

  const currentCompany =
    deliveryCompanies.find((d) => d.name === selectedDeliveryCompany) ||
    deliveryCompanies[0]
  const compColor = currentCompany?.color || tokens.colors.primaryContainer

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      {/* Sales Channel Dropdown Selector */}
      <View style={styles.channelSection}>
        <View style={styles.channelSectionHeader}>
          <View style={styles.channelSectionTitleWrap}>
            <Ionicons name="share-social" size={14} color={tokens.colors.primaryContainer} />
            <Text style={styles.channelSectionTitle}>Sales Channel</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.dropdownTrigger}
          onPress={onOpenChannelPicker}
          activeOpacity={0.75}
        >
          <View style={styles.dropdownTriggerLeft}>
            {currentMeta ? (
              <View
                style={[
                  styles.dropdownIconCircle,
                  { backgroundColor: currentMeta.bg },
                ]}
              >
                <Ionicons
                  name={currentMeta.icon}
                  size={16}
                  color={currentMeta.color}
                />
              </View>
            ) : null}
            <View style={styles.dropdownTextWrap}>
              <Text style={styles.dropdownValueText} numberOfLines={1}>
                {currentChannel?.name || 'Select Sales Channel'}
              </Text>
              {currentMeta ? (
                <Text style={styles.dropdownSubtext}>
                  {currentChannel?.code ? `[${currentChannel.code}] • ` : ''}
                  {currentMeta.label}
                </Text>
              ) : null}
            </View>
          </View>
          <Ionicons
            name="chevron-down"
            size={18}
            color={tokens.colors.secondary}
          />
        </TouchableOpacity>

        {Boolean(errors.channelId?.message) && (
          <Text style={styles.channelErrorText}>{errors.channelId?.message}</Text>
        )}
      </View>

      {/* Sales Representative (Incentive Credit) */}
      <View style={styles.channelSection}>
        <View style={styles.channelSectionHeader}>
          <View style={styles.channelSectionTitleWrap}>
            <Ionicons name="person-circle-outline" size={15} color={tokens.colors.primaryContainer} />
            <Text style={styles.channelSectionTitle}>Sales Rep (Incentive Credit)</Text>
          </View>
          {Boolean(selectedSeller && currentUserId && selectedSeller.id !== currentUserId) && (
            <TouchableOpacity onPress={onResetSellerToMe} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.resetToMeLink}>Reset to Me</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.dropdownTrigger}
          onPress={onOpenSellerPicker}
          activeOpacity={0.75}
        >
          <View style={styles.dropdownTriggerLeft}>
            <View
              style={[
                styles.dropdownIconCircle,
                { backgroundColor: selectedSeller?.id && selectedSeller?.id !== currentUserId ? tokens.colors.primaryFixed : tokens.colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name="person"
                size={15}
                color={selectedSeller?.id && selectedSeller?.id !== currentUserId ? tokens.colors.primary : tokens.colors.secondary}
              />
            </View>
            <View style={styles.dropdownTextWrap}>
              <Text style={styles.dropdownValueText} numberOfLines={1}>
                {selectedSeller?.name || 'Logged-In Staff'}
                {selectedSeller?.id === currentUserId ? ' (Me)' : ''}
              </Text>
              <Text style={styles.dropdownSubtext}>
                {selectedSeller?.id && selectedSeller?.id !== currentUserId
                  ? `Assisted Sale • ${selectedSeller?.role || 'Sales'}`
                  : `${selectedSeller?.role || 'Staff'} • Normal Sale Credit`}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-down"
            size={18}
            color={tokens.colors.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Delivery & Fulfillment Preference Section */}
      <View style={styles.deliverySection}>
        <View style={styles.deliveryHeaderRow}>
          <View style={styles.deliveryTitleWrap}>
            <Ionicons name="bicycle-outline" size={14} color={tokens.colors.primaryContainer} />
            <Text style={styles.deliverySectionTitle}>Fulfillment</Text>
          </View>

          {/* Delivery vs In-Store Toggle */}
          <View style={styles.fulfillmentToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, isDelivery && styles.toggleBtnActive]}
              onPress={() => setValue('isDelivery', true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="car-outline"
                size={12}
                color={
                  isDelivery ? tokens.colors.onPrimary : tokens.colors.secondary
                }
              />
              <Text
                style={[
                  styles.toggleBtnText,
                  isDelivery && styles.toggleBtnTextActive,
                ]}
              >
                Delivery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, !isDelivery && styles.toggleBtnActive]}
              onPress={() => setValue('isDelivery', false)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="storefront-outline"
                size={12}
                color={
                  !isDelivery
                    ? tokens.colors.onPrimary
                    : tokens.colors.secondary
                }
              />
              <Text
                style={[
                  styles.toggleBtnText,
                  !isDelivery && styles.toggleBtnTextActive,
                ]}
              >
                In-Store
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Details when Delivery is active */}
        {Boolean(isDelivery) && (
          <View style={styles.deliveryFormBox}>
            {/* Delivery Service Dropdown */}
            <Text style={styles.deliveryFieldLabel}>Delivery Service</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={onOpenDeliveryPicker}
              activeOpacity={0.75}
            >
              <View style={styles.dropdownTriggerLeft}>
                <View
                  style={[
                    styles.dropdownIconCircle,
                    { backgroundColor: `${compColor}18` },
                  ]}
                >
                  <Ionicons
                    name={(currentCompany?.logoIcon as any) ?? 'car'}
                    size={16}
                    color={compColor}
                  />
                </View>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownValueText} numberOfLines={1}>
                    {currentCompany?.name || 'Select Delivery Service'}
                  </Text>
                  <Text style={styles.dropdownSubtext}>
                    {currentCompany?.isDefault
                      ? 'Default Service'
                      : 'Express Delivery'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-down"
                size={18}
                color={tokens.colors.secondary}
              />
            </TouchableOpacity>

            {/* Customer Delivery Address Input */}
            <ControlledInput
              name="deliveryAddress"
              control={control}
              label="Customer Delivery Address *"
              placeholder="Street address, Khan / Sangkat, province..."
            />

            {/* Delivery Zones Dropdown */}
            <Text style={[styles.deliveryFieldLabel, { marginTop: 12 }]}>
              Delivery Zone / Cost
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                {
                  marginBottom:
                    selectedDeliveryZone?.id === 'custom' ? 12 : 0,
                },
              ]}
              onPress={onOpenDeliveryZonePicker}
              activeOpacity={0.75}
            >
              <View style={styles.dropdownTriggerLeft}>
                <View
                  style={[
                    styles.dropdownIconCircle,
                    {
                      backgroundColor: `${tokens.colors.primaryContainer}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name="map"
                    size={16}
                    color={tokens.colors.primaryContainer}
                  />
                </View>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownValueText} numberOfLines={1}>
                    {selectedDeliveryZone
                      ? selectedDeliveryZone.name
                      : 'Select Delivery Zone'}
                  </Text>
                  <Text style={styles.dropdownSubtext}>
                    {selectedDeliveryZone?.id === 'custom'
                      ? 'Manual negotiated input'
                      : selectedDeliveryZone
                      ? `$${(
                          parseFloat(
                            String(selectedDeliveryZone.cost || '0')
                          ) || 0
                        ).toFixed(2)}`
                      : 'Select a zone for pricing'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-down"
                size={18}
                color={tokens.colors.secondary}
              />
            </TouchableOpacity>

            {/* Custom Delivery Fee Input */}
            {selectedDeliveryZone?.id === 'custom' && (
              <ControlledInput
                name="customDeliveryFee"
                control={control}
                label="Custom Delivery Fee ($) *"
                placeholder="e.g. 15.00"
                inputProps={{ keyboardType: 'decimal-pad' }}
              />
            )}
          </View>
        )}
      </View>

      {/* Customer & Loyalty Row */}
      <CustomerLookupRow
        phone={phone}
        name={name}
        matchedCustomer={matchedCustomer}
        suggestions={customerSuggestions}
        status={customerLookupStatus}
        loyaltyInfo={loyaltyInfo || null}
        onPhoneChange={(val) => {
          setPhone(val)
          setValue('customerPhone', val, { shouldValidate: true })
        }}
        onNameChange={(val) => {
          setName(val)
          setValue('customerName', val, { shouldValidate: true })
        }}
        onSelectCustomer={onSelectCustomer}
        onDismissSuggestions={dismissSuggestions}
        onReset={onResetCustomer}
        phoneError={errors.customerPhone?.message}
        nameError={errors.customerName?.message}
      />

      {/* Discount Section */}
      <View style={styles.discountSection}>
        <View style={styles.discountHeaderRow}>
          <Ionicons name="pricetag-outline" size={14} color={tokens.colors.primaryContainer} />
          <Text style={styles.deliverySectionTitle}>Global Discount</Text>
        </View>
        <View style={styles.typeToggleContainer}>
          <TouchableOpacity
            style={[
              styles.typeToggleBtn,
              discountType === 'flat' && styles.typeToggleBtnActive,
            ]}
            onPress={() => setValue('discountType', 'flat')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeToggleText,
                discountType === 'flat' && styles.typeToggleTextActive,
              ]}
            >
              Flat ($)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeToggleBtn,
              discountType === 'percentage' && styles.typeToggleBtnActive,
            ]}
            onPress={() => setValue('discountType', 'percentage')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeToggleText,
                discountType === 'percentage' && styles.typeToggleTextActive,
              ]}
            >
              Percent (%)
            </Text>
          </TouchableOpacity>
        </View>
        <ControlledInput
          name="discountInput"
          control={control}
          label={
            discountType === 'percentage'
              ? 'Discount Rate (%)'
              : 'Discount Amount ($)'
          }
          placeholder="0.00"
          inputProps={{ keyboardType: 'decimal-pad', returnKeyType: 'done' }}
        />
      </View>

      {/* Tax Section */}
      <View style={styles.discountSection}>
        <View style={styles.discountHeaderRow}>
          <Ionicons name="calculator-outline" size={14} color={tokens.colors.primaryContainer} />
          <Text style={styles.deliverySectionTitle}>Tax</Text>
        </View>
        <View style={styles.typeToggleContainer}>
          <TouchableOpacity
            style={[
              styles.typeToggleBtn,
              taxType === 'flat' && styles.typeToggleBtnActive,
            ]}
            onPress={() => setValue('taxType', 'flat')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeToggleText,
                taxType === 'flat' && styles.typeToggleTextActive,
              ]}
            >
              Flat ($)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeToggleBtn,
              taxType === 'percentage' && styles.typeToggleBtnActive,
            ]}
            onPress={() => setValue('taxType', 'percentage')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeToggleText,
                taxType === 'percentage' && styles.typeToggleTextActive,
              ]}
            >
              Percent (%)
            </Text>
          </TouchableOpacity>
        </View>
        <ControlledInput
          name="taxInput"
          control={control}
          label={
            taxType === 'percentage' ? 'Tax Rate (%)' : 'Tax Amount ($)'
          }
          placeholder="0.00"
          inputProps={{ keyboardType: 'decimal-pad', returnKeyType: 'done' }}
        />
      </View>

      {/* Payment Method Section */}
      <View style={styles.paymentMethodSection}>
        <View style={styles.discountHeaderRow}>
          <Ionicons name="wallet-outline" size={14} color={tokens.colors.primaryContainer} />
          <Text style={styles.deliverySectionTitle}>Payment Method</Text>
        </View>
        <View style={styles.paymentMethodToggle}>
          <TouchableOpacity
            style={[
              styles.paymentMethodBtn,
              activePaymentMethod === 'Cash' &&
                styles.paymentMethodBtnActive,
            ]}
            onPress={() => setActivePaymentMethod('Cash')}
          >
            <Ionicons
              name="cash-outline"
              size={16}
              color={
                activePaymentMethod === 'Cash'
                  ? tokens.colors.onPrimary
                  : tokens.colors.secondary
              }
            />
            <Text
              style={[
                styles.paymentMethodBtnText,
                activePaymentMethod === 'Cash' &&
                  styles.paymentMethodBtnTextActive,
              ]}
            >
              Cash
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.paymentMethodBtn,
              activePaymentMethod === 'Bank' &&
                styles.paymentMethodBtnActive,
            ]}
            onPress={() => {
              setActivePaymentMethod('Bank')
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true })
              }, 150)
            }}
          >
            <Ionicons
              name="card-outline"
              size={16}
              color={
                activePaymentMethod === 'Bank'
                  ? tokens.colors.onPrimary
                  : tokens.colors.secondary
              }
            />
            <Text
              style={[
                styles.paymentMethodBtnText,
                activePaymentMethod === 'Bank' &&
                  styles.paymentMethodBtnTextActive,
              ]}
            >
              Bank Transfer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bank Selector List */}
        {activePaymentMethod === 'Bank' && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.deliveryFieldLabel}>Select Bank</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={onOpenBankPicker}
              activeOpacity={0.75}
            >
              <View style={styles.dropdownTriggerLeft}>
                <View
                  style={[
                    styles.dropdownIconCircle,
                    {
                      backgroundColor: `${tokens.colors.primaryContainer}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name="business"
                    size={16}
                    color={tokens.colors.primaryContainer}
                  />
                </View>
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownValueText} numberOfLines={1}>
                    {selectedBank
                      ? selectedBank.bankName
                      : 'Select Bank Account'}
                  </Text>
                  <Text style={styles.dropdownSubtext}>
                    {selectedBank
                      ? `${selectedBank.accountName} • ${selectedBank.accountNumber}`
                      : 'Choose an account'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-down"
                size={18}
                color={tokens.colors.secondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  channelSection: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.cardInnerDepth,
  },
  channelSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelSectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetToMeLink: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  channelErrorText: {
    fontSize: 12,
    color: tokens.colors.statusError,
    marginTop: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  dropdownSubtext: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  deliverySection: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.cardInnerDepth,
  },
  deliveryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliverySectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fulfillmentToggle: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.xs,
    gap: 4,
  },
  toggleBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  toggleBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  deliveryFormBox: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.borderSubtle,
    paddingTop: 12,
  },
  deliveryFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  discountSection: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.cardInnerDepth,
  },
  discountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeToggleBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  typeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  typeToggleTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  paymentMethodSection: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.cardInnerDepth,
  },
  paymentMethodToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceAlt,
    gap: 6,
  },
  paymentMethodBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  paymentMethodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  paymentMethodBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
})
