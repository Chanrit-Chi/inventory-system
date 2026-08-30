import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SettingsScreen.styles'
import type { UserAccount } from '../../../types'

export interface UserAccountSectionProps {
  currentUser: UserAccount | null
  loggingOut: boolean
  onLogout: () => void
}

export const UserAccountSection: React.FC<UserAccountSectionProps> = ({
  currentUser,
  loggingOut,
  onLogout,
}) => {
  return (
    <>
      {/* Account & Session Management Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Account & Session</Text>
        <Text style={styles.sectionSubtitle}>Current logged-in staff profile</Text>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountInfoRow}>
          <View style={styles.accountAvatar}>
            <Ionicons
              name={currentUser?.role === 'SUPER_ADMIN' ? 'shield-checkmark' : 'person'}
              size={22}
              color={tokens.colors.primaryContainer}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{currentUser?.name || 'Staff User'}</Text>
            <Text style={styles.accountEmail}>{currentUser?.email || 'user@kcinventory.com'}</Text>
            <View style={styles.accountRoleBadge}>
              <Text style={styles.accountRoleText}>{currentUser?.role || 'SELLER'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          testID="btn-settings-logout"
          style={styles.logoutBtn}
          onPress={onLogout}
          disabled={loggingOut}
          activeOpacity={0.85}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={tokens.colors.onPrimary} />
              <Text style={styles.logoutBtnText}>Sign Out / Logout</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  )
}
