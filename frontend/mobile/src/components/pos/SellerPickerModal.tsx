import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'
import type { UserAccount } from '../../types'

export interface SellerPickerModalProps {
  visible: boolean
  onClose: () => void
  users: UserAccount[]
  selectedSellerId: string | null
  currentUserId?: string | null
  onSelectSeller: (user: UserAccount) => void
  onResetToMe?: () => void
}

export const SellerPickerModal: React.FC<SellerPickerModalProps> = ({
  visible,
  onClose,
  users,
  selectedSellerId,
  currentUserId,
  onSelectSeller,
  onResetToMe,
}) => {
  const [search, setSearch] = useState('')

  const activeUsers = useMemo(() => {
    return (users || []).filter((u) => {
      if (u.isActive === false) return false
      const normalizedRole = (u.role || '').toUpperCase().trim()
      // Exclude super admins unless it's the current user themselves
      if ((normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'SUPERADMIN') && u.id !== currentUserId) {
        return false
      }
      return true
    })
  }, [users, currentUserId])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return activeUsers
    const q = search.toLowerCase().trim()
    return activeUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    )
  }, [activeUsers, search])

  const meUser = useMemo(() => {
    return activeUsers.find((u) => u.id === currentUserId)
  }, [activeUsers, currentUserId])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Assign Sales Representative</Text>
              <Text style={styles.subtitle}>Select staff member who receives incentive credit</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={tokens.colors.secondary} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search staff name or role..."
              placeholderTextColor={tokens.colors.secondary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {Boolean(search) && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick "Assign to Me" Button if someone else is selected */}
          {Boolean(meUser && selectedSellerId && selectedSellerId !== currentUserId) && (
            <TouchableOpacity
              style={styles.assignToMeBtn}
              onPress={() => {
                onResetToMe?.()
                if (meUser) onSelectSeller(meUser)
                onClose()
              }}
              activeOpacity={0.8}
            >
              <View style={styles.assignToMeIcon}>
                <Ionicons name="person" size={14} color={tokens.colors.primary} />
              </View>
              <Text style={styles.assignToMeText}>Reset to Me ({meUser?.name})</Text>
              <Ionicons name="checkmark-circle" size={16} color={tokens.colors.primary} />
            </TouchableOpacity>
          )}

          {/* Staff List */}
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.id === (selectedSellerId || currentUserId)
              const isMe = item.id === currentUserId

              return (
                <TouchableOpacity
                  style={[styles.userRow, isSelected && styles.userRowSelected]}
                  onPress={() => {
                    onSelectSeller(item)
                    onClose()
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.avatarBox, isSelected && styles.avatarBoxSelected]}>
                    <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                      {(item.name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userNameText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {Boolean(isMe) && (
                        <View style={styles.meBadge}>
                          <Text style={styles.meBadgeText}>Me</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userRoleText}>{item.role || 'Staff'}</Text>
                  </View>

                  {isSelected ? (
                    <Ionicons name="radio-button-on" size={20} color={tokens.colors.primaryContainer} />
                  ) : (
                    <Ionicons name="radio-button-off" size={20} color={tokens.colors.borderDark} />
                  )}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopLeftRadius: tokens.borderRadius.xl,
    borderTopRightRadius: tokens.borderRadius.xl,
    paddingTop: 10,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.borderDark,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  title: {
    ...tokens.typography.section,
    color: tokens.colors.onBackground,
  },
  subtitle: {
    ...tokens.typography.caption,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    marginHorizontal: tokens.spacing.md,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    ...tokens.typography.body,
    color: tokens.colors.onBackground,
  },
  assignToMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryFixed,
    marginHorizontal: tokens.spacing.md,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.md,
    gap: 8,
  },
  assignToMeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignToMeText: {
    flex: 1,
    ...tokens.typography.bodySemibold,
    color: tokens.colors.primary,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
    paddingTop: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.md,
    marginVertical: 2,
  },
  userRowSelected: {
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarBoxSelected: {
    backgroundColor: tokens.colors.primaryFixed,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.secondary,
  },
  avatarTextSelected: {
    color: tokens.colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.onBackground,
  },
  meBadge: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: tokens.borderRadius.pill,
  },
  meBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  userRoleText: {
    ...tokens.typography.caption,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
})
