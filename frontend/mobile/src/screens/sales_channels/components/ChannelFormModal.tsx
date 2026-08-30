import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SalesChannelsScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
import type { Control, UseFormSetValue } from 'react-hook-form'
import type { SalesChannelFormValues } from '../../../utils/validation'
import type { SalesChannel } from '../../../types'

export interface ChannelFormModalProps {
  visible: boolean
  editingChannel: SalesChannel | null
  control: Control<SalesChannelFormValues>
  setValue: UseFormSetValue<SalesChannelFormValues>
  currentPlatform: string
  currentIsActive: boolean
  isDefault: boolean
  setIsDefault: (val: boolean) => void
  isSubmitting: boolean
  onClose: () => void
  onSubmit: () => void
}

const PLATFORM_OPTIONS = [
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
]

export const ChannelFormModal: React.FC<ChannelFormModalProps> = ({
  visible,
  editingChannel,
  control,
  setValue,
  currentPlatform,
  currentIsActive,
  isDefault,
  setIsDefault,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
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
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Platform Selector */}
            <Text style={styles.inputLabel}>Selling Platform *</Text>
            <Text
              style={{
                fontSize: 11,
                color: tokens.colors.secondary,
                marginBottom: 8,
                marginTop: -2,
              }}
            >
              Select platform to allow using the same shop name across multiple channels (e.g. KC Shop on TikTok & Facebook)
            </Text>
            <View style={styles.typeOptionsGrid}>
              {PLATFORM_OPTIONS.map((item) => {
                const isSelected = currentPlatform === item.key
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.typeOptionCard,
                      isSelected && {
                        borderColor: item.color,
                        backgroundColor: `${item.color}15`,
                        borderWidth: 1.8,
                      },
                    ]}
                    onPress={() => {
                      setValue('platform', item.key as any)
                      setValue('type', item.key as any)
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
                style={[styles.toggleSwitch, isDefault && styles.toggleSwitchOn]}
                onPress={() => setIsDefault(!isDefault)}
                activeOpacity={0.8}
              >
                <View
                  style={[styles.toggleThumb, isDefault && styles.toggleThumbOn]}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Modal Bottom Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-save-sales-channel"
              style={styles.saveBtn}
              onPress={onSubmit}
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
  )
}
