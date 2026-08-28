import React from 'react'
import { View, Text, TextInput, Modal, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'

interface InlineCreatorModalsProps {
  // Category creator
  newCatModalOpen: boolean
  setNewCatModalOpen: (v: boolean) => void
  inlineCatName: string
  setInlineCatName: (v: string) => void
  inlineCatCode: string
  setInlineCatCode: (v: string) => void
  handleSaveInlineCategory: () => void
  // Attribute creator
  newAttrModalOpen: boolean
  setNewAttrModalOpen: (v: boolean) => void
  inlineAttrName: string
  setInlineAttrName: (v: string) => void
  inlineAttrValues: string
  setInlineAttrValues: (v: string) => void
  handleSaveInlineAttribute: () => void
  // Custom value creator
  customValueModalOpen: boolean
  setCustomValueModalOpen: (v: boolean) => void
  targetAttrForCustomVal: { id: string; name: string } | null
  customValInput: string
  setCustomValInput: (v: string) => void
  handleConfirmAddCustomValue: () => void
}

export function InlineCreatorModals({
  newCatModalOpen,
  setNewCatModalOpen,
  inlineCatName,
  setInlineCatName,
  inlineCatCode,
  setInlineCatCode,
  handleSaveInlineCategory,
  newAttrModalOpen,
  setNewAttrModalOpen,
  inlineAttrName,
  setInlineAttrName,
  inlineAttrValues,
  setInlineAttrValues,
  handleSaveInlineAttribute,
  customValueModalOpen,
  setCustomValueModalOpen,
  targetAttrForCustomVal,
  customValInput,
  setCustomValInput,
  handleConfirmAddCustomValue,
}: InlineCreatorModalsProps) {
  return (
    <>      {/* Inline New Category Creator Modal */}
      <Modal visible={newCatModalOpen} transparent animationType="fade" onRequestClose={() => setNewCatModalOpen(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add New Category</Text>
              <TouchableOpacity onPress={() => setNewCatModalOpen(false)}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Category Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Footwear, Headwear"
              value={inlineCatName}
              onChangeText={setInlineCatName}
            />

            <Text style={styles.formLabel}>Short Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. FTW, HDW"
              value={inlineCatCode}
              onChangeText={setInlineCatCode}
            />

            <TouchableOpacity style={styles.dialogBtn} onPress={handleSaveInlineCategory}>
              <Text style={styles.dialogBtnText}>Create & Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Inline New Attribute Creator Modal */}
      <Modal visible={newAttrModalOpen} transparent animationType="fade" onRequestClose={() => setNewAttrModalOpen(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add New Attribute</Text>
              <TouchableOpacity onPress={() => setNewAttrModalOpen(false)}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Attribute Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Material, Storage, Waist"
              value={inlineAttrName}
              onChangeText={setInlineAttrName}
            />

            <Text style={styles.formLabel}>Preset Values * (Comma-separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. S, M, L, XL or Black, White"
              value={inlineAttrValues}
              onChangeText={setInlineAttrValues}
            />

            <TouchableOpacity style={styles.dialogBtn} onPress={handleSaveInlineAttribute}>
              <Text style={styles.dialogBtnText}>Save Attribute</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Attribute Value Creator Modal */}
      <Modal
        visible={customValueModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomValueModalOpen(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add Value to {targetAttrForCustomVal?.name || 'Attribute'}</Text>
              <TouchableOpacity onPress={() => setCustomValueModalOpen(false)}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Value Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 3XL, Heather Grey, 1TB, Titanium"
              placeholderTextColor={tokens.colors.textDisabled}
              value={customValInput}
              onChangeText={setCustomValInput}
              autoFocus
              onSubmitEditing={handleConfirmAddCustomValue}
            />

            <TouchableOpacity style={styles.dialogBtn} onPress={handleConfirmAddCustomValue}>
              <Text style={styles.dialogBtnText}>+ Add to Options</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </>
  )
}
