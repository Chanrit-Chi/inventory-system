import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'

interface ServerErrorStateProps {
  title?: string
  message?: string | null
  onRetry?: () => void
  isRetrying?: boolean
  isOffline?: boolean
  compact?: boolean
}

export const ServerErrorState: React.FC<ServerErrorStateProps> = ({
  title,
  message,
  onRetry,
  isRetrying = false,
  isOffline = false,
  compact = false,
}) => {
  const defaultTitle = isOffline ? 'No Internet Connection' : 'Unable to Connect to Server'
  const defaultMessage = isOffline
    ? 'Please check your Wi-Fi or mobile data connection and try again.'
    : 'The backend server could not be reached. Please check your network or ensure the server is running.'

  const displayTitle = title || defaultTitle
  const displayMessage = message || defaultMessage
  const iconName = isOffline ? 'cloud-offline-outline' : 'server-outline'
  const iconColor = isOffline ? '#DC2626' : '#D97706'
  const iconBg = isOffline ? '#FEF2F2' : '#FEF3C7'

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name={iconName} size={20} color={iconColor} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.compactTitle}>{displayTitle}</Text>
          <Text style={styles.compactMessage} numberOfLines={2}>{displayMessage}</Text>
        </View>
        {Boolean(onRetry) && (
          <TouchableOpacity
            style={styles.compactRetryBtn}
            onPress={onRetry}
            disabled={isRetrying}
            activeOpacity={0.8}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            ) : (
              <Text style={styles.compactRetryText}>Retry</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={36} color={iconColor} />
      </View>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      {Boolean(onRetry) && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          disabled={isRetrying}
          activeOpacity={0.85}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="refresh" size={16} color={tokens.colors.onPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    minHeight: 280,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: tokens.colors.secondary,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: tokens.spacing.lg,
  },
  retryButton: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    ...tokens.shadows.card,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: tokens.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    marginVertical: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  compactMessage: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  compactRetryBtn: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
  },
  compactRetryText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
})
