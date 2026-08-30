import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ReportsScreen.styles'
import type { DateRangeMode } from '../reportUtils'

export interface ReportDateFilterBarProps {
  dateRange: DateRangeMode
  setDateRange: (mode: DateRangeMode) => void
  singleDate: string
  customFrom: string
  customTo: string
  onOpenCustomModal: () => void
  canExport: boolean
  onExport: (format: 'PDF' | 'Excel') => void
}

export const ReportDateFilterBar: React.FC<ReportDateFilterBarProps> = ({
  dateRange,
  setDateRange,
  singleDate,
  customFrom,
  customTo,
  onOpenCustomModal,
  canExport,
  onExport,
}) => {
  return (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reports & Analytics</Text>
          <Text style={styles.subtitle}>Financial performance & sales data</Text>
        </View>
        {canExport && (
          <TouchableOpacity
            style={styles.exportTopBtn}
            onPress={() => onExport('PDF')}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={15} color={tokens.colors.onPrimary} />
            <Text style={styles.exportTopText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dateSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateSelectorContent}
        >
          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'today' && styles.dateBtnActive]}
            onPress={() => setDateRange('today')}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === 'today' && styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '7d' && styles.dateBtnActive]}
            onPress={() => setDateRange('7d')}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === '7d' && styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '30d' && styles.dateBtnActive]}
            onPress={() => setDateRange('30d')}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === '30d' && styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              30 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'year' && styles.dateBtnActive]}
            onPress={() => setDateRange('year')}
          >
            <Text
              style={[
                styles.dateBtnText,
                dateRange === 'year' && styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Year
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dateBtn,
              (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnActive,
              { flexDirection: 'row', gap: 4 },
            ]}
            onPress={onOpenCustomModal}
          >
            <Ionicons
              name="calendar"
              size={12}
              color={
                dateRange === 'single' || dateRange === 'custom'
                  ? tokens.colors.onPrimary
                  : tokens.colors.secondary
              }
            />
            <Text
              style={[
                styles.dateBtnText,
                (dateRange === 'single' || dateRange === 'custom') &&
                  styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              {dateRange === 'single'
                ? singleDate
                : dateRange === 'custom'
                ? `${new Date(customFrom).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })} - ${new Date(customTo).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : 'Custom'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  )
}
