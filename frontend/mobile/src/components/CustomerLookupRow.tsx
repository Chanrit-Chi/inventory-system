import React from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { Customer } from '../types'
import { type LookupStatus, type CustomerLoyaltyInfo, calculateLoyalty } from '../hooks/useCustomerLookup'

interface CustomerLookupRowProps {
  phone: string
  name: string
  matchedCustomer: Customer | null
  suggestions?: Customer[]
  status: LookupStatus
  loyaltyInfo: CustomerLoyaltyInfo | null
  onPhoneChange: (text: string) => void
  onNameChange: (text: string) => void
  onSelectCustomer?: (customer: Customer) => void
  onDismissSuggestions?: () => void
  onReset: () => void
  phoneError?: string
  nameError?: string
}

export const CustomerLookupRow: React.FC<CustomerLookupRowProps> = React.memo(({
  phone,
  name,
  matchedCustomer,
  suggestions = [],
  status,
  loyaltyInfo,
  onPhoneChange,
  onNameChange,
  onSelectCustomer,
  onDismissSuggestions,
  onReset,
  phoneError,
  nameError,
}) => {
  const hasContent = phone.length > 0 || name.length > 0

  const getTierDetails = (tier: string) => {
    switch (tier) {
      case 'Platinum':
        return {
          bg: tokens.colors.tierPlatinumBg,
          text: tokens.colors.tierPlatinum,
          border: tokens.colors.tierPlatinumBorder,
          icon: 'diamond-outline' as const,
          label: 'Platinum Tier',
        }
      case 'Gold':
        return {
          bg: tokens.colors.tierGoldBg,
          text: tokens.colors.tierGold,
          border: tokens.colors.tierGoldBorder,
          icon: 'ribbon-outline' as const,
          label: 'Gold Tier',
        }
      case 'Silver':
        return {
          bg: tokens.colors.tierSilverBg,
          text: tokens.colors.tierSilver,
          border: tokens.colors.tierSilverBorder,
          icon: 'medal-outline' as const,
          label: 'Silver Tier',
        }
      case 'Bronze':
      default:
        return {
          bg: tokens.colors.tierBronzeBg,
          text: tokens.colors.tierBronze,
          border: tokens.colors.tierBronzeBorder,
          icon: 'star-outline' as const,
          label: 'Bronze Tier',
        }
    }
  }

  const tierDetails = loyaltyInfo ? getTierDetails(loyaltyInfo.tier) : null
  const pointsEstimate = loyaltyInfo ? Math.floor(loyaltyInfo.totalSpent) : 0
  const showSuggestions = !matchedCustomer && suggestions.length > 0

  return (
    <View style={styles.container}>
      {/* Header bar: Title, Status/Tier Badge, and Reset Button */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Ionicons name="person-outline" size={14} color={tokens.colors.primaryContainer} />
          <Text style={styles.sectionLabel}>Customer & Loyalty</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Lookup status indicator badges */}
          {status === 'searching' && (
            <View style={[styles.statusBadge, styles.badgeSearching]}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} style={styles.spinner} />
              <Text style={styles.badgeSearchingText}>Searching...</Text>
            </View>
          )}

          {matchedCustomer && tierDetails ? (
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: tierDetails.bg, borderColor: tierDetails.border },
              ]}
            >
              <Ionicons name={tierDetails.icon} size={12} color={tierDetails.text} />
              <Text style={[styles.tierBadgeText, { color: tierDetails.text }]}>
                {tierDetails.label}
              </Text>
            </View>
          ) : null}

          {Boolean(!matchedCustomer && suggestions.length === 0 && phone.trim().length >= 3 && status !== 'searching') && (
            <View style={[styles.statusBadge, styles.badgeNew]}>
              <Text style={styles.badgeNewText}>+ New Member</Text>
            </View>
          )}

          {Boolean(hasContent) && (
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={onReset}
              accessibilityRole="button"
              accessibilityLabel="Clear customer info"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.resetBtnText}>{matchedCustomer ? 'Change' : 'Clear'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Input Row: Phone and Name */}
      <View style={styles.inputsRow}>
        <View style={{ flex: 1 }}>
          <View style={[styles.inputWrapper, phoneError ? styles.inputWrapperError : null]}>
            <Ionicons name="call-outline" size={14} color={tokens.colors.secondary} style={styles.inputPrefix} />
            <TextInput
              testID="input-customer-phone"
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={tokens.colors.textDisabled}
              value={phone}
              onChangeText={onPhoneChange}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={[styles.inputWrapper, nameError ? styles.inputWrapperError : null]}>
            <Ionicons name="pricetag-outline" size={14} color={tokens.colors.secondary} style={styles.inputPrefix} />
            <TextInput
              testID="input-customer-name"
              style={styles.input}
              placeholder="Customer name"
              placeholderTextColor={tokens.colors.textDisabled}
              value={name}
              onChangeText={onNameChange}
              returnKeyType="done"
            />
          </View>
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
        </View>
      </View>

      {/* Suggestions Dropdown Popover */}
      {Boolean(showSuggestions) && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="people" size={13} color={tokens.colors.primary} />
              <Text style={styles.suggestionsTitle}>
                Matching Customers ({suggestions.length})
              </Text>
            </View>
            {Boolean(onDismissSuggestions) && (
              <TouchableOpacity onPress={onDismissSuggestions} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {suggestions.map((c) => {
              const cLoyalty = calculateLoyalty(c)
              const cTier = getTierDetails(cLoyalty.tier)
              const spent = cLoyalty.totalSpent

              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.suggestionCard}
                  onPress={() => onSelectCustomer && onSelectCustomer(c)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionLeft}>
                    <View style={styles.suggestionNameRow}>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <View style={[styles.miniTierBadge, { backgroundColor: cTier.bg, borderColor: cTier.border }]}>
                        <Text style={[styles.miniTierText, { color: cTier.text }]}>{cLoyalty.tier}</Text>
                      </View>
                    </View>

                    <View style={styles.suggestionMetaRow}>
                      <Text style={styles.suggestionPhone}>📞 {c.phone}</Text>
                      {c.address ? (
                        <Text style={styles.suggestionAddress} numberOfLines={1}>
                          📍 {c.address}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.suggestionStats}>
                      Spent ${spent.toFixed(2)} • {cLoyalty.totalPurchased} {cLoyalty.totalPurchased === 1 ? 'order' : 'orders'}
                    </Text>
                  </View>

                  <View style={styles.suggestionSelectBtn}>
                    <Text style={styles.suggestionSelectText}>Select</Text>
                    <Ionicons name="chevron-forward" size={14} color={tokens.colors.primary} />
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* Matched Customer Loyalty Stats Card */}
      {matchedCustomer && loyaltyInfo ? (
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyMetric}>
            <Text style={styles.metricLabel}>POINTS</Text>
            <Text style={styles.metricValue}>
              ⭐ {pointsEstimate.toLocaleString()}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.loyaltyMetric}>
            <Text style={styles.metricLabel}>LIFETIME SPENT</Text>
            <Text style={styles.metricValue}>
              ${loyaltyInfo.totalSpent.toFixed(2)}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.loyaltyMetric}>
            <Text style={styles.metricLabel}>ORDERS</Text>
            <Text style={styles.metricValue}>
              {loyaltyInfo.totalPurchased} {loyaltyInfo.totalPurchased === 1 ? 'sale' : 'sales'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  sectionLabel: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
  },
  spinner: {
    marginRight: 4,
  },
  badgeSearching: {
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  badgeSearchingText: {
    color: tokens.colors.primaryContainer,
    fontSize: 11,
    fontWeight: '600',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    gap: 4,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeNew: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  badgeNewText: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  resetBtn: {
    minHeight: 32,
    minWidth: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xs,
  },
  resetBtnText: {
    color: tokens.colors.actionDestructive,
    fontSize: 12,
    fontWeight: '600',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: tokens.spacing.sm,
    height: 42,
  },
  inputPrefix: {
    marginRight: tokens.spacing.xs,
  },
  input: {
    flex: 1,
    height: 42,
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.body.fontSize,
    paddingVertical: 0,
  },
  inputWrapperError: {
    borderColor: tokens.colors.statusError,
  },
  errorText: {
    color: tokens.colors.statusError,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
  },
  suggestionsContainer: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    borderRadius: tokens.borderRadius.md,
    marginTop: tokens.spacing.xs + 2,
    padding: tokens.spacing.xs + 2,
    ...tokens.shadows.card,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xs,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  suggestionsScroll: {
    maxHeight: 180,
    marginTop: 4,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  suggestionLeft: {
    flex: 1,
    gap: 2,
  },
  suggestionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    maxWidth: 160,
  },
  miniTierBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  miniTierText: {
    fontSize: 9,
    fontWeight: '700',
  },
  suggestionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionPhone: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  suggestionAddress: {
    fontSize: 11,
    color: tokens.colors.secondary,
    flex: 1,
  },
  suggestionStats: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    marginTop: 1,
  },
  suggestionSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    marginLeft: 6,
  },
  suggestionSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  loyaltyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    marginTop: tokens.spacing.xs + 2,
  },
  loyaltyMetric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.captionSmall.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: tokens.colors.borderSubtle,
  },
})
