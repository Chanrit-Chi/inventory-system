import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'

type IconName = keyof typeof Ionicons.glyphMap

export interface PickerItem {
  id: string
  title: string
  subtitle?: string
  icon?: IconName
  iconColor?: string
  iconBg?: string
}

interface ListPickerModalProps {
  visible: boolean
  onClose: () => void
  title: string
  titleIcon?: IconName
  items: PickerItem[]
  selectedId?: string | null
  onSelect: (item: PickerItem) => void
}

export function ListPickerModal({
  visible,
  onClose,
  title,
  titleIcon = 'list',
  items,
  selectedId,
  onSelect,
}: ListPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={titleIcon} size={18} color={tokens.colors.primary} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={tokens.colors.onBackground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const isSelected = selectedId === item.id
              const color = item.iconColor || tokens.colors.primaryContainer
              const bg = item.iconBg || `${color}18`
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: bg }]}>
                    <Ionicons
                      name={item.icon || 'ellipse'}
                      size={18}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected && { color: tokens.colors.onBackground, fontWeight: '700' },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
                    ) : null}
                  </View>
                  {Boolean(isSelected) && (
                    <Ionicons name="checkmark-circle" size={20} color={color} />
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  content: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '65%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.outline,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  optionItemSelected: {
    backgroundColor: `${tokens.colors.primaryContainer}10`,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.onBackground,
  },
  optionSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
})
