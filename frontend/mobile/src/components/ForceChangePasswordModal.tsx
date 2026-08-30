import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { UserAccount } from '../types'
import { useAuth } from '../context/AuthContext'
import { changePassword } from '../api/endpoints'
import { emitGlobalToast } from '../utils/clipboard'

export interface ForceChangePasswordModalProps {
  visible: boolean
  currentUser: UserAccount
  onPasswordChanged?: () => void
}

export const ForceChangePasswordModal: React.FC<ForceChangePasswordModalProps> = ({
  visible,
  currentUser,
  onPasswordChanged,
}) => {
  const { logout, updateProfile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isMinLength = newPassword.length >= 8
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = currentPassword.length > 0 && isMinLength && isMatch

  const handleSubmit = async () => {
    if (!currentPassword) {
      setErrorMessage('Please enter your temporary password.')
      return
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.')
      return
    }

    setErrorMessage('')
    setLoading(true)

    try {
      await changePassword(currentPassword, newPassword)

      // Update local auth context state
      updateProfile({
        mustChangePassword: false,
        must_change_password: false,
      })

      emitGlobalToast('Password changed successfully! Welcome to the system.', 'success')
      onPasswordChanged?.()
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update password. Please check your temporary password and try again.'
      setErrorMessage(msg)
      Alert.alert('Update Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to change your password on next sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout()
          },
        },
      ]
    )
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.lockIconContainer}>
              <Ionicons name="key-outline" size={36} color={tokens.colors.primaryContainer} />
            </View>
            <Text style={styles.title}>First Login - Set New Password</Text>
            <Text style={styles.subtitle}>
              For security, you must replace your temporary password before accessing the system.
            </Text>
            <View style={styles.userBadge}>
              <Ionicons name="person-circle-outline" size={16} color={tokens.colors.secondary} />
              <Text style={styles.userBadgeText}>
                {currentUser.name} ({currentUser.email})
              </Text>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {Boolean(errorMessage) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={tokens.colors.statusError ?? '#EF4444'} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Current / Temporary Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Current Temporary Password *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={(val) => {
                    setCurrentPassword(val)
                    setErrorMessage('')
                  }}
                  placeholder="Enter temporary password"
                  placeholderTextColor={tokens.colors.textMuted}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowCurrentPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={tokens.colors.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val)
                    setErrorMessage('')
                  }}
                  placeholder="At least 8 characters"
                  placeholderTextColor={tokens.colors.textMuted}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNewPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={tokens.colors.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm New Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val)
                    setErrorMessage('')
                  }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={tokens.colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={tokens.colors.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Validation Checklist */}
            <View style={styles.checklist}>
              <View style={styles.checkItem}>
                <Ionicons
                  name={isMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={isMinLength ? tokens.colors.statusSuccess : tokens.colors.secondary}
                />
                <Text style={[styles.checkText, isMinLength && styles.checkTextActive]}>
                  At least 8 characters
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons
                  name={isMatch ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={isMatch ? tokens.colors.statusSuccess : tokens.colors.secondary}
                />
                <Text style={[styles.checkText, isMatch && styles.checkTextActive]}>
                  Passwords match
                </Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, (!canSubmit || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color={tokens.colors.onPrimary} />
                  <Text style={styles.submitBtnText}>Set New Password & Continue</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Sign Out Option */}
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={loading}>
              <Ionicons name="log-out-outline" size={16} color={tokens.colors.secondary} />
              <Text style={styles.signOutBtnText}>Sign Out / Switch User</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
    gap: 8,
  },
  lockIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.colors.primaryContainer + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: tokens.spacing.md,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    marginTop: 4,
  },
  userBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  formCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    ...tokens.shadows.card,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: tokens.borderRadius.input,
    padding: tokens.spacing.sm,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.statusError ?? '#EF4444',
    lineHeight: 16,
    fontWeight: '500',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 14,
    color: tokens.colors.onBackground,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  checklist: {
    gap: 6,
    paddingVertical: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  checkTextActive: {
    color: tokens.colors.statusSuccess,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
    ...tokens.shadows.card,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
})
