import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { UserAccount } from '../../../types'
import { styles } from '../AdminUsersScreen.styles'
import { generateSecureTemporaryPassword } from '../../../utils/password'
import { copyToClipboard } from '../../../utils/clipboard'
import { getRoleBadge } from './StaffManagementTab'

export interface ResetPasswordModalProps {
  visible: boolean
  user: UserAccount | null
  onClose: () => void
  onConfirm: (newPassword: string) => Promise<void>
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  visible,
  user,
  onClose,
  onConfirm,
}) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-generate a fresh password each time the modal opens
  useEffect(() => {
    if (visible && user) {
      setPassword(generateSecureTemporaryPassword(12))
      setShowPassword(true)
      setError('')
      setLoading(false)
    }
  }, [visible, user])

  const handleRegenerate = () => {
    setPassword(generateSecureTemporaryPassword(12))
    setError('')
  }

  const handleCopy = () => {
    if (password) {
      copyToClipboard(password, { label: 'Temporary Password' })
    }
  }

  const handleConfirm = async () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onConfirm(password)
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to reset password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const badge = getRoleBadge(user.role)
  const initial = user.name ? user.name.charAt(0).toUpperCase() : '?'

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.resetPwdIconBox}>
                <Ionicons name="key-outline" size={16} color="#B45309" />
              </View>
              <Text style={styles.modalTitle}>Reset Password</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Body content with proper padding */}
          <View style={{ padding: 16, gap: 14 }}>
            {/* User identity chip */}
            <View style={styles.resetPwdUserChip}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: badge.bg, marginLeft: 8 }]}>
              <Text style={[styles.roleBadgeText, { color: badge.text }]}>{user.role}</Text>
            </View>
          </View>

          {/* Password field */}
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.formLabel, { marginBottom: 6 }]}>Temporary Password</Text>
            <View style={styles.resetPwdRow}>
              <TextInput
                style={styles.resetPwdInput}
                value={password}
                onChangeText={(v) => { setPassword(v); setError('') }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter or generate..."
                placeholderTextColor={tokens.colors.textMuted}
              />
              <TouchableOpacity
                style={styles.resetPwdActionBtn}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color={tokens.colors.secondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resetPwdActionBtn}
                onPress={handleRegenerate}
                accessibilityLabel="Generate new password"
              >
                <Ionicons name="refresh-outline" size={16} color={tokens.colors.primaryContainer} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resetPwdActionBtn}
                onPress={handleCopy}
                accessibilityLabel="Copy password"
              >
                <Ionicons name="copy-outline" size={16} color={tokens.colors.primaryContainer} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginTop: 4 }}>
              Min. 8 characters. Tap refresh to auto-generate a secure password.
            </Text>
          </View>

          {/* Warning notice */}
          <View style={styles.resetPwdWarning}>
            <Ionicons name="shield-checkmark" size={15} color="#B45309" />
            <Text style={styles.resetPwdWarningText}>
              The user will be required to change this password on their next login. Share it securely.
            </Text>
          </View>

          {Boolean(error) && (
            <View style={styles.resetPwdError}>
              <Ionicons name="alert-circle-outline" size={14} color={tokens.colors.statusError} />
              <Text style={styles.resetPwdErrorText}>{error}</Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.resetPwdFooter}>
            <TouchableOpacity
              style={styles.resetPwdCancelBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.resetPwdCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.resetPwdConfirmBtn,
                (loading || password.length < 8) && { opacity: 0.5 },
              ]}
              onPress={handleConfirm}
              disabled={loading || password.length < 8}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="key" size={15} color="#FFFFFF" />
              )}
              <Text style={styles.resetPwdConfirmText}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}
