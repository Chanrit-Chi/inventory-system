import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { PermissionGroup, TabType } from '../../../types'
import { styles } from '../AdminUsersScreen.styles'

export interface PermissionsMatrixTabProps {
  groups: PermissionGroup[]
  onNavigate: (tab: TabType) => void
}

export const PermissionsMatrixTab: React.FC<PermissionsMatrixTabProps> = ({
  groups,
  onNavigate,
}) => {
  return (
    <View>
      <View style={styles.roleManageBanner}>
        <View style={styles.roleManageBannerContent}>
          <View style={styles.roleManageIconBox}>
            <Ionicons name="key" size={20} color={tokens.colors.primaryContainer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleManageTitle}>Dynamic Role Permissions</Text>
            <Text style={styles.roleManageSub}>
              Configure dynamic capabilities, module wildcards, and access policies for system roles.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.configureRolesBtn}
          onPress={() => onNavigate('roles')}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-checkmark" size={16} color={tokens.colors.onPrimary} />
          <Text style={styles.configureRolesBtnText}>Configure Role Permissions</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Permission Groups & Role Hierarchy</Text>
      {groups.map((grp) => (
        <View key={grp.id} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{grp.name}</Text>
            <Text style={styles.groupUsersCount}>{grp.userCount} User(s)</Text>
          </View>
          <Text style={styles.groupDesc}>{grp.description}</Text>
          <View style={styles.permList}>
            {grp.permissions.map((p, i) => (
              <View key={i} style={styles.permChip}>
                <Text style={styles.permChipText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
