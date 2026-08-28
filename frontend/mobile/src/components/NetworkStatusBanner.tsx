import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { ConnectionState } from '../hooks/useNetworkStatus'

interface NetworkStatusBannerProps {
  connectionState: ConnectionState
  isChecking?: boolean
  onRetry?: () => void
  customMessage?: string | null
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  connectionState,
  isChecking = false,
  onRetry,
  customMessage,
}) => {
  if (connectionState === 'online') {
    return null
  }

  const isOffline = connectionState === 'device_offline'
  const iconName = isOffline ? 'cloud-offline-outline' : 'warning-outline'
  const title = isOffline ? 'No Internet Connection' : 'Server Unreachable'
  const defaultSub = isOffline
    ? 'You are offline. Transactions will be saved locally.'
    : 'Cannot reach backend server. Tap to retry.'
  const message = customMessage || defaultSub

  const bgColor = isOffline ? '#FEF2F2' : '#FFFBEB'
  const borderColor = isOffline ? '#FCA5A5' : '#FDE68A'
  const textColor = isOffline ? '#991B1B' : '#92400E'
  const subTextColor = isOffline ? '#B91C1C' : '#B45309'
  const iconColor = isOffline ? '#DC2626' : '#D97706'

  return (
    <View style={[styles.banner, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.contentRow}>
        <View style={styles.iconBox}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: subTextColor }]} numberOfLines={2}>
            {message}
          </Text>
        </View>

        {Boolean(onRetry) && (
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: iconColor }]}
            onPress={onRetry}
            disabled={isChecking}
            activeOpacity={0.8}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <View style={styles.retryRow}>
                <Ionicons name="refresh-outline" size={14} color={iconColor} style={{ marginRight: 3 }} />
                <Text style={[styles.retryText, { color: textColor }]}>Retry</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.lg,
    borderWidth: 1,
    ...tokens.shadows.card,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },
})
