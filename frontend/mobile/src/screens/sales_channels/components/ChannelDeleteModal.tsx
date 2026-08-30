import React from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SalesChannelsScreen.styles'
import type { SalesChannel } from '../../../types'

export interface ChannelDeleteModalProps {
  channel: SalesChannel | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: (channel: SalesChannel) => void
}

export const ChannelDeleteModal: React.FC<ChannelDeleteModalProps> = ({
  channel,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal
      visible={Boolean(channel)}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={styles.deleteModalContent}>
          <View style={styles.deleteModalIconBox}>
            <Ionicons name="trash-outline" size={26} color={tokens.colors.statusError} />
          </View>
          <Text style={styles.deleteModalTitle}>Delete Sales Channel</Text>
          <Text style={styles.deleteModalMessage}>
            Are you sure you want to delete{' '}
            <Text style={{ fontWeight: '700', color: tokens.colors.onBackground }}>
              "{channel?.name}"
            </Text>
            ?
          </Text>
          <Text style={styles.deleteModalNote}>
            Note: If this channel has existing sales history, it will be safely deactivated instead of permanently deleted.
          </Text>

          <View style={styles.deleteModalActions}>
            <TouchableOpacity
              style={styles.deleteModalCancelBtn}
              onPress={onClose}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteModalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-confirm-delete-channel"
              style={styles.deleteModalConfirmBtn}
              onPress={() => channel && onConfirm(channel)}
              disabled={isDeleting}
              activeOpacity={0.85}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash" size={15} color="#FFFFFF" />
                  <Text style={styles.deleteModalConfirmText}>Delete Channel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
