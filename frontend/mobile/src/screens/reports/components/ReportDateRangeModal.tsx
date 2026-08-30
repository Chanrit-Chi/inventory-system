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
import { styles } from '../ReportsScreen.styles'
import { getPastDateStr } from '../reportUtils'

export interface ReportDateRangeModalProps {
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

export const ReportDateRangeModal: React.FC<ReportDateRangeModalProps> = ({
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
            <Text style={styles.modalTitle}>Custom Filter</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={tokens.colors.onBackground} />
            </TouchableOpacity>
          </View>

          {/* Segmented Control */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: tokens.colors.surfaceMuted,
              borderRadius: tokens.borderRadius.sm,
              padding: 4,
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 6,
                alignItems: 'center',
                borderRadius: tokens.borderRadius.sm,
                backgroundColor:
                  tempMode === 'single' ? tokens.colors.surfaceCard : 'transparent',
                ...(tempMode === 'single' ? tokens.shadows.card : {}),
              }}
              onPress={() => setTempMode('single')}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: tempMode === 'single' ? '700' : '500',
                  color:
                    tempMode === 'single'
                      ? tokens.colors.primaryContainer
                      : tokens.colors.secondary,
                }}
              >
                Single Date
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 6,
                alignItems: 'center',
                borderRadius: tokens.borderRadius.sm,
                backgroundColor:
                  tempMode === 'custom' ? tokens.colors.surfaceCard : 'transparent',
                ...(tempMode === 'custom' ? tokens.shadows.card : {}),
              }}
              onPress={() => setTempMode('custom')}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: tempMode === 'custom' ? '700' : '500',
                  color:
                    tempMode === 'custom'
                      ? tokens.colors.primaryContainer
                      : tokens.colors.secondary,
                }}
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
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: tokens.colors.borderSubtle,
                }}
              >
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
                    setTempCustomFrom(getPastDateStr(7))
                    setTempCustomTo(getPastDateStr(0))
                  }}
                >
                  <Text style={styles.presetChipText}>Last 7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempCustomFrom(getPastDateStr(14))
                    setTempCustomTo(getPastDateStr(0))
                  }}
                >
                  <Text style={styles.presetChipText}>Last 14 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempCustomFrom(getPastDateStr(30))
                    setTempCustomTo(getPastDateStr(0))
                  }}
                >
                  <Text style={styles.presetChipText}>Last 30 Days</Text>
                </TouchableOpacity>
              </View>
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: tokens.colors.borderSubtle,
                }}
              >
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
