import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
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
import { styles } from './sales_channels/SalesChannelsScreen.styles'
import { getChannelPlatformMeta, PLATFORM_CONFIGS } from './sales_channels/salesChannelUtils'
import { ChannelCardItem } from './sales_channels/components/ChannelCardItem'
import { ChannelFilterToolbar } from './sales_channels/components/ChannelFilterToolbar'
import { ChannelFormModal } from './sales_channels/components/ChannelFormModal'
import { ChannelDeleteModal } from './sales_channels/components/ChannelDeleteModal'

export { getChannelPlatformMeta, PLATFORM_CONFIGS }

export interface SalesChannelsScreenProps {
  onNavigate?: (tab: TabType) => void
  onOpenSidebar?: () => void
}

export const SalesChannelsScreen: React.FC<SalesChannelsScreenProps> = () => {
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
    const channelDefault = Boolean(channel.is_default || channel.isDefault)
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
    const currentActive = channel.is_active ?? channel.isActive ?? true
    const updatedStatus = !currentActive
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id
          ? { ...c, is_active: updatedStatus, isActive: updatedStatus }
          : c
      )
    )

    try {
      await updateSalesChannel(channel.id, {
        is_active: updatedStatus,
        isActive: updatedStatus,
      })
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
          window.alert(
            `Channel "${channel.name}" has existing order records and has been deactivated instead.`
          )
        } else {
          Alert.alert(
            'Channel Deactivated',
            `Channel "${channel.name}" has existing order records and has been deactivated instead.`
          )
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
          ) ||
          ['telegram', 'facebook', 'instagram', 'tiktok'].some((k) =>
            (channel.name || '').toLowerCase().includes(k)
          )
        )
      }
      if (filterType === 'POS_ONLINE') {
        return (
          (channel.type || '').toLowerCase() === 'pos' ||
          (channel.type || '').toLowerCase() === 'online'
        )
      }
      return true
    })
  }, [channels, searchQuery, filterType])

  return (
    <View style={styles.container}>
      {/* Search & Filter Toolbar */}
      <ChannelFilterToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        onOpenAddModal={handleOpenAddModal}
      />

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
          filteredChannels.map((channel) => (
            <ChannelCardItem
              key={channel.id}
              channel={channel}
              onEdit={handleOpenEditModal}
              onToggleActive={handleToggleActive}
              onToggleDefault={handleToggleDefault}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ChannelDeleteModal
        channel={channelToDelete}
        isDeleting={isDeleting}
        onClose={() => setChannelToDelete(null)}
        onConfirm={confirmDeleteChannel}
      />

      {/* Add / Edit Channel Modal */}
      <ChannelFormModal
        visible={modalVisible}
        editingChannel={editingChannel}
        control={control}
        setValue={setValue}
        currentPlatform={currentPlatform}
        currentIsActive={Boolean(currentIsActive)}
        isDefault={isDefault}
        setIsDefault={setIsDefault}
        isSubmitting={isSubmitting}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit(onSubmit)}
      />
    </View>
  )
}

export default SalesChannelsScreen
