import React from 'react'
import {
  View,
  Text,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../HomeScreen.styles'
import { SpringScaleCard } from './SpringScaleCard'
import type { TabType } from '../../../types'

export interface QuickOperationsGridProps {
  onNavigate: (tab: TabType) => void
  onQuickStockIn: () => void
  onQuickStockAdj: () => void
  canRestock?: boolean
  canAdjustStock?: boolean
}

export const QuickOperationsGrid: React.FC<QuickOperationsGridProps> = ({
  onNavigate,
  onQuickStockIn,
  onQuickStockAdj,
  canRestock = true,
  canAdjustStock = true,
}) => {
  const hasInventoryControls = canRestock || canAdjustStock

  return (
    <>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Quick Operations</Text>
          <Text style={styles.sectionSubtitle}>Fast register & daily actions</Text>
        </View>
      </View>

      <View style={styles.actionGridContainer}>
        {/* Primary Hero Action Card: New Sale */}
        <SpringScaleCard
          testID="btn-quick-new-sale"
          style={styles.actionCardPrimaryHero}
          touchStyle={styles.actionCardPrimaryHeroTouch}
          onPress={() => onNavigate('pos')}
          activeOpacity={0.92}
          accessibilityLabel="New Sale POS Terminal"
        >
          <View style={styles.actionCardPrimaryTop}>
            <View style={styles.actionIconWrapPrimary}>
              <Ionicons name="cart" size={22} color={tokens.colors.onPrimary} />
            </View>
            <View style={styles.actionPrimaryLiveBadge}>
              <View style={styles.actionPrimaryLiveDot} />
              <Text style={styles.actionPrimaryLiveText}>READY</Text>
            </View>
          </View>
          <View style={styles.actionCardPrimaryBottom}>
            <Text style={styles.actionTitlePrimary}>New Sale</Text>
            <Text style={styles.actionSubPrimary}>Open POS register</Text>
          </View>
          <View style={styles.actionPrimaryArrowCircle}>
            <Ionicons name="arrow-forward" size={13} color={tokens.colors.primaryContainer} />
          </View>
        </SpringScaleCard>

        {/* Secondary Column: Stock Actions or Sales/CRM Shortcuts */}
        <View style={styles.actionSecondaryColumn}>
          {hasInventoryControls ? (
            <>
              {/* Stock In */}
              <SpringScaleCard
                testID="btn-quick-stock-in"
                style={styles.actionCardSecondary}
                touchStyle={styles.actionCardSecondaryTouch}
                onPress={onQuickStockIn}
                activeOpacity={0.88}
                accessibilityLabel="Stock In Receive Goods"
              >
                <View style={[styles.actionIconWrapSecondary, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="download-outline" size={18} color="#B45309" />
                </View>
                <View style={styles.actionSecondaryInfo}>
                  <Text style={styles.actionTitleSecondary}>Stock In</Text>
                  <Text style={styles.actionSubSecondary} numberOfLines={1}>
                    Receive goods & POs
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondaryFixedDim} />
              </SpringScaleCard>

              {/* Stock Adjustment */}
              <SpringScaleCard
                testID="btn-quick-stock-adj"
                style={styles.actionCardSecondary}
                touchStyle={styles.actionCardSecondaryTouch}
                onPress={onQuickStockAdj}
                activeOpacity={0.88}
                accessibilityLabel="Adjust Stock Audit Counts"
              >
                <View style={[styles.actionIconWrapSecondary, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="options-outline" size={18} color="#0284C7" />
                </View>
                <View style={styles.actionSecondaryInfo}>
                  <Text style={styles.actionTitleSecondary}>Adjust Stock</Text>
                  <Text style={styles.actionSubSecondary} numberOfLines={1}>
                    Audit counts & damage
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondaryFixedDim} />
              </SpringScaleCard>
            </>
          ) : (
            <>
              {/* New Quotation for Sellers */}
              <SpringScaleCard
                testID="btn-quick-new-quote"
                style={styles.actionCardSecondary}
                touchStyle={styles.actionCardSecondaryTouch}
                onPress={() => onNavigate('quotations')}
                activeOpacity={0.88}
                accessibilityLabel="Create Quotation"
              >
                <View style={[styles.actionIconWrapSecondary, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#0284C7" />
                </View>
                <View style={styles.actionSecondaryInfo}>
                  <Text style={styles.actionTitleSecondary}>New Quote</Text>
                  <Text style={styles.actionSubSecondary} numberOfLines={1}>
                    Price estimate
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondaryFixedDim} />
              </SpringScaleCard>

              {/* Invoices for Quick Operations */}
              <SpringScaleCard
                testID="btn-quick-invoices"
                style={styles.actionCardSecondary}
                touchStyle={styles.actionCardSecondaryTouch}
                onPress={() => onNavigate('invoices')}
                activeOpacity={0.88}
                accessibilityLabel="Invoices and Billing"
              >
                <View style={[styles.actionIconWrapSecondary, { backgroundColor: '#E6F4EA' }]}>
                  <Ionicons name="receipt-outline" size={18} color="#15803D" />
                </View>
                <View style={styles.actionSecondaryInfo}>
                  <Text style={styles.actionTitleSecondary}>Invoices</Text>
                  <Text style={styles.actionSubSecondary} numberOfLines={1}>
                    Payments & due
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondaryFixedDim} />
              </SpringScaleCard>
            </>
          )}
        </View>
      </View>
    </>
  )
}
