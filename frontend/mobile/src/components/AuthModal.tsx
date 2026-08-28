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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { UserAccount } from '../types'

export interface AuthModalProps {
  visible: boolean
  currentUser: UserAccount
  onClose: () => void
  onSwitchUser?: (user: UserAccount) => void
  onUpdateProfile: (updated: Partial<UserAccount>) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  currentUser,
  onClose,
  onUpdateProfile,
}) => {
  const [tab, setTab] = useState<'editProfile' | 'changePassword'>('editProfile')
  const [editName, setEditName] = useState(currentUser.name)
  const [editPhone, setEditPhone] = useState(currentUser.phone || '')
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty')
      return
    }
    onUpdateProfile({ name: editName, phone: editPhone })
    Alert.alert('Success', 'Profile updated successfully')
    onClose()
  }

  const [changingPassword, setChangingPassword] = useState(false)

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) {
      Alert.alert('Validation Error', 'Please fill in both password fields')
      return
    }
    if (newPass.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    try {
      const { changePassword } = await import('../api/endpoints')
      await changePassword(currentPass, newPass)
      Alert.alert('Success', 'Password changed successfully')
      setCurrentPass('')
      setNewPass('')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password. Check your current password.'
      Alert.alert('Password Change Failed', msg)
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Account & Profile</Text>
              <Text style={styles.headerSubtitle}>Logged in as {currentUser.email}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Sub Navigation */}
          <View style={styles.subTabs}>
            <TouchableOpacity
              style={[styles.subTabItem, tab === 'editProfile' && styles.subTabActive]}
              onPress={() => setTab('editProfile')}
            >
              <Text style={[styles.subTabText, tab === 'editProfile' && styles.subTabTextActive]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTabItem, tab === 'changePassword' && styles.subTabActive]}
              onPress={() => setTab('changePassword')}
            >
              <Text style={[styles.subTabText, tab === 'changePassword' && styles.subTabTextActive]}>
                Change Password
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {tab === 'editProfile' && (
              <View style={styles.formContainer}>
                <Text style={styles.formLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter full name"
                />

                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={currentUser.email}
                  editable={false}
                />

                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+855 ..."
                  keyboardType="phone-pad"
                />

                <Text style={styles.formLabel}>Current Role</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={currentUser.role}
                  editable={false}
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfile}>
                  <Text style={styles.primaryBtnText}>Save Profile Changes</Text>
                </TouchableOpacity>
              </View>
            )}

            {tab === 'changePassword' && (
              <View style={styles.formContainer}>
                <Text style={styles.formLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPass}
                  onChangeText={setCurrentPass}
                  placeholder="••••••••"
                  secureTextEntry
                />

                <Text style={styles.formLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPass}
                  onChangeText={setNewPass}
                  placeholder="••••••••"
                  secureTextEntry
                />

                <TouchableOpacity style={[styles.primaryBtn, changingPassword && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={changingPassword}>
                  {changingPassword
                    ? <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                    : <Text style={styles.primaryBtnText}>Update Password</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '85%',
    paddingBottom: tokens.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTitle: {
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  headerSubtitle: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  subTabs: {
    flexDirection: 'row',
    padding: tokens.spacing.sm,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  subTabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  subTabActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  subTabTextActive: {
    color: tokens.colors.onPrimary,
  },
  content: {
    padding: tokens.spacing.md,
  },
  formContainer: {
    paddingBottom: tokens.spacing.lg,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: tokens.spacing.sm,
  },
  input: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.colors.onBackground,
  },
  inputDisabled: {
    backgroundColor: tokens.colors.surfaceMuted,
    color: tokens.colors.secondary,
  },
  primaryBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: tokens.spacing.lg,
    ...tokens.shadows.card,
  },
  primaryBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
})
