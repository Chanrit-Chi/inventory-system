import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ExpensesScreen.styles'

export interface ExpenseCalendarModalProps {
  visible: boolean
  tempMode: 'single' | 'custom'
  setTempMode: (m: 'single' | 'custom') => void
  tempSingleDate: string
  setTempSingleDate: (d: string) => void
  tempCustomFrom: string
  setTempCustomFrom: (d: string) => void
  tempCustomTo: string
  setTempCustomTo: (d: string) => void
  onClose: () => void
  onApplySingleDate: () => void
  onApplyCustomRange: () => void
  handleRangeDayPress: (day: { dateString: string }) => void
  getRangeMarkedDates: () => Record<string, any>
}

export const ExpenseCalendarModal: React.FC<ExpenseCalendarModalProps> = ({
  visible,
  tempMode,
  setTempMode,
  tempSingleDate,
  setTempSingleDate,
  tempCustomFrom,
  setTempCustomFrom,
  tempCustomTo,
  setTempCustomTo,
  onClose,
  onApplySingleDate,
  onApplyCustomRange,
  handleRangeDayPress,
  getRangeMarkedDates,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar" size={18} color={tokens.colors.primaryContainer} />
              <Text style={styles.modalTitle}>Select Date Range</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Filter expenses by single day or date range</Text>

          {/* Mode Switcher Tabs */}
          <View style={styles.modalModeSwitcher}>
            <TouchableOpacity
              style={[styles.modalModeTab, tempMode === 'custom' && styles.modalModeTabActive]}
              onPress={() => setTempMode('custom')}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={tempMode === 'custom' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text style={[styles.modalModeTabText, tempMode === 'custom' && styles.modalModeTabTextActive]}>
                Date Range
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalModeTab, tempMode === 'single' && styles.modalModeTabActive]}
              onPress={() => setTempMode('single')}
            >
              <Ionicons
                name="today-outline"
                size={14}
                color={tempMode === 'single' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text style={[styles.modalModeTabText, tempMode === 'single' && styles.modalModeTabTextActive]}>
                Single Date
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {/* Quick Presets */}
            <Text style={styles.inputLabel}>QUICK PRESETS</Text>
            <View style={styles.quickPresetsGrid}>
              {[
                {
                  label: 'Today',
                  action: () => {
                    const t = new Date().toISOString().split('T')[0]
                    setTempSingleDate(t)
                    setTempCustomFrom(t)
                    setTempCustomTo(t)
                  },
                },
                {
                  label: 'Yesterday',
                  action: () => {
                    const y = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                    setTempSingleDate(y)
                    setTempCustomFrom(y)
                    setTempCustomTo(y)
                  },
                },
                {
                  label: 'Last 7 Days',
                  action: () => {
                    const t = new Date().toISOString().split('T')[0]
                    const f = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
                    setTempMode('custom')
                    setTempCustomFrom(f)
                    setTempCustomTo(t)
                  },
                },
                {
                  label: 'Last 30 Days',
                  action: () => {
                    const t = new Date().toISOString().split('T')[0]
                    const f = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
                    setTempMode('custom')
                    setTempCustomFrom(f)
                    setTempCustomTo(t)
                  },
                },
                {
                  label: 'This Month',
                  action: () => {
                    const now = new Date()
                    const f = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                    const t = now.toISOString().split('T')[0]
                    setTempMode('custom')
                    setTempCustomFrom(f)
                    setTempCustomTo(t)
                  },
                },
                {
                  label: 'This Year',
                  action: () => {
                    const now = new Date()
                    const f = `${now.getFullYear()}-01-01`
                    const t = now.toISOString().split('T')[0]
                    setTempMode('custom')
                    setTempCustomFrom(f)
                    setTempCustomTo(t)
                  },
                },
              ].map((preset, idx) => (
                <TouchableOpacity key={idx} style={styles.presetChip} onPress={preset.action}>
                  <Text style={styles.presetChipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tempMode === 'single' ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.inputLabel}>CALENDAR PICKER</Text>
                <Calendar
                  current={tempSingleDate}
                  onDayPress={(day: { dateString: string }) => setTempSingleDate(day.dateString)}
                  markedDates={{
                    [tempSingleDate]: {
                      selected: true,
                      selectedColor: tokens.colors.primaryContainer,
                    },
                  }}
                  theme={{
                    todayTextColor: tokens.colors.primaryContainer,
                    arrowColor: tokens.colors.primaryContainer,
                    textDayFontSize: 13,
                    textMonthFontSize: 14,
                    textDayHeaderFontSize: 12,
                  }}
                />
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>OR TYPE DATE (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  value={tempSingleDate}
                  onChangeText={setTempSingleDate}
                  placeholderTextColor={tokens.colors.secondary}
                />
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.inputLabel}>SELECT START & END DATES ON CALENDAR</Text>
                <Calendar
                  onDayPress={handleRangeDayPress}
                  markingType="period"
                  markedDates={getRangeMarkedDates()}
                  theme={{
                    todayTextColor: tokens.colors.primaryContainer,
                    arrowColor: tokens.colors.primaryContainer,
                    textDayFontSize: 13,
                    textMonthFontSize: 14,
                    textDayHeaderFontSize: 12,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>FROM DATE</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="YYYY-MM-DD"
                      value={tempCustomFrom}
                      onChangeText={setTempCustomFrom}
                      placeholderTextColor={tokens.colors.secondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>TO DATE</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="YYYY-MM-DD"
                      value={tempCustomTo}
                      onChangeText={setTempCustomTo}
                      placeholderTextColor={tokens.colors.secondary}
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalApplyBtn}
              onPress={tempMode === 'single' ? onApplySingleDate : onApplyCustomRange}
            >
              <Text style={styles.modalApplyBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
