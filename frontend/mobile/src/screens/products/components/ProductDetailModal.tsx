import React from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { usePermissions } from '../../../hooks/usePermissions'
import { CopyableBadge } from '../../../components/CopyableBadge'
import type { Product } from '../../../types'

interface ProductDetailModalProps {
  detailModalOpen: boolean
  setDetailModalOpen: (v: boolean) => void
  detailProduct: Product | null
  handleOpenEditProduct: (prod: Product) => void
  handleDeleteProductRequest: (prod: Product) => void
  handleToggleProductActive: (prod: Product) => void
  handleToggleVariantActive: (prod: Product, variantId: string) => void
  setOverviewScannerOpen: (v: boolean) => void
  setOverviewScanTarget: (v: { type: 'product' } | { type: 'variant'; variantId: string } | null) => void
  onOpenStockIn?: (product?: Product | null, variant?: any) => void
  onOpenStockAdjustment?: (product?: Product | null, variant?: any) => void
}

export function ProductDetailModal({
  detailModalOpen,
  setDetailModalOpen,
  detailProduct,
  handleOpenEditProduct,
  handleDeleteProductRequest,
  handleToggleProductActive,
  handleToggleVariantActive,
  setOverviewScannerOpen,
  setOverviewScanTarget,
  onOpenStockIn,
  onOpenStockAdjustment,
}: ProductDetailModalProps) {
  const { can } = usePermissions()
  return (      <Modal visible={detailModalOpen} transparent animationType="slide" onRequestClose={() => setDetailModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Product Overview</Text>
                <Text style={{ fontSize: 12, color: tokens.colors.secondary, fontWeight: '600' }}>
                  {detailProduct?.category?.name || 'General Inventory'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            {detailProduct ? (
              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                {/* Image & Header Summary */}
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  {detailProduct.image_url ? (
                    <Image
                      source={{ uri: detailProduct.image_url }}
                      style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: tokens.colors.surfaceAlt }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons
                        name={detailProduct.variants && detailProduct.variants.length > 1 ? 'shirt-outline' : 'cube-outline'}
                        size={32}
                        color={tokens.colors.primaryContainer}
                      />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.colors.onBackground, flex: 1 }} numberOfLines={2}>
                        {detailProduct.name}
                      </Text>
                      <View style={{ backgroundColor: detailProduct.is_active !== false ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: detailProduct.is_active !== false ? '#16A34A' : '#DC2626' }}>
                          {detailProduct.is_active !== false ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    {(() => {
                      const isSingle = !detailProduct.variants || detailProduct.variants.length <= 1
                      const headerSku = detailProduct.sku || (isSingle ? detailProduct.variants?.[0]?.sku : null)
                      const headerBarcode = detailProduct.barcode || (isSingle ? detailProduct.variants?.[0]?.barcode : null)

                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {Boolean(headerSku) && (
                            <CopyableBadge
                              type="sku"
                              value={headerSku}
                              labelPrefix="SKU:"
                            />
                          )}
                          {Boolean(headerBarcode) && (
                            <CopyableBadge
                              type="barcode"
                              value={headerBarcode}
                              labelPrefix="Barcode:"
                              prefixIcon
                            />
                          )}
                        </View>
                      )
                    })()}
                    {!detailProduct.barcode && !(detailProduct.variants && detailProduct.variants.length > 1) ? (
                      /* Simple product without barcode yet - quick scan to assign when stock arrives */
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          alignSelf: 'flex-start',
                          marginTop: 6,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: tokens.borderRadius.pill,
                          borderStyle: 'dashed',
                          borderWidth: 1,
                          borderColor: tokens.colors.primaryFixedDim,
                          backgroundColor: '#FFFBF5',
                        }}
                        onPress={() => {
                          setOverviewScanTarget({ type: 'product' })
                          setOverviewScannerOpen(true)
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="barcode-outline" size={14} color={tokens.colors.primaryContainer} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.primaryContainer }}>
                          No Barcode Yet • Scan to Assign
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Financial & Stock Metrics Grid */}
                {(() => {
                  const sell = Number(detailProduct.selling_price) || 0
                  const cost = Number(detailProduct.purchase_price) || 0
                  const marginPct = sell > 0 ? (((sell - cost) / sell) * 100).toFixed(1) : '0'
                  const totalStock = detailProduct.variants?.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0) ?? 0
                  const isLow = totalStock <= (detailProduct.default_reorder_level || 10)

                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, color: tokens.colors.secondary, fontWeight: '600', textTransform: 'uppercase' }}>Selling Price</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: tokens.colors.primaryContainer, marginTop: 2 }}>
                          ${sell.toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 10, color: tokens.colors.secondary, marginTop: 2 }}>Retail Tag</Text>
                      </View>

                      <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, color: tokens.colors.secondary, fontWeight: '600', textTransform: 'uppercase' }}>Purchase Cost</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: tokens.colors.onBackground, marginTop: 2 }}>
                          ${cost.toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '700', marginTop: 2 }}>{marginPct}% Margin</Text>
                      </View>

                      <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, color: tokens.colors.secondary, fontWeight: '600', textTransform: 'uppercase' }}>Total Stock</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: isLow ? '#DC2626' : '#16A34A' }}>
                            {totalStock}
                          </Text>
                          <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>units</Text>
                        </View>
                        <Text style={{ fontSize: 10, color: isLow ? '#DC2626' : tokens.colors.secondary, marginTop: 2 }}>
                          {isLow ? '⚠️ Low Stock Alert' : `Reorder at ${detailProduct.default_reorder_level || 10}`}
                        </Text>
                      </View>

                      <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, color: tokens.colors.secondary, fontWeight: '600', textTransform: 'uppercase' }}>Structure</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.colors.onBackground, marginTop: 4 }}>
                          {detailProduct.variants && detailProduct.variants.length > 1
                            ? `${detailProduct.variants.length} Variants`
                            : 'Simple Item'}
                        </Text>
                        <Text style={{ fontSize: 10, color: tokens.colors.secondary, marginTop: 2 }}>
                          {detailProduct.category?.name || 'Uncategorized'}
                        </Text>
                      </View>
                    </View>
                  )
                })()}

                {/* Variants Breakdown List (if Variable Product) */}
                {Boolean(detailProduct.variants && detailProduct.variants.length > 0) && (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[styles.formLabel, { marginBottom: 0 }]}>
                        Product Variants ({detailProduct.variants?.length || 0})
                      </Text>
                      <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                        Live Inventory Status
                      </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      {detailProduct.variants?.map((v) => {
                        const attrSummary = v.attribute_values?.map((av: any) => av.value_name || av.attribute?.name).filter(Boolean).join(' • ') || ''
                        const displayName = v.name || attrSummary || v.sku
                        const vPrice = v.selling_price_override ? Number(v.selling_price_override) : Number(detailProduct.selling_price)

                        return (
                          <View
                            key={v.id}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderRadius: 10,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 10 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onBackground }}>
                                {displayName}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                {Boolean(v.sku) && (
                                  <CopyableBadge
                                    type="sku"
                                    value={v.sku}
                                    compact
                                  />
                                )}
                                {Boolean(v.barcode) ? (
                                  <CopyableBadge
                                    type="barcode"
                                    value={v.barcode}
                                    compact
                                    prefixIcon
                                  />
                                ) : (
                                  <TouchableOpacity
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 3,
                                      paddingHorizontal: 6,
                                      paddingVertical: 2,
                                      borderRadius: tokens.borderRadius.pill,
                                      borderStyle: 'dashed',
                                      borderWidth: 1,
                                      borderColor: tokens.colors.primaryFixedDim,
                                      backgroundColor: '#FFFBF5',
                                    }}
                                    onPress={() => {
                                      setOverviewScanTarget({ type: 'variant', variantId: v.id })
                                      setOverviewScannerOpen(true)
                                    }}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="barcode-outline" size={11} color={tokens.colors.primaryContainer} />
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: tokens.colors.primaryContainer }}>
                                      Scan Barcode
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.colors.primaryContainer }}>
                                ${vPrice.toFixed(2)}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: (v.quantity_on_hand || 0) <= 0 ? '#FEE2E2' : '#DCFCE7',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: (v.quantity_on_hand || 0) <= 0 ? '#DC2626' : '#16A34A',
                                  }}
                                >
                                  {v.quantity_on_hand || 0} in stock
                                </Text>
                              </View>

                              {/* Per-variant visibility toggle */}
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 3,
                                  marginTop: 3,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                  backgroundColor: v.is_active !== false ? tokens.colors.actionPrimaryBg : '#F3F4F6',
                                  borderWidth: 1,
                                  borderColor: v.is_active !== false ? tokens.colors.primaryFixedDim : tokens.colors.borderDark,
                                }}
                                onPress={() => handleToggleVariantActive(detailProduct, v.id)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                              >
                                <Ionicons
                                  name={v.is_active !== false ? 'eye-outline' : 'eye-off-outline'}
                                  size={11}
                                  color={v.is_active !== false ? tokens.colors.primaryContainer : tokens.colors.secondary}
                                />
                                <Text
                                  style={{
                                    fontSize: 9,
                                    fontWeight: '700',
                                    color: v.is_active !== false ? tokens.colors.primaryContainer : tokens.colors.secondary,
                                  }}
                                >
                                  {v.is_active !== false ? 'For Sale' : 'Hidden'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )}

                {/* Actions Button Bar */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 16 }}>
                  {Boolean(can('inventory:restock')) && (
                    <TouchableOpacity
                      style={[styles.submitBtn, { flex: 1, backgroundColor: '#16A34A', marginTop: 0, marginBottom: 0, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 4 }]}
                      onPress={() => {
                        setDetailModalOpen(false)
                        onOpenStockIn?.(detailProduct)
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="enter-outline" size={16} color="#FFFFFF" />
                      <Text style={[styles.submitBtnText, { fontSize: 13 }]}>Stock In</Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(can('inventory:adjust')) && (
                    <TouchableOpacity
                      style={[styles.submitBtn, { flex: 1, backgroundColor: '#0284C7', marginTop: 0, marginBottom: 0, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 4 }]}
                      onPress={() => {
                        setDetailModalOpen(false)
                        onOpenStockAdjustment?.(detailProduct)
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="options-outline" size={16} color="#FFFFFF" />
                      <Text style={[styles.submitBtnText, { fontSize: 13 }]}>Adjust</Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(can('products:update')) && (
                    <TouchableOpacity
                      style={[styles.submitBtn, { flex: 1.3, backgroundColor: tokens.colors.primaryContainer, marginTop: 0, marginBottom: 0, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 5 }]}
                      onPress={() => {
                        setDetailModalOpen(false)
                        handleOpenEditProduct(detailProduct)
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="pencil" size={15} color="#FFFFFF" />
                      <Text style={[styles.submitBtnText, { fontSize: 13 }]}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Status & Danger Zone Actions */}
                {Boolean(can('products:update') || can('products:delete')) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                    {Boolean(can('products:update')) && (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          paddingVertical: 11,
                          borderRadius: tokens.borderRadius.input,
                          borderWidth: 1,
                          backgroundColor: '#FFFFFF',
                          borderColor: detailProduct.is_active !== false ? '#FDE68A' : '#BBF7D0',
                        }}
                        onPress={() => handleToggleProductActive(detailProduct)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={detailProduct.is_active !== false ? 'pause-circle-outline' : 'play-circle-outline'}
                          size={16}
                          color={detailProduct.is_active !== false ? tokens.colors.statusWarning : tokens.colors.statusSuccess}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: detailProduct.is_active !== false ? tokens.colors.statusWarning : tokens.colors.statusSuccess,
                          }}
                        >
                          {detailProduct.is_active !== false ? 'Deactivate' : 'Reactivate'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {Boolean(can('products:delete')) && (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          paddingVertical: 11,
                          borderRadius: tokens.borderRadius.input,
                          borderWidth: 1,
                          backgroundColor: '#FFFFFF',
                          borderColor: '#FECACA',
                        }}
                        onPress={() => handleDeleteProductRequest(detailProduct)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={16} color={tokens.colors.actionDestructive} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.colors.actionDestructive }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
  )
}
