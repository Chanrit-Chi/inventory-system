import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { copyToClipboard, CopyableType } from '../utils/clipboard'

export interface CopyableBadgeProps {
  value?: string | null
  type?: CopyableType
  labelPrefix?: string
  customLabel?: string
  showIcon?: boolean
  prefixIcon?: boolean
  prefixIconName?: keyof typeof Ionicons.glyphMap
  onToast?: (message: string) => void
  variant?: 'default' | 'subtle' | 'pill' | 'dark' | 'outline' | 'compact'
  compact?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  iconColor?: string
  activeOpacity?: number
  testID?: string
  disabled?: boolean
}

export const CopyableBadge: React.FC<CopyableBadgeProps> = React.memo(({
  value,
  type = 'sku',
  labelPrefix,
  customLabel,
  showIcon = true,
  prefixIcon = false,
  prefixIconName,
  onToast,
  variant = 'default',
  compact = false,
  style,
  textStyle,
  iconColor,
  activeOpacity = 0.7,
  testID,
  disabled = false,
}) => {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const isCopyingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [])

  // Safe degradation: if value is null, undefined, not a string, or empty whitespace, render nothing
  if (!value || typeof value !== 'string' || !value.trim()) {
    return null
  }

  const cleanValue = value.trim()

  const handlePress = async (e: any) => {
    // Stop propagation so parent containers (e.g. clickable rows, cards, buttons) aren't triggered
    if (e) {
      e.stopPropagation?.()
      e.preventDefault?.()
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation?.()
        e.nativeEvent.stopPropagation?.()
      }
    }

    if (disabled || isCopyingRef.current) return
    isCopyingRef.current = true

    try {
      const success = await copyToClipboard(cleanValue, {
        type,
        label: labelPrefix ? labelPrefix.replace(/[:\s]+$/, '') : undefined,
        onToast,
      })

      if (isMountedRef.current && success) {
        setCopied(true)
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
        timerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setCopied(false)
          }
        }, 1500)
      }
    } finally {
      // Debounce window to prevent rapid spam taps
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        isCopyingRef.current = false
      }, 350)
    }
  }

  const isCompact = compact || variant === 'compact'
  const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : 'sku'

  const resolvedIconColor =
    iconColor ||
    (copied
      ? tokens.colors.statusSuccess
      : variant === 'dark'
      ? '#94A3B8'
      : tokens.colors.textMuted)

  const resolvedPrefixIconColor =
    iconColor ||
    (copied
      ? tokens.colors.statusSuccess
      : variant === 'dark'
      ? '#94A3B8'
      : tokens.colors.secondary)

  const defaultPrefixIcon: keyof typeof Ionicons.glyphMap =
    prefixIconName || (normalizedType === 'barcode' ? 'barcode-outline' : 'pricetag-outline')

  const displayText = customLabel
    ? customLabel
    : labelPrefix
    ? `${labelPrefix} ${cleanValue}`
    : cleanValue

  const accessibleType =
    normalizedType === 'sku'
      ? 'SKU'
      : normalizedType === 'barcode'
      ? 'Barcode'
      : type
  const accessibilityLabel = copied
    ? `Copied ${accessibleType}: ${cleanValue}`
    : `Copy ${accessibleType}: ${cleanValue}`

  return (
    <TouchableOpacity
      testID={testID || `copyable-badge-${type}-${cleanValue}`}
      style={[
        styles.badgeBase,
        isCompact ? styles.badgeCompact : styles.badgeDefault,
        variant === 'dark' && styles.badgeDark,
        variant === 'outline' && styles.badgeOutline,
        variant === 'subtle' && styles.badgeSubtle,
        copied && styles.badgeCopied,
        style,
      ]}
      onPress={handlePress}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to copy to clipboard"
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      {Boolean(prefixIcon) && (
        <Ionicons
          name={defaultPrefixIcon}
          size={isCompact ? 10 : 12}
          color={resolvedPrefixIconColor}
          style={styles.prefixIcon}
        />
      )}

      <Text
        style={[
          styles.textBase,
          isCompact ? styles.textCompact : styles.textDefault,
          variant === 'dark' && styles.textDark,
          copied && styles.textCopied,
          textStyle,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {displayText}
      </Text>

      {Boolean(showIcon) && (
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={isCompact ? 10 : 12}
          color={resolvedIconColor}
          style={styles.copyIcon}
        />
      )}
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#F1F5F9', // Crisp subtle gray pill
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '100%',
  },
  badgeDefault: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  badgeDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  badgeOutline: {
    backgroundColor: 'transparent',
    borderColor: tokens.colors.borderSubtle,
  },
  badgeSubtle: {
    backgroundColor: 'rgba(241, 245, 249, 0.65)',
    borderColor: 'transparent',
  },
  badgeCopied: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  prefixIcon: {
    marginRight: 1,
    flexShrink: 0,
  },
  textBase: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    flexShrink: 1,
  },
  textDefault: {
    fontSize: 11,
    lineHeight: 15,
  },
  textCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  textDark: {
    color: '#F8FAFC',
  },
  textCopied: {
    color: '#15803D',
    fontWeight: '700',
  },
  copyIcon: {
    marginLeft: 1,
    flexShrink: 0,
  },
})
