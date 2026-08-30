import React from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import { tokens } from '../../../theme/tokens'
import { styles } from '../AdminUsersScreen.styles'

export interface AuditCalendarModalProps {
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
  onDayPress: (day: { dateString: string }) => void
  onApply: () => void
  getRangeMarkedDates: () => Record<string, { startingDay?: boolean; endingDay?: boolean; color?: string; textColor?: string; disableTouchEvent?: boolean }>
}

export const AuditCalendarModal: React.FC<AuditCalendarModalProps> = ({
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
  onDayPress,
  onApply,
  getRangeMarkedDates,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.customDateModalSheet}>
          {/* Modal Header */}
          <View style={styles.modalTopBar}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="calendar" size={20} color={tokens.colors.primaryContainer} />
              <Text style={styles.customDateModalTitle}>Select Audit Date Range</Text>
            </View>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, tempMode === 'custom' && styles.modeTabActive]}
              onPress={() => setTempMode('custom')}
            >
              <Text
                style={[
                  styles.modeTabText,
                  tempMode === 'custom' && styles.modeTabTextActive,
                ]}
              >
                Date Range
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, tempMode === 'single' && styles.modeTabActive]}
              onPress={() => setTempMode('single')}
            >
              <Text
                style={[
                  styles.modeTabText,
                  tempMode === 'single' && styles.modeTabTextActive,
                ]}
              >
                Single Day
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected Range Display Header */}
          <View style={styles.rangeDisplayRow}>
            {tempMode === 'single' ? (
              <View style={styles.rangeBadge}>
                <Text style={styles.rangeBadgeLabel}>SELECTED DATE:</Text>
                <Text style={styles.rangeBadgeVal}>{tempSingleDate || 'Select a day'}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                <View style={[styles.rangeBadge, { flex: 1 }]}>
                  <Text style={styles.rangeBadgeLabel}>FROM:</Text>
                  <Text style={styles.rangeBadgeVal}>{tempCustomFrom || 'Select start'}</Text>
                </View>
                <View style={[styles.rangeBadge, { flex: 1 }]}>
                  <Text style={styles.rangeBadgeLabel}>TO:</Text>
                  <Text style={styles.rangeBadgeVal}>
                    {tempCustomTo || (tempCustomFrom ? 'Select end date' : '---')}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Interactive Calendar Component */}
          <Calendar
            current={tempCustomFrom || new Date().toISOString().split('T')[0]}
            onDayPress={onDayPress}
            markingType={tempMode === 'custom' ? 'period' : 'dot'}
            markedDates={
              tempMode === 'custom'
                ? getRangeMarkedDates()
                : {
                    [tempSingleDate]: {
                      selected: true,
                      selectedColor: tokens.colors.primaryContainer,
                    },
                  }
            }
            theme={{
              backgroundColor: tokens.colors.surfaceCard,
              calendarBackground: tokens.colors.surfaceCard,
              textSectionTitleColor: tokens.colors.secondary,
              selectedDayBackgroundColor: tokens.colors.primaryContainer,
              selectedDayTextColor: '#ffffff',
              todayTextColor: tokens.colors.primaryContainer,
              dayTextColor: tokens.colors.onBackground,
              textDisabledColor: tokens.colors.secondaryFixedDim,
              monthTextColor: tokens.colors.onBackground,
              arrowColor: tokens.colors.primaryContainer,
              textMonthFontWeight: '700',
              textDayFontSize: 13,
              textMonthFontSize: 14,
              textDayHeaderFontSize: 11,
            }}
            style={styles.calendarStyle}
          />

          {/* Actions: Reset & Apply Buttons */}
          <View style={styles.modalActionButtons}>
            <TouchableOpacity
              style={styles.resetModalBtn}
              onPress={() => {
                const todayStr = new Date().toISOString().split('T')[0]
                setTempSingleDate(todayStr)
                setTempCustomFrom(
                  new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
                )
                setTempCustomTo(todayStr)
              }}
            >
              <Text style={styles.resetModalBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.applyModalBtn,
                tempMode === 'custom' && !tempCustomFrom && styles.applyModalBtnDisabled,
              ]}
              disabled={tempMode === 'custom' && !tempCustomFrom}
              onPress={onApply}
            >
              <Text style={styles.applyModalBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
