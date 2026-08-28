import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { SalesChannel, TabType } from '../types'
import {
  getSalesChannels,
  createSalesChannel,
  updateSalesChannel,
  deleteSalesChannel,
} from '../api/endpoints'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { salesChannelSchema, SalesChannelFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'

export interface SalesChannelsScreenProps {
  onNavigate: (tab: TabType) => void
  onOpenSidebar?: () => void
}

export const INITIAL_SALES_CHANNELS: SalesChannel[] = []

export const PLATFORM_CONFIGS: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  pos: { icon: 'storefront', color: '#FF8800', bg: '#FFF7ED', label: 'Store POS' },
  tiktok: { icon: 'logo-tiktok', color: '#0F172A', bg: '#F1F5F9', label: 'TikTok' },
  facebook: { icon: 'logo-facebook', color: '#1877F2', bg: '#EBF5FF', label: 'Facebook' },
  telegram: { icon: 'paper-plane', color: '#229ED9', bg: '#E0F2FE', label: 'Telegram' },
  instagram: { icon: 'logo-instagram', color: '#E1306C', bg: '#FCE7F3', label: 'Instagram' },
  shopee: { icon: 'cart', color: '#EA580C', bg: '#FFEDD5', label: 'Shopee' },
  lazada: { icon: 'bag-handle', color: '#0F146D', bg: '#EEF2FF', label: 'Lazada' },
  online: { icon: 'globe', color: '#10B981', bg: '#ECFDF5', label: 'Online Web' },
  offline: { icon: 'briefcase', color: '#64748B', bg: '#F8FAFC', label: 'Wholesale B2B' },
  other: { icon: 'layers', color: '#475569', bg: '#F1F5F9', label: 'Other' },
}

export function getChannelPlatformMeta(channel: SalesChannel) {
  if (channel.platform && PLATFORM_CONFIGS[channel.platform]) {
    return PLATFORM_CONFIGS[channel.platform]
  }
  const typeLower = (channel.type || '').toLowerCase()
  if (PLATFORM_CONFIGS[typeLower]) {
    return PLATFORM_CONFIGS[typeLower]
  }
  const nameLower = (channel.name || '').toLowerCase()
  const codeLower = (channel.code || '').toLowerCase()

  if (nameLower.includes('telegram') || codeLower.includes('tg')) return PLATFORM_CONFIGS.telegram
  if (nameLower.includes('facebook') || codeLower.includes('fb')) return PLATFORM_CONFIGS.facebook
  if (nameLower.includes('instagram') || codeLower.includes('ig')) return PLATFORM_CONFIGS.instagram
  if (nameLower.includes('tiktok')) return PLATFORM_CONFIGS.tiktok
  if (nameLower.includes('shopee')) return PLATFORM_CONFIGS.shopee
  if (nameLower.includes('lazada')) return PLATFORM_CONFIGS.lazada
  if (typeLower === 'pos' || nameLower.includes('pos') || nameLower.includes('store')) return PLATFORM_CONFIGS.pos
  if (typeLower === 'online' || nameLower.includes('web') || nameLower.includes('e-commerce')) return PLATFORM_CONFIGS.online
  if (typeLower === 'offline' || nameLower.includes('b2b')) return PLATFORM_CONFIGS.offline
  return PLATFORM_CONFIGS.other
}

export const SalesChannelsScreen: React.FC<SalesChannelsScreenProps> = ({
  onNavigate: _onNavigate,
  onOpenSidebar: _onOpenSidebar,
}) => {
  const [channels, setChannels] = useState<SalesChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null)
  const [channelToDelete, setChannelToDelete] = useState<SalesChannel | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDefault, setIsDefault] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<SalesChannelFormValues>({
    resolver: zodResolver(salesChannelSchema),
    defaultValues: {
      name: '',
      code: '',
      platform: 'pos',
      type: 'pos',
      imageUrl: '',
      isActive: true,
      isDefault: false,
    },
  })

  const currentPlatform = watch('platform') || watch('type') || 'pos'
  const currentType = currentPlatform
  const currentIsActive = watch('isActive')

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getSalesChannels({ include_inactive: true })
      if (data && data.length > 0) {
        setChannels(data)
      } else {
        setChannels([])
      }
    } catch {
      setChannels([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchChannels()
  }, [fetchChannels])

  const handleOpenAddModal = () => {
    setEditingChannel(null)
    reset({
      name: '',
      code: '',
      platform: 'pos',
      type: 'pos',
      imageUrl: '',
      isActive: true,
      isDefault: channels.length === 0,
    })
    setIsDefault(channels.length === 0)
    setModalVisible(true)
  }

  const handleOpenEditModal = (channel: SalesChannel) => {
    setEditingChannel(channel)
    const channelDefault = !!(channel.is_default || channel.isDefault)
    const chanPlatform = channel.platform || channel.type || 'pos'
    reset({
      name: channel.name,
      code: channel.code || '',
      platform: chanPlatform,
      type: chanPlatform,
      imageUrl: channel.image_url || channel.imageUrl || '',
      isActive: channel.is_active ?? channel.isActive ?? true,
      isDefault: channelDefault,
    })
    setIsDefault(channelDefault)
    setModalVisible(true)
  }

  const handleToggleDefault = async (channel: SalesChannel) => {
    setChannels((prev) =>
      prev.map((c) => ({
        ...c,
        is_default: c.id === channel.id,
        isDefault: c.id === channel.id,
      }))
    )

    try {
      await updateSalesChannel(channel.id, { is_default: true, isDefault: true })
      fetchChannels()
    } catch {
      Alert.alert('Update Failed', 'Could not set default sales channel.')
      fetchChannels()
    }
  }

  const handleToggleActive = async (channel: SalesChannel) => {
    const updatedStatus = !(channel.is_active ?? channel.isActive ?? true)
    // Optimistic update
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_active: updatedStatus, isActive: updatedStatus } : c))
    )

    try {
      await updateSalesChannel(channel.id, { is_active: updatedStatus, isActive: updatedStatus })
    } catch {
      Alert.alert('Update Failed', 'Could not sync channel status with server.')
      fetchChannels()
    }
  }

  const handleDelete = (channel: SalesChannel) => {
    setChannelToDelete(channel)
  }

  const confirmDeleteChannel = async (channel: SalesChannel) => {
    try {
      setIsDeleting(true)
      const res = await deleteSalesChannel(channel.id)
      setChannelToDelete(null)
      await fetchChannels()
      if (res?.message && res.message.toLowerCase().includes('deactivated')) {
        if (Platform.OS === 'web') {
          window.alert(`Channel "${channel.name}" has existing order records and has been deactivated instead.`)
        } else {
          Alert.alert('Channel Deactivated', `Channel "${channel.name}" has existing order records and has been deactivated instead.`)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete channel'
      if (Platform.OS === 'web') {
        window.alert(msg)
      } else {
        Alert.alert('Error', msg)
      }
      await fetchChannels()
    } finally {
      setIsDeleting(false)
    }
  }

  const onSubmit = async (data: SalesChannelFormValues) => {
    const selectedPlatform = data.platform || 'pos'
    try {
      setIsSubmitting(true)
      if (editingChannel) {
        await updateSalesChannel(editingChannel.id, {
          name: data.name.trim(),
          platform: selectedPlatform,
          code: data.code?.trim() || undefined,
          type: selectedPlatform,
          image_url: data.imageUrl?.trim() || null,
          is_active: data.isActive,
          is_default: isDefault,
          isDefault,
        })
      } else {
        await createSalesChannel({
          name: data.name.trim(),
          platform: selectedPlatform,
          code: data.code?.trim() || undefined,
          type: selectedPlatform,
          image_url: data.imageUrl?.trim() || null,
          is_active: data.isActive,
          is_default: isDefault,
          isDefault,
        })
      }
      await fetchChannels()
      setModalVisible(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save sales channel.'
      Alert.alert('Save Error', msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channels.filter((channel) => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        (channel.name || '').toLowerCase().includes(q) ||
        (channel.code || '').toLowerCase().includes(q)

      if (!matchSearch) return false

      if (filterType === 'ACTIVE') return channel.is_active
      if (filterType === 'INACTIVE') return !channel.is_active
      if (filterType === 'SOCIAL') {
        return (
          ['telegram', 'facebook', 'instagram', 'tiktok', 'social_media'].includes(
            (channel.type || '').toLowerCase()
          ) || ['telegram', 'facebook', 'instagram', 'tiktok'].some((k) => (channel.name || '').toLowerCase().includes(k))
        )
      }
      if (filterType === 'POS_ONLINE') {
        return (channel.type || '').toLowerCase() === 'pos' || (channel.type || '').toLowerCase() === 'online'
      }
      return true
    })
  }, [channels, searchQuery, filterType])

  return (
    <View style={styles.container}>
      {/* Compact toolbar: search + add icon */}
      <View style={styles.compactToolbar}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={16} color={tokens.colors.secondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels, codes..."
            placeholderTextColor={tokens.colors.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery.length > 0) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          testID="btn-add-sales-channel"
          style={styles.addIconBtn}
          onPress={handleOpenAddModal}
          accessibilityLabel="Add Sales Channel"
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter Row Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {[
          { key: 'ALL', label: 'All' },
          { key: 'SOCIAL', label: 'Social Media' },
          { key: 'POS_ONLINE', label: 'POS & Web' },
          { key: 'ACTIVE', label: 'Active' },
          { key: 'INACTIVE', label: 'Disabled' },
        ].map((f) => {
          const isSelected = filterType === f.key
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setFilterType(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Channel Cards List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primaryContainer}
            colors={[tokens.colors.primaryContainer]}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={styles.centerLoadingText}>Loading sales channels...</Text>
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="share-social-outline" size={44} color={tokens.colors.borderSubtle} />
            <Text style={styles.emptyTitle}>No Sales Channels Found</Text>
            <Text style={styles.emptySub}>
              Tap the "+" button above to add a Telegram, Facebook, Instagram, TikTok, POS, or Web sales channel.
            </Text>
          </View>
        ) : (
          filteredChannels.map((channel) => {
            const platformMeta = getChannelPlatformMeta(channel)
            const isInactive = channel.is_active === false
            const isDefaultChannel = !!(channel.is_default || channel.isDefault)

            return (
              <View
                key={channel.id}
                style={[styles.channelCard, isInactive && styles.channelCardInactive]}
              >
                {/* Modern Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.platformIconBox,
                        {
                          backgroundColor: platformMeta.bg,
                          borderColor: isInactive ? tokens.colors.borderSubtle : `${platformMeta.color}30`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={platformMeta.icon}
                        size={20}
                        color={isInactive ? tokens.colors.secondary : platformMeta.color}
                      />
                    </View>
                    <View style={styles.channelHeaderInfo}>
                      <Text
                        style={[styles.channelName, isInactive && styles.channelNameInactive]}
                        numberOfLines={1}
                      >
                        {channel.name}
                      </Text>
                      <View style={styles.channelCodePill}>
                        <Text style={styles.channelCodeText}>
                          #{channel.code || 'NO-CODE'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    {isDefaultChannel ? (
                      <View style={styles.defaultBadge}>
                        <Ionicons name="star" size={12} color="#16A34A" />
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setDefaultBtn}
                        onPress={() => handleToggleDefault(channel)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="star-outline" size={13} color="#D97706" />
                        <Text style={styles.setDefaultBtnText}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                  {/* Badges / Metadata row */}
                  <View style={styles.badgesRow}>
                    <View
                      style={[
                        styles.typeBadgePill,
                        {
                          backgroundColor: isInactive ? tokens.colors.surfaceMuted : platformMeta.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={platformMeta.icon}
                        size={13}
                        color={isInactive ? tokens.colors.secondary : platformMeta.color}
                      />
                      <Text
                        style={[
                          styles.typeBadgePillText,
                          { color: isInactive ? tokens.colors.secondary : platformMeta.color },
                        ]}
                      >
                        {platformMeta.label}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        channel.is_active ? styles.statusPillActive : styles.statusPillInactive,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          channel.is_active ? styles.statusDotActive : styles.statusDotInactive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          channel.is_active ? styles.statusPillTextActive : styles.statusPillTextInactive,
                        ]}
                      >
                        {channel.is_active ? 'ACTIVE IN POS' : 'DISABLED'}
                      </Text>
                    </View>
                  </View>

                  {/* Card Actions: Clean, balanced 3-button row */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      testID={`btn-edit-channel-${channel.id}`}
                      style={styles.actionBtnEdit}
                      onPress={() => handleOpenEditModal(channel)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={15} color={tokens.colors.primary} />
                      <Text style={styles.actionBtnEditText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID={`btn-toggle-channel-${channel.id}`}
                      style={[
                        styles.actionBtnToggle,
                        channel.is_active ? styles.actionBtnToggleDeactivate : styles.actionBtnToggleActivate,
                      ]}
                      onPress={() => handleToggleActive(channel)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={channel.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={15}
                        color={channel.is_active ? tokens.colors.statusWarning : tokens.colors.statusSuccess}
                      />
                      <Text
                        style={[
                          styles.actionBtnToggleText,
                          {
                            color: channel.is_active
                              ? tokens.colors.statusWarning
                              : tokens.colors.statusSuccess,
                          },
                        ]}
                      >
                        {channel.is_active ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID={`btn-delete-channel-${channel.id}`}
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(channel)}
                      activeOpacity={0.8}
                      accessibilityLabel={`Delete ${channel.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Delete Confirmation Modal (Cross-platform reliable) */}
      <Modal
        visible={!!channelToDelete}
        animationType="fade"
        transparent
        onRequestClose={() => setChannelToDelete(null)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIconBox}>
              <Ionicons name="trash-outline" size={26} color={tokens.colors.statusError} />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Sales Channel</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete{' '}
              <Text style={{ fontWeight: '700', color: tokens.colors.onBackground }}>
                "{channelToDelete?.name}"
              </Text>
              ?
            </Text>
            <Text style={styles.deleteModalNote}>
              Note: If this channel has existing sales history, it will be safely deactivated instead of permanently deleted.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancelBtn}
                onPress={() => setChannelToDelete(null)}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="btn-confirm-delete-channel"
                style={styles.deleteModalConfirmBtn}
                onPress={() => channelToDelete && confirmDeleteChannel(channelToDelete)}
                disabled={isDeleting}
                activeOpacity={0.85}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trash" size={15} color="#FFFFFF" />
                    <Text style={styles.deleteModalConfirmText}>Delete Channel</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Channel Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingChannel ? 'Edit Sales Channel' : 'Add Sales Channel'}
                </Text>
                <Text style={styles.modalSub}>
                  Configure your omnichannel sales stream & checkout tagging
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Platform Selector */}
              <Text style={styles.inputLabel}>Selling Platform *</Text>
              <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginBottom: 8, marginTop: -2 }}>
                Select platform to allow using the same shop name across multiple channels (e.g. KC Shop on TikTok & Facebook)
              </Text>
              <View style={styles.typeOptionsGrid}>
                {[
                  { key: 'pos', label: 'Store POS', icon: 'storefront', color: '#FF8800' },
                  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#0F172A' },
                  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
                  { key: 'telegram', label: 'Telegram', icon: 'paper-plane', color: '#229ED9' },
                  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
                  { key: 'shopee', label: 'Shopee', icon: 'cart', color: '#EA580C' },
                  { key: 'lazada', label: 'Lazada', icon: 'bag-handle', color: '#0F146D' },
                  { key: 'online', label: 'Online Web', icon: 'globe', color: '#10B981' },
                  { key: 'offline', label: 'Wholesale B2B', icon: 'briefcase', color: '#64748B' },
                  { key: 'other', label: 'Other', icon: 'layers', color: '#475569' },
                ].map((item) => {
                  const isSelected = currentPlatform === item.key
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.typeOptionCard,
                        isSelected && { borderColor: item.color, backgroundColor: `${item.color}15`, borderWidth: 1.8 },
                      ]}
                      onPress={() => {
                        setValue('platform', item.key)
                        setValue('type', item.key)
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={18}
                        color={isSelected ? item.color : tokens.colors.secondary}
                      />
                      <Text
                        style={[
                          styles.typeOptionText,
                          isSelected && { color: item.color, fontWeight: '800' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Channel Name Field */}
              <ControlledInput
                control={control}
                name="name"
                label="Store / Channel Name *"
                placeholder="e.g. KC Shop, Flagship Store, Main Branch"
              />

              {/* Channel Code Field */}
              <ControlledInput
                control={control}
                name="code"
                label="Channel Code / Identifier"
                placeholder="e.g. KC-SHOP, POS-MAIN, FB-PAGE"
              />

              {/* Active Toggle Option */}
              <View style={styles.activeToggleRow}>
                <View>
                  <Text style={styles.activeToggleLabel}>Channel Active</Text>
                  <Text style={styles.activeToggleSub}>
                    Enable channel for selection in POS sales & checkout
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    currentIsActive && styles.toggleSwitchOn,
                  ]}
                  onPress={() => setValue('isActive', !currentIsActive)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      currentIsActive && styles.toggleThumbOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* Default Toggle Option */}
              <View style={styles.activeToggleRow}>
                <View>
                  <Text style={styles.activeToggleLabel}>Default Channel</Text>
                  <Text style={styles.activeToggleSub}>
                    Pre-select this sales channel at POS checkout
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    isDefault && styles.toggleSwitchOn,
                  ]}
                  onPress={() => setIsDefault(!isDefault)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      isDefault && styles.toggleThumbOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="btn-save-sales-channel"
                style={styles.saveBtn}
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={tokens.colors.onPrimary} />
                    <Text style={styles.saveBtnText}>
                      {editingChannel ? 'Update Channel' : 'Create Channel'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  compactToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  addIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.card,
  },
  filterRow: {
    marginVertical: 4,
    maxHeight: 44,
  },
  filterRowContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  filterChipTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 40,
    gap: 12,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centerLoadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderStyle: 'dashed',
    marginVertical: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  channelCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadows.card,
  },
  channelCardInactive: {
    opacity: 0.72,
    backgroundColor: tokens.colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
    gap: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  platformIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  channelHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  channelName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  channelNameInactive: {
    color: tokens.colors.secondary,
  },
  channelCodePill: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  channelCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  cardHeaderRight: {
    flexShrink: 0,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.4,
  },
  setDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  setDefaultBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  cardBody: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
    gap: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  typeBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  statusPillActive: { backgroundColor: tokens.colors.badgeSuccessBg },
  statusPillInactive: { backgroundColor: tokens.colors.badgeNeutralBg },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: tokens.colors.statusSuccess },
  statusDotInactive: { backgroundColor: tokens.colors.textMuted },
  statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statusPillTextActive: { color: tokens.colors.statusSuccess },
  statusPillTextInactive: { color: tokens.colors.textMuted },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    paddingTop: tokens.spacing.sm + 2,
    gap: 8,
  },
  actionBtnEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  actionBtnEditText: {
    color: tokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
  },
  actionBtnToggleDeactivate: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  actionBtnToggleActivate: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  actionBtnToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDelete: {
    width: 38,
    height: 38,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.actionDestructiveBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  deleteModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    ...tokens.shadows.modal,
  },
  deleteModalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.actionDestructiveBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginBottom: 8,
  },
  deleteModalMessage: {
    fontSize: 13,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  deleteModalNote: {
    fontSize: 11,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 16,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: 10,
    borderRadius: 8,
    marginBottom: 18,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  deleteModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  deleteModalConfirmBtn: {
    flex: 1.3,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.statusError,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  deleteModalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: tokens.colors.surfaceCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: tokens.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : tokens.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  modalSub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    marginVertical: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 10,
  },
  typeOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    minWidth: '47%',
    flex: 1,
  },
  typeOptionText: {
    fontSize: 12,
    color: tokens.colors.onBackground,
    fontWeight: '600',
  },
  activeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    padding: 12,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginVertical: 12,
  },
  activeToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  activeToggleSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
    maxWidth: 240,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#16A34A',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: tokens.spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    gap: 6,
    ...tokens.shadows.card,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
})

export default SalesChannelsScreen
