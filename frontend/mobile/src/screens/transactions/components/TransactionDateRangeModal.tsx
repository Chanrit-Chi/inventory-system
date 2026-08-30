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
import { styles } from '../TransactionsScreen.styles'

export interface TransactionDateRangeModalProps {
  visible: boolean
  tempMode: 'single' | 'custom'
  setTempMode: (mode: 'single' | 'custom') => void
  tempSingleDate: string
  setTempSingleDate: (date: string) => void
  tempCustomFrom: string
  setTempCustomFrom: (date: string) => void
  tempCustomTo: string
  setTempCustomTo: (date: string) => void
  onClose: () => void
  onApplySingleDate: () => void
  onApplyCustomRange: () => void
}

function getPastDateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

export const TransactionDateRangeModal: React.FC<TransactionDateRangeModalProps> = ({
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
}) => {
  const handleRangeDayPress = (day: { dateString: string }) => {
    const dStr = day.dateString
    if (!tempCustomFrom || (tempCustomFrom && tempCustomTo)) {
      setTempCustomFrom(dStr)
      setTempCustomTo('')
    } else if (tempCustomFrom && !tempCustomTo) {
      if (dStr < tempCustomFrom) {
        setTempCustomTo(tempCustomFrom)
        setTempCustomFrom(dStr)
      } else {
        setTempCustomTo(dStr)
      }
    }
  }

  const getRangeMarkedDates = () => {
    const marks: Record<string, { startingDay?: boolean; endingDay?: boolean; color?: string; textColor?: string; disableTouchEvent?: boolean }> = {}
    if (tempCustomFrom) {
      marks[tempCustomFrom] = {
        startingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: tokens.colors.onPrimary,
      }
    }
    if (tempCustomTo && tempCustomFrom && tempCustomTo > tempCustomFrom) {
      marks[tempCustomTo] = {
        endingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: tokens.colors.onPrimary,
      }
      let curr = new Date(tempCustomFrom)
      const end = new Date(tempCustomTo)
      curr.setDate(curr.getDate() + 1)
      while (curr < end) {
        const s = curr.toISOString().split('T')[0]
        marks[s] = {
          color: tokens.colors.actionPrimaryBg,
          textColor: tokens.colors.primary,
        }
        curr.setDate(curr.getDate() + 1)
      }
    }
    return marks
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter by Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={tokens.colors.onBackground} />
            </TouchableOpacity>
          </View>

          {/* Segmented Control for Single vs Range */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                tempMode === 'single' && styles.segmentBtnActive,
              ]}
              onPress={() => setTempMode('single')}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  tempMode === 'single' && styles.segmentBtnTextActive,
                ]}
              >
                Single Date
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                tempMode === 'custom' && styles.segmentBtnActive,
              ]}
              onPress={() => setTempMode('custom')}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  tempMode === 'custom' && styles.segmentBtnTextActive,
                ]}
              >
                Date Range
              </Text>
            </TouchableOpacity>
          </View>

          {tempMode === 'single' ? (
            <View>
              <Text style={styles.modalSubtitle}>Choose a preset or tap a date:</Text>
              <View style={styles.quickPresetsGrid}>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    tempSingleDate === getPastDateStr(0) && styles.presetChipActive,
                  ]}
                  onPress={() => setTempSingleDate(getPastDateStr(0))}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      tempSingleDate === getPastDateStr(0) && styles.presetChipTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    tempSingleDate === getPastDateStr(1) && styles.presetChipActive,
                  ]}
                  onPress={() => setTempSingleDate(getPastDateStr(1))}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      tempSingleDate === getPastDateStr(1) && styles.presetChipTextActive,
                    ]}
                  >
                    Yesterday
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    tempSingleDate === getPastDateStr(2) && styles.presetChipActive,
                  ]}
                  onPress={() => setTempSingleDate(getPastDateStr(2))}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      tempSingleDate === getPastDateStr(2) && styles.presetChipTextActive,
                    ]}
                  >
                    2 Days Ago
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.calendarContainer}>
                <Calendar
                  current={tempSingleDate}
                  onDayPress={(day: { dateString: string }) => setTempSingleDate(day.dateString)}
                  markedDates={{
                    [tempSingleDate]: {
                      selected: true,
                      disableTouchEvent: true,
                      selectedColor: tokens.colors.primaryContainer,
                    },
                  }}
                  theme={{
                    todayTextColor: tokens.colors.primaryContainer,
                    arrowColor: tokens.colors.primaryContainer,
                    textDayFontSize: 13,
                    textMonthFontSize: 13,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.modalSubtitle}>Tap start date and end date:</Text>
              <View style={styles.quickPresetsGrid}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempCustomFrom(getPastDateStr(6))
                    setTempCustomTo(getPastDateStr(0))
                  }}
                >
                  <Text style={styles.presetChipText}>Last 7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempCustomFrom(getPastDateStr(13))
                    setTempCustomTo(getPastDateStr(0))
                  }}
                >
                  <Text style={styles.presetChipText}>Last 14 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempCustomFrom(getPastDateStr(29))
                    setTempCustomTo(getPastDateStr(0))
                  }}
                >
                  <Text style={styles.presetChipText}>Last 30 Days</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.calendarContainer}>
                <Calendar
                  current={tempCustomTo || tempCustomFrom || undefined}
                  onDayPress={handleRangeDayPress}
                  markingType={'period'}
                  markedDates={getRangeMarkedDates()}
                  theme={{
                    todayTextColor: tokens.colors.primaryContainer,
                    arrowColor: tokens.colors.primaryContainer,
                    textDayFontSize: 13,
                    textMonthFontSize: 13,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>
            </View>
          )}

          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalApplyBtn}
              onPress={() => {
                if (tempMode === 'single') onApplySingleDate()
                else onApplyCustomRange()
              }}
            >
              <Text style={styles.modalApplyBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
