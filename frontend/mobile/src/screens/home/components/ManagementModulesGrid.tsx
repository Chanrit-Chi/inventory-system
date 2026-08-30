import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styles } from '../HomeScreen.styles'
import type { TabType } from '../../../types'

export interface ModuleItem {
  tab: TabType
  title: string
  sub: string
  icon: string
  color: string
  bg: string
}

export interface ManagementModulesGridProps {
  visibleModules: ModuleItem[]
  onNavigate: (tab: TabType) => void
}

export const ManagementModulesGrid: React.FC<ManagementModulesGridProps> = ({
  visibleModules,
  onNavigate,
}) => {
  if (visibleModules.length === 0) return null

  return (
    <>
      <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
        <Text style={styles.sectionTitle}>Management Modules</Text>
      </View>

      <View style={styles.modulesGrid}>
        {visibleModules.map((m) => (
          <TouchableOpacity
            key={m.tab}
            style={styles.moduleCard}
            onPress={() => onNavigate(m.tab)}
            activeOpacity={0.8}
          >
            <View style={[styles.moduleIcon, { backgroundColor: m.bg }]}>
              <Ionicons name={m.icon as any} size={18} color={m.color} />
            </View>
            <Text style={styles.moduleTitle}>{m.title}</Text>
            <Text style={styles.moduleSub}>{m.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  )
}
