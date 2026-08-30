import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../QuotationsScreen.styles'
import { DigitalReceipt } from '../../../components/DigitalReceipt'
import ViewShot from 'react-native-view-shot'
import {
  getQuoteNumber,
  getCustomerName,
  getCustomerPhone,
  getTotalAmount,
  getSubtotal,
  getDiscount,
  getValidUntil,
} from '../quotationUtils'
import type { Quotation, QuotationStatus, QuotationItem } from '../../../types'

export interface QuotationDetailModalProps {
  quote: Quotation | null
  quoteRef: React.RefObject<ViewShot>
  isCapturing: boolean
  onClose: () => void
  onUpdateStatus: (quote: Quotation, newStatus: QuotationStatus) => void
  onConvertQuote: (quote: Quotation) => void
  onReloadQuote: (quote: Quotation) => void
  onShareQuotation: (quote: Quotation) => void
}

export const QuotationDetailModal: React.FC<QuotationDetailModalProps> = ({
  quote,
  quoteRef,
  isCapturing,
  onClose,
  onUpdateStatus,
  onConvertQuote,
  onReloadQuote,
  onShareQuotation,
}) => {
  if (!quote) return null

  return (
    <Modal
      visible={Boolean(quote)}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 24 }}
          >
            <DigitalReceipt
              ref={quoteRef}
              documentType="Quotation"
              documentNumber={getQuoteNumber(quote)}
              validUntil={getValidUntil(quote)}
              discount={getDiscount(quote)}
              footerMessage={quote.notes || undefined}
              customerName={getCustomerName(quote)}
              customerPhone={getCustomerPhone(quote)}
              items={(quote.items || []).map((item: QuotationItem, idx) => {
                const pName = (item.product_name || item.productName || 'Product') as string
                const uPrice =
                  typeof (item.unit_price || item.unitPrice) === 'number'
                    ? (item.unit_price || item.unitPrice) as number
                    : parseFloat(String((item.unit_price || item.unitPrice || '0'))) || 0
                const tPrice =
                  typeof (item.line_total || item.lineTotal) === 'number'
                    ? (item.line_total || item.lineTotal) as number
                    : parseFloat(
                        String((item.line_total || item.lineTotal || item.quantity * uPrice))
                      ) || item.quantity * uPrice
                return {
                  id: item.id || `qi-${idx}`,
                  name: pName,
                  sku: item.sku || 'SKU',
                  quantity: item.quantity,
                  unitPrice: uPrice,
                  totalPrice: tPrice,
                }
              })}
              subtotal={getSubtotal(quote)}
              tax={0}
              amountPaid={0}
              balanceDue={getTotalAmount(quote)}
            />

            {/* Status Switcher Action Bar (Outside of ViewShot) */}
            {!isCapturing && (
              <View style={{ marginTop: 16 }}>
                {quote.status === 'CONVERTED' ? (
                  <View style={styles.convertedStatusBanner}>
                    <Ionicons name="lock-closed" size={18} color="#5B21B6" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.convertedStatusBannerTitle}>
                        Converted to Sale Order
                      </Text>
                      <Text style={styles.convertedStatusBannerSubtitle}>
                        This quotation has been converted into an active sale and cannot be modified.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.statusChangeRow}>
                    <Text style={styles.statusChangeLabel}>Update Status:</Text>
                    <View style={styles.statusButtonGroup}>
                      {(['SENT', 'ACCEPTED', 'REJECTED'] as QuotationStatus[]).map((st) => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.statusToggleBtn,
                            quote.status === st && styles.statusToggleBtnActive,
                          ]}
                          onPress={() => onUpdateStatus(quote, st)}
                        >
                          <Text
                            style={[
                              styles.statusToggleText,
                              quote.status === st && styles.statusToggleTextActive,
                            ]}
                          >
                            {st.charAt(0) + st.slice(1).toLowerCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action buttons: Convert to Order & Share */}
                <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
                  {quote.status !== 'CONVERTED' ? (
                    <TouchableOpacity
                      style={[styles.convertBtn, { flex: 1, marginTop: 0, marginBottom: 0 }]}
                      onPress={() => onConvertQuote(quote)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="cart" size={18} color={tokens.colors.onPrimary} />
                      <Text style={styles.convertBtnText}>Convert to POS</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.convertBtn,
                        { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: '#5B21B6' },
                      ]}
                      onPress={() => onReloadQuote(quote)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="cart" size={18} color={tokens.colors.onPrimary} />
                      <Text style={styles.convertBtnText}>Re-load POS Cart</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.shareQuotationBtn,
                      { flex: 1, marginTop: 0, marginBottom: 0 },
                      isCapturing && { opacity: 0.7 },
                    ]}
                    onPress={() => onShareQuotation(quote)}
                    activeOpacity={0.8}
                    disabled={isCapturing}
                  >
                    {isCapturing ? (
                      <ActivityIndicator size="small" color={tokens.colors.primary} />
                    ) : (
                      <Ionicons name="share-social-outline" size={18} color={tokens.colors.primary} />
                    )}
                    <Text style={styles.shareQuotationBtnText}>
                      {isCapturing ? 'Preparing...' : 'Share'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky Bottom Footer CTA */}
          <View style={styles.footer}>
            <View style={styles.footerButtonsRow}>
              <TouchableOpacity
                style={styles.closeFooterButton}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.closeFooterButtonText}>Close Quotation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
