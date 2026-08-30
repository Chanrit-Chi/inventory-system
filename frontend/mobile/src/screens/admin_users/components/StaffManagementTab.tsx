import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { UserAccount, UserRole } from '../../../types'
import { styles } from '../AdminUsersScreen.styles'

export function getRoleBadge(role: UserRole) {
  switch (role) {
    case 'SUPER_ADMIN':
      return { bg: '#EDE9FE', text: '#5B21B6' }
    case 'ADMIN':
      return { bg: '#E0F2FE', text: '#0369A1' }
    case 'MANAGER':
      return { bg: '#DCFCE7', text: '#15803D' }
    case 'SELLER':
      return { bg: '#FEF3C7', text: '#B45309' }
    default:
      return { bg: tokens.colors.surfaceMuted, text: tokens.colors.secondary }
  }
}

export interface StaffManagementTabProps {
  users: UserAccount[]
  usersLoading: boolean
  canManage: boolean
  onSelectUserDetail: (u: UserAccount) => void
  onOpenEdit: (u: UserAccount) => void
  onToggleActive: (u: UserAccount) => void
  onDeleteUser: (u: UserAccount) => void
}

export const StaffManagementTab: React.FC<StaffManagementTabProps> = ({
  users,
  usersLoading,
  canManage,
  onSelectUserDetail,
  onOpenEdit,
  onToggleActive,
  onDeleteUser,
}) => {
  if (usersLoading && users.length === 0) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
        <Text style={styles.centerLoadingText}>Loading staff accounts...</Text>
      </View>
    )
  }

  return (
    <View>
      {users.map((u) => {
        const badge = getRoleBadge(u.role)
        const initial = u.name ? u.name.charAt(0).toUpperCase() : '?'

        return (
          <TouchableOpacity
            key={u.id}
            style={[styles.userCard, !u.isActive && styles.userCardInactive]}
            activeOpacity={0.85}
            onPress={() => onSelectUserDetail(u)}
          >
            {/* Top Identity Block */}
            <View style={styles.userCardTop}>
              <View style={[styles.avatarBox, !u.isActive && styles.avatarBoxInactive]}>
                <Text style={styles.avatarLetter}>{initial}</Text>
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: badge.text }]}>{u.role}</Text>
                  </View>
                </View>

                <Text style={styles.userEmail} numberOfLines={1}>
                  {u.email}
                </Text>

                <View style={styles.staffMetaRow}>
                  <View style={styles.deptBadge}>
                    <Ionicons name="business-outline" size={11} color={tokens.colors.secondary} />
                    <Text style={styles.deptBadgeText} numberOfLines={1}>{u.department || 'Main Counter'}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusDotPill,
                      { backgroundColor: u.isActive ? tokens.colors.statusSuccess + '18' : '#FEE2E2' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDotSmall,
                        { backgroundColor: u.isActive ? tokens.colors.statusSuccess : '#DC2626' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusDotText,
                        { color: u.isActive ? tokens.colors.statusSuccess : '#DC2626' },
                      ]}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Action Footer Toolbar */}
            <View style={styles.userCardDivider} />

            <View style={styles.userCardBottom}>
              <TouchableOpacity
                style={styles.statsPreviewBtn}
                onPress={(e) => {
                  e.stopPropagation?.()
                  onSelectUserDetail(u)
                }}
              >
                <Ionicons name="bar-chart" size={13} color={tokens.colors.primaryContainer} />
                <Text style={styles.statsPreviewBtnText}>Performance & Raises</Text>
                <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
              </TouchableOpacity>

              {Boolean(canManage) && (
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.cardActionIconBtn}
                    onPress={(e) => {
                      e.stopPropagation?.()
                      onOpenEdit(u)
                    }}
                    accessibilityLabel={`Edit ${u.name}`}
                  >
                    <Ionicons name="pencil" size={13} color={tokens.colors.onBackground} />
                  </TouchableOpacity>

                  {u.role !== 'SUPER_ADMIN' && (
                    <TouchableOpacity
                      style={[styles.cardActionIconBtn, !u.isActive && styles.reactivateIconBtn]}
                      onPress={(e) => {
                        e.stopPropagation?.()
                        onToggleActive(u)
                      }}
                      accessibilityLabel={u.isActive ? 'Deactivate user' : 'Reactivate user'}
                    >
                      <Ionicons
                        name={u.isActive ? 'pause' : 'play'}
                        size={13}
                        color={u.isActive ? tokens.colors.statusWarning : tokens.colors.statusSuccess}
                      />
                    </TouchableOpacity>
                  )}

                  {u.role !== 'SUPER_ADMIN' && (
                    <TouchableOpacity
                      testID={`btn-delete-user-${u.id}`}
                      style={[styles.cardActionIconBtn, styles.deleteIconBtn]}
                      onPress={(e) => {
                        e.stopPropagation?.()
                        onDeleteUser(u)
                      }}
                      accessibilityLabel={`Delete ${u.name}`}
                    >
                      <Ionicons name="trash-outline" size={13} color={tokens.colors.statusError} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
