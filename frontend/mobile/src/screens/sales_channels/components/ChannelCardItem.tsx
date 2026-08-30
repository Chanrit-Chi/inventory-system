import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SalesChannelsScreen.styles'
import { getChannelPlatformMeta } from '../salesChannelUtils'
import type { SalesChannel } from '../../../types'

export interface ChannelCardItemProps {
  channel: SalesChannel
  onEdit: (channel: SalesChannel) => void
  onToggleActive: (channel: SalesChannel) => void
  onToggleDefault: (channel: SalesChannel) => void
  onDelete: (channel: SalesChannel) => void
}

export const ChannelCardItem: React.FC<ChannelCardItemProps> = React.memo(({
  channel,
  onEdit,
  onToggleActive,
  onToggleDefault,
  onDelete,
}) => {
  const platformMeta = getChannelPlatformMeta(channel)
  const isInactive = channel.is_active === false
  const isDefaultChannel = Boolean(channel.is_default || channel.isDefault)

  return (
    <View style={[styles.channelCard, isInactive && styles.channelCardInactive]}>
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
              onPress={() => onToggleDefault(channel)}
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
            onPress={() => onEdit(channel)}
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
            onPress={() => onToggleActive(channel)}
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
            onPress={() => onDelete(channel)}
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
