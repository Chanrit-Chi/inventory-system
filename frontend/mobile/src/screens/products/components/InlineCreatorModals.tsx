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
  if (!newCatModalOpen && !newAttrModalOpen && !customValueModalOpen) {
    return null
  }

  return (
    <>
      {/* Inline New Category Creator */}
      {Boolean(newCatModalOpen) && (
        <View style={styles.dialogOverlay}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setNewCatModalOpen(false)}
          />
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
              placeholderTextColor={tokens.colors.textMuted}
              value={inlineCatName}
              onChangeText={setInlineCatName}
            />

            <Text style={styles.formLabel}>Short Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. FTW, HDW"
              placeholderTextColor={tokens.colors.textMuted}
              value={inlineCatCode}
              onChangeText={setInlineCatCode}
            />

            <TouchableOpacity style={styles.dialogBtn} onPress={handleSaveInlineCategory}>
              <Text style={styles.dialogBtnText}>Create & Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Inline New Attribute Creator */}
      {Boolean(newAttrModalOpen) && (
        <View style={styles.dialogOverlay}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setNewAttrModalOpen(false)}
          />
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
              placeholderTextColor={tokens.colors.textMuted}
              value={inlineAttrName}
              onChangeText={setInlineAttrName}
            />

            <Text style={styles.formLabel}>Preset Values * (Comma-separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. S, M, L, XL or Black, White"
              placeholderTextColor={tokens.colors.textMuted}
              value={inlineAttrValues}
              onChangeText={setInlineAttrValues}
            />

            <TouchableOpacity style={styles.dialogBtn} onPress={handleSaveInlineAttribute}>
              <Text style={styles.dialogBtnText}>Save Attribute</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom Attribute Value Creator */}
      {Boolean(customValueModalOpen) && (
        <View style={styles.dialogOverlay}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setCustomValueModalOpen(false)}
          />
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add Value to {targetAttrForCustomVal?.name || 'Attribute'}</Text>
              <TouchableOpacity onPress={() => setCustomValueModalOpen(false)}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Value Name *</Text>
            {(() => {
              const attrNameLower = targetAttrForCustomVal?.name?.toLowerCase() || ''
              let placeholderText = 'e.g. Value Name'
              if (attrNameLower.includes('size')) {
                placeholderText = 'e.g. 5XL, 6XL, 38W, 40L'
              } else if (attrNameLower.includes('color') || attrNameLower.includes('colour')) {
                placeholderText = 'e.g. Burgundy, Olive Green, Coral'
              } else if (attrNameLower.includes('storage') || attrNameLower.includes('capacity')) {
                placeholderText = 'e.g. 512GB, 1TB, 2TB'
              } else if (attrNameLower.includes('material')) {
                placeholderText = 'e.g. Cotton, Linen, Polyester'
              } else {
                placeholderText = 'e.g. Option Value'
              }
              return (
                <TextInput
                  style={styles.input}
                  placeholder={placeholderText}
                  placeholderTextColor={tokens.colors.textDisabled}
                  value={customValInput}
                  onChangeText={setCustomValInput}
                  autoFocus
                  onSubmitEditing={handleConfirmAddCustomValue}
                />
              )
            })()}

            <TouchableOpacity style={styles.dialogBtn} onPress={handleConfirmAddCustomValue}>
              <Text style={styles.dialogBtnText}>+ Add to Options</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  )
}
