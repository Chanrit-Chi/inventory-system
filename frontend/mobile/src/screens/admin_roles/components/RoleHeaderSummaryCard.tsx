import React from 'react'
import {
  View,
  Text,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../AdminRolesScreen.styles'
import type { RoleItem } from '../../../types'

export interface RoleHeaderSummaryCardProps {
  selectedRole: RoleItem
  roleStyle: { bg: string; text: string; border: string }
  isSuperAdminRole: boolean
  activePermissions: string[]
  isDirty: boolean
  saveSuccessMessage: string | null
}

export const RoleHeaderSummaryCard: React.FC<RoleHeaderSummaryCardProps> = ({
  selectedRole,
  roleStyle,
  isSuperAdminRole,
  activePermissions,
  isDirty,
  saveSuccessMessage,
}) => {
  return (
    <View style={styles.roleSummaryCard}>
      <View style={styles.roleSummaryTop}>
        <View style={styles.roleSummaryInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.roleSummaryName}>{selectedRole.name}</Text>
            <View style={[styles.roleSlugBadge, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleSlugText, { color: roleStyle.text }]}>
                {selectedRole.slug}
              </Text>
            </View>
          </View>
          <Text style={styles.roleSummaryDesc}>{selectedRole.description}</Text>
        </View>
        {isSuperAdminRole && (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={16} color="#5B21B6" />
            <Text style={styles.lockBadgeText}>Root Lock</Text>
          </View>
        )}
      </View>

      {isSuperAdminRole ? (
        <View style={styles.superAdminNotice}>
          <Ionicons name="shield-checkmark" size={18} color="#5B21B6" />
          <Text style={styles.superAdminNoticeText}>
            Super Admin holds permanent wildcard root access (*). All system capabilities are always granted.
          </Text>
        </View>
      ) : (
        <View style={styles.permissionsStatsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Active Grants</Text>
            <Text style={styles.statValue}>
              {activePermissions.includes('*')
                ? 'All (*)'
                : `${activePermissions.length} rule(s)`}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Status</Text>
            <Text
              style={[
                styles.statValue,
                {
                  color: isDirty
                    ? tokens.colors.statusWarning
                    : tokens.colors.statusSuccess,
                },
              ]}
            >
              {isDirty ? 'Unsaved Changes' : 'Synced'}
            </Text>
          </View>
        </View>
      )}

      {Boolean(saveSuccessMessage) && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color={tokens.colors.statusSuccess} />
          <Text style={styles.successBannerText}>{saveSuccessMessage}</Text>
        </View>
      )}
    </View>
  )
}
