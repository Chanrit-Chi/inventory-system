import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../AdminRolesScreen.styles'
import { type PermissionModuleGroup, getPermissionOriginStatus } from '../adminRoleUtils'

export interface PermissionModuleSectionProps {
  group: PermissionModuleGroup
  isExpanded: boolean
  isSuperAdminRole: boolean
  selectedRoleSlug?: string
  saving: boolean
  onToggleExpanded: (groupId: string) => void
  onToggleModuleAll: (group: PermissionModuleGroup, enable: boolean) => void
  onTogglePermission: (slug: string, moduleName: string) => void
  isPermissionEnabled: (slug: string, moduleName?: string) => boolean
}

export const PermissionModuleSection: React.FC<PermissionModuleSectionProps> = ({
  group,
  isExpanded,
  isSuperAdminRole,
  selectedRoleSlug,
  saving,
  onToggleExpanded,
  onToggleModuleAll,
  onTogglePermission,
  isPermissionEnabled,
}) => {
  const allEnabled = group.permissions.every((p) => isPermissionEnabled(p.slug, group.id))
  const activeCount = group.permissions.filter((p) =>
    isPermissionEnabled(p.slug, group.id)
  ).length

  return (
    <View style={styles.moduleGroupCard}>
      {/* Accordion Module Header */}
      <TouchableOpacity
        style={styles.moduleHeader}
        onPress={() => onToggleExpanded(group.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.moduleHeaderLeft}>
          <View style={[styles.moduleIconBox, { backgroundColor: `${group.color}15` }]}>
            <Ionicons name={group.icon} size={18} color={group.color} />
          </View>
          <View>
            <Text style={styles.moduleTitle}>{group.name}</Text>
            <Text style={styles.moduleCount}>
              {activeCount} of {group.permissions.length} capabilities active
            </Text>
          </View>
        </View>

        {!isSuperAdminRole && (
          <TouchableOpacity
            style={styles.bulkToggleBtn}
            onPress={() => onToggleModuleAll(group, !allEnabled)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.bulkToggleText}>
              {allEnabled ? 'Disable All' : 'Enable All'}
            </Text>
          </TouchableOpacity>
        )}

        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={tokens.colors.secondary}
          style={styles.accordionChevron}
        />
      </TouchableOpacity>

      {/* Permission Items in this Module (only when expanded) */}
      {Boolean(isExpanded) && (
        <>
          <View style={styles.moduleDivider} />
          <View style={styles.permissionsList}>
            {group.permissions.map((perm) => {
              const enabled = isPermissionEnabled(perm.slug, group.id)
              const originInfo = getPermissionOriginStatus(perm.slug, selectedRoleSlug || 'ADMIN', enabled || isSuperAdminRole)

              return (
                <View key={perm.slug} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={styles.permissionName}>{perm.name}</Text>
                      <View style={styles.slugCodeChip}>
                        <Text style={styles.slugCodeText}>{perm.slug}</Text>
                      </View>

                      {/* Visual Origin Distinction Badge */}
                      {originInfo.type !== 'UNGRANTED' && (
                        <View
                          style={[
                            styles.originBadgeChip,
                            {
                              backgroundColor: originInfo.bg,
                              borderColor: originInfo.borderColor,
                            },
                          ]}
                        >
                          <Ionicons name={originInfo.icon} size={10} color={originInfo.color} />
                          <Text style={[styles.originBadgeText, { color: originInfo.color }]}>
                            {originInfo.label}
                          </Text>
                        </View>
                      )}
                    </View>
                    {Boolean(perm.description) && (
                      <Text style={styles.permissionDesc}>{perm.description}</Text>
                    )}
                  </View>

                  <Switch
                    value={enabled}
                    onValueChange={() => onTogglePermission(perm.slug, group.id)}
                    disabled={isSuperAdminRole || saving}
                    trackColor={{
                      false: tokens.colors.surfaceMuted,
                      true: tokens.colors.primaryContainer,
                    }}
                    thumbColor={
                      Platform.OS === 'android'
                        ? enabled
                          ? tokens.colors.onPrimary
                          : '#f4f3f4'
                        : undefined
                    }
                  />
                </View>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}
