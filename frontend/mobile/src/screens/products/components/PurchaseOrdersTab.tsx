import React from 'react'
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { usePermissions } from '../../../hooks/usePermissions'
import { SearchBar } from '../../../components/SearchBar'
import type { PurchaseOrder, Supplier } from '../../../types'

interface PurchaseOrdersTabProps {
  purchaseOrders: PurchaseOrder[]
  suppliers: Supplier[]
  filteredPurchaseOrders: PurchaseOrder[]
  filteredSuppliers: Supplier[]
  poSubTab: 'orders' | 'suppliers'
  setPoSubTab: (v: 'orders' | 'suppliers') => void
  poSearch: string
  setPoSearch: (v: string) => void
  setPoModalOpen: (v: boolean) => void
  setNewSupModalOpen: (v: boolean) => void
  setSelectedPoDetail: (po: PurchaseOrder) => void
  setPoDetailModalOpen: (v: boolean) => void
  handleMarkPoReceived: (poId: string) => void
  handleOpenCreatePoForSupplier: (supId: string) => void
}

export function PurchaseOrdersTab({
  purchaseOrders,
  suppliers,
  filteredPurchaseOrders,
  filteredSuppliers,
  poSubTab,
  setPoSubTab,
  poSearch,
  setPoSearch,
  setPoModalOpen,
  setNewSupModalOpen,
  setSelectedPoDetail,
  setPoDetailModalOpen,
  handleMarkPoReceived,
  handleOpenCreatePoForSupplier,
}: PurchaseOrdersTabProps) {
  const { can } = usePermissions()
  return (        <View style={{ flex: 1 }}>
          {/* Action & Search Bar */}
          <View style={styles.poSearchRow}>
            <SearchBar
              value={poSearch}
              onChangeText={setPoSearch}
              placeholder={poSubTab === 'orders' ? 'Search PO #, vendor, status, products...' : 'Search supplier name, rep, phone...'}
              containerStyle={styles.poSearchBar}
              rightAction={
                poSubTab === 'orders'
                  ? Boolean(can('purchase-orders:create')) && (
                      <TouchableOpacity style={styles.poActionBtn} onPress={() => setPoModalOpen(true)}>
                        <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
                        <Text style={styles.poActionBtnText}>New PO</Text>
                      </TouchableOpacity>
                    )
                  : Boolean(can('suppliers:manage')) && (
                      <TouchableOpacity style={styles.poActionBtn} onPress={() => setNewSupModalOpen(true)}>
                        <Ionicons name="person-add" size={15} color={tokens.colors.onPrimary} />
                        <Text style={styles.poActionBtnText}>Add Vendor</Text>
                      </TouchableOpacity>
                    )
              }
            />
          </View>

          {/* Segmented Switcher: Purchase Orders vs Suppliers */}
          <View style={styles.poSegmentRow}>
            <TouchableOpacity
              style={[styles.poSegmentBtn, poSubTab === 'orders' && styles.poSegmentBtnActive]}
              onPress={() => setPoSubTab('orders')}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={poSubTab === 'orders' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text style={[styles.poSegmentBtnText, poSubTab === 'orders' && styles.poSegmentBtnTextActive]}>
                Purchase Orders ({purchaseOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.poSegmentBtn, poSubTab === 'suppliers' && styles.poSegmentBtnActive]}
              onPress={() => setPoSubTab('suppliers')}
            >
              <Ionicons
                name="business-outline"
                size={14}
                color={poSubTab === 'suppliers' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text style={[styles.poSegmentBtnText, poSubTab === 'suppliers' && styles.poSegmentBtnTextActive]}>
                Suppliers ({suppliers.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Feed */}
          {poSubTab === 'orders' ? (
            <FlatList
              style={styles.list}
              data={filteredPurchaseOrders}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: po }) => {
                const isReceived = po.status === 'RECEIVED'
                const isOrdered = po.status === 'ORDERED'
                const firstItem = po.items[0]

                return (
                  <TouchableOpacity
                    style={styles.poCardModern}
                    onPress={() => {
                      setSelectedPoDetail(po)
                      setPoDetailModalOpen(true)
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.poCardModernHeader}>
                      <View style={styles.poIdGroup}>
                        <View style={styles.poIconBox}>
                          <Ionicons name="document-text" size={16} color={tokens.colors.primaryContainer} />
                        </View>
                        <View>
                          <Text style={styles.poModernNumber}>{po.poNumber}</Text>
                          <View style={styles.poSupplierRow}>
                            <Ionicons name="business-outline" size={12} color={tokens.colors.secondary} />
                            <Text style={styles.poModernSupplier}>{po.supplierName}</Text>
                          </View>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.poModernStatusBadge,
                          isReceived && styles.poStatusBadgeReceived,
                          isOrdered && styles.poStatusBadgeOrdered,
                        ]}
                      >
                        <Text
                          style={[
                            styles.poModernStatusText,
                            isReceived && styles.poStatusTextReceived,
                            isOrdered && styles.poStatusTextOrdered,
                          ]}
                        >
                          {po.status}
                        </Text>
                      </View>
                    </View>

                    {/* Items Summary */}
                    <View style={styles.poItemSummaryBox}>
                      <Text style={styles.poItemSummaryTitle} numberOfLines={1}>
                        {firstItem?.productName || 'Restock Inventory Pack'}
                      </Text>
                      <Text style={styles.poItemSummaryMeta}>
                        {po.items.reduce((s, it) => s + it.quantity, 0)} units total • Ordered: {po.orderDate}
                      </Text>
                    </View>

                    <View style={styles.poCardModernFooter}>
                      <View>
                        <Text style={styles.poCostLabel}>Total PO Amount</Text>
                        <Text style={styles.poCostValue}>${po.totalCost.toFixed(2)}</Text>
                      </View>

                      <View style={styles.poCardActions}>
                        {Boolean(!isReceived) && (
                          <TouchableOpacity
                            style={styles.poReceiveBtn}
                            onPress={() => handleMarkPoReceived(po.id)}
                          >
                            <Ionicons name="checkmark-circle-outline" size={14} color="#16A34A" />
                            <Text style={styles.poReceiveBtnText}>Receive</Text>
                          </TouchableOpacity>
                        )}
                        <View style={styles.poViewDetailsBtn}>
                          <Text style={styles.poViewDetailsText}>Details</Text>
                          <Ionicons name="chevron-forward" size={12} color={tokens.colors.secondary} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={
                <View style={styles.emptyPoCard}>
                  <Ionicons name="document-text-outline" size={40} color={tokens.colors.borderSubtle} />
                  <Text style={styles.emptyPoTitle}>No Purchase Orders Found</Text>
                  <Text style={styles.emptyPoSub}>Create a new PO to restock inventory from your suppliers</Text>
                  <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setPoModalOpen(true)}>
                    <Text style={styles.emptyCreateBtnText}>+ Create Purchase Order</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ) : (
            <FlatList
              style={styles.list}
              data={filteredSuppliers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: sup }) => {
                const initial = (sup.name || 'S').substring(0, 2).toUpperCase()

                return (
                  <View style={styles.supCardModern}>
                    <View style={styles.supCardTopRow}>
                      <View style={styles.supAvatar}>
                        <Text style={styles.supAvatarText}>{initial}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={styles.supNameRow}>
                          <Text style={styles.supModernName}>{sup.name}</Text>
                        </View>
                        <Text style={styles.supContactName}>Contact: {sup.contactPerson}</Text>
                      </View>
                      <View style={styles.leadTimeBadge}>
                        <Ionicons name="flash-outline" size={11} color="#EA580C" />
                        <Text style={styles.leadTimeText}>{sup.leadTimeDays || 3}d Lead</Text>
                      </View>
                    </View>

                    {/* Contact Info Row */}
                    <View style={styles.supInfoRow}>
                      <View style={styles.supInfoItem}>
                        <Ionicons name="call-outline" size={12} color={tokens.colors.secondary} />
                        <Text style={styles.supInfoText}>{sup.phone}</Text>
                      </View>
                      <View style={styles.supInfoItem}>
                        <Ionicons name="mail-outline" size={12} color={tokens.colors.secondary} />
                        <Text style={styles.supInfoText}>{sup.email}</Text>
                      </View>
                    </View>

                    <View style={styles.supAddressRow}>
                      <Ionicons name="location-outline" size={12} color={tokens.colors.textMuted} />
                      <Text style={styles.supAddressText} numberOfLines={1}>{sup.address}</Text>
                    </View>

                    {/* Action Bar */}
                    <View style={styles.supActionRow}>
                      <TouchableOpacity
                        style={styles.supCreatePoBtn}
                        onPress={() => handleOpenCreatePoForSupplier(sup.id)}
                      >
                        <Ionicons name="add-circle" size={14} color={tokens.colors.onPrimary} />
                        <Text style={styles.supCreatePoBtnText}>Create PO for Vendor</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              }}
              ListEmptyComponent={
                <View style={styles.emptyPoCard}>
                  <Ionicons name="business-outline" size={40} color={tokens.colors.borderSubtle} />
                  <Text style={styles.emptyPoTitle}>No Suppliers Registered</Text>
                  <Text style={styles.emptyPoSub}>Add your suppliers and vendors to manage restock orders</Text>
                  <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setNewSupModalOpen(true)}>
                    <Text style={styles.emptyCreateBtnText}>+ Add Supplier</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
  )
}
