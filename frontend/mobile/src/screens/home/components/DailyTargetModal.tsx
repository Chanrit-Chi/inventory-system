import React from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../HomeScreen.styles'

export interface DailyTargetModalProps {
  visible: boolean
  dailyTarget: number
  targetInput: string
  setTargetInput: (v: string) => void
  onClose: () => void
  onSaveTarget: (target: number) => void
}

const TARGET_PRESETS = [1000, 2500, 5000, 10000]

export const DailyTargetModal: React.FC<DailyTargetModalProps> = ({
  visible,
  dailyTarget,
  targetInput,
  setTargetInput,
  onClose,
  onSaveTarget,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.targetModalOverlay}>
        <View style={styles.targetModalContent}>
          <View style={styles.targetModalHeader}>
            <View>
              <Text style={styles.targetModalTitle}>Customize Daily Target</Text>
              <Text style={styles.targetModalSub}>Set store revenue goal for today</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Presets */}
          <Text style={styles.targetPresetLabel}>QUICK PRESETS</Text>
          <View style={styles.targetPresetsRow}>
            {TARGET_PRESETS.map((amt) => {
              const isSelected = dailyTarget === amt
              return (
                <TouchableOpacity
                  key={amt}
                  style={[styles.targetPresetChip, isSelected && styles.targetPresetChipActive]}
                  onPress={() => {
                    setTargetInput(String(amt))
                    onSaveTarget(amt)
                  }}
                >
                  <Text
                    style={[
                      styles.targetPresetText,
                      isSelected && styles.targetPresetTextActive,
                    ]}
                  >
                    ${amt.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Custom Input */}
          <Text style={[styles.targetPresetLabel, { marginTop: 12 }]}>
            CUSTOM TARGET AMOUNT ($)
          </Text>
          <View style={styles.targetInputRow}>
            <Text style={styles.targetDollarSign}>$</Text>
            <TextInput
              style={styles.targetInputField}
              keyboardType="numeric"
              value={targetInput}
              onChangeText={setTargetInput}
              placeholder="e.g. 3500"
              placeholderTextColor={tokens.colors.secondary}
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity
            style={styles.targetSaveBtn}
            onPress={() => {
              const parsed = parseFloat(targetInput)
              if (!isNaN(parsed) && parsed > 0) {
                onSaveTarget(parsed)
              }
            }}
          >
            <Text style={styles.targetSaveBtnText}>Save Target</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
