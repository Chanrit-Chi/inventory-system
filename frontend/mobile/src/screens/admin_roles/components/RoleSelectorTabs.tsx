import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { tokens } from '../../../theme/tokens'
import { styles } from '../AdminRolesScreen.styles'
import type { RoleItem } from '../../../types'

export interface RoleSelectorTabsProps {
  roles: RoleItem[]
  selectedRoleSlug: string
  onSelectRoleSlug: (slug: string) => void
  getRoleBadgeStyle: (slug: string) => { bg: string; text: string; border: string }
}

export const RoleSelectorTabs: React.FC<RoleSelectorTabsProps> = React.memo(({
  roles,
  selectedRoleSlug,
  onSelectRoleSlug,
  getRoleBadgeStyle,
}) => {
  return (
    <View style={styles.roleTabsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.roleTabsContent}
      >
        {roles.map((r) => {
          const isSelected = r.slug === selectedRoleSlug
          const badge = getRoleBadgeStyle(r.slug)
          return (
            <TouchableOpacity
              key={r.id || r.slug}
              style={[
                styles.roleTabBtn,
                isSelected && styles.roleTabBtnActive,
                isSelected && { borderColor: tokens.colors.primaryContainer },
              ]}
              onPress={() => onSelectRoleSlug(r.slug)}
              activeOpacity={0.8}
            >
              <View style={[styles.roleTabIndicator, { backgroundColor: badge.text }]} />
              <Text
                style={[
                  styles.roleTabText,
                  isSelected && styles.roleTabTextActive,
                ]}
              >
                {r.name}
              </Text>
              {r.users_count !== undefined && (
                <View
                  style={[
                    styles.roleCountBadge,
                    isSelected && styles.roleCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleCountText,
                      isSelected && styles.roleCountTextActive,
                    ]}
                  >
                    {r.users_count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
})
