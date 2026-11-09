import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
import { InlineCreatorModals } from './InlineCreatorModals'
import type { Control, UseFormSetValue, UseFormHandleSubmit } from 'react-hook-form'
import type { Product } from '../../../types'
import type { ProductFormInstance } from '../hooks/useProductForm'

export interface ProductFormModalProps {
  form: ProductFormInstance
  managedCategories: Array<{ id: string; name: string }>
  setNewCatModalOpen: (v: boolean) => void
  managedAttributes: Array<{ id: string; name: string; values?: string[] }>
  setNewAttrModalOpen: (v: boolean) => void
  handleOpenAddCustomValueModal: (attrId: string, attrName: string) => void
  // Inline creator states
  newCatModalOpen: boolean
  inlineCatName: string
  setInlineCatName: (v: string) => void
  inlineCatCode: string
  setInlineCatCode: (v: string) => void
  handleSaveInlineCategory: () => void
  newAttrModalOpen: boolean
  inlineAttrName: string
  setInlineAttrName: (v: string) => void
  inlineAttrValues: string
  setInlineAttrValues: (v: string) => void
  handleSaveInlineAttribute: () => void
  customValueModalOpen: boolean
  setCustomValueModalOpen: (v: boolean) => void
  targetAttrForCustomVal: { id: string; name: string } | null
  customValInput: string
  setCustomValInput: (v: string) => void
  handleConfirmAddCustomValue: () => void
}

export function ProductFormModal({
  form,
  managedCategories,
  setNewCatModalOpen,
  managedAttributes,
  setNewAttrModalOpen,
  handleOpenAddCustomValueModal,
  newCatModalOpen,
  inlineCatName,
  setInlineCatName,
  inlineCatCode,
  setInlineCatCode,
  handleSaveInlineCategory,
  newAttrModalOpen,
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
}: ProductFormModalProps) {
  const {
    productModalOpen,
    setProductModalOpen,
    editingProduct,
    control,
    handleSubmit,
    setValue,
    watch,
    onSubmit,
    isSavingProduct,
    selectedPhotoUri,
    uploadingPhoto,
    uploadProgress,
    handleTakeProductPhoto,
    handlePickProductPhotoFromGallery,
    handleRemoveProductPhoto,
    productType,
    formCategory,
    formIsActive,
    setSimpleBarcodeScannerOpen,
    selectedProductAttributes,
    setSelectedProductAttributes,
    productOptions = [],
    handleAddProductOption,
    handleRemoveProductOption,
    handleToggleProductOptionValue,
    handleSelectAllOptionValues,
    handleClearOptionValues,
    handleToggleAttributeValue,
    handleRemoveAttribute,
    handleRemoveValueFromAttribute,
    handleGenerateMatrix,
    variantsFields,
    handleStartScanVariantBarcode,
    removeVariant,
    handleConfirmRemoveVariant,
    handleBatchApplyStockToAll,
  } = form
  const { height: windowHeight } = useWindowDimensions()
  const sheetHeight = Math.round(windowHeight * 0.90)
  const [activeDropdownAttrId, setActiveDropdownAttrId] = React.useState<string | null>(null)
  const [activeOptionName, setActiveOptionName] = React.useState<string | null>(null)
  const [addOptionPickerOpen, setAddOptionPickerOpen] = React.useState(false)

  const onFormError = (errors: Record<string, { message?: string }>) => {
    const firstKey = Object.keys(errors)[0]
    const msg = errors[firstKey]?.message || 'Please review required fields in product form.'
    Alert.alert('Incomplete Form', msg)
  }

  return (
    <Modal visible={productModalOpen} transparent animationType="slide" onRequestClose={() => setProductModalOpen(false)}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            {
              height: sheetHeight,
              maxHeight: sheetHeight,
              width: '100%',
              paddingBottom: 0,
              overflow: 'hidden',
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'New Product'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={[styles.headerSaveBtn, (isSavingProduct || uploadingPhoto) && { opacity: 0.7 }]}
                onPress={handleSubmit(onSubmit, onFormError)}
                disabled={isSavingProduct || uploadingPhoto}
                activeOpacity={0.8}
                accessibilityLabel="Quick save product"
              >
                {isSavingProduct || uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                )}
                <Text style={styles.headerSaveBtnText}>
                  {isSavingProduct ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setProductModalOpen(false)}
                accessibilityLabel="Close product editor"
              >
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Product Photo Upload Section */}
            <View style={styles.formPhotoCard}>
              <View style={styles.formPhotoHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="image-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.formSectionTitle}>Product Photo</Text>
                </View>
                {Boolean(selectedPhotoUri && !uploadingPhoto) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 10 }}>
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Uploaded</Text>
                  </View>
                )}
              </View>

              <View style={styles.photoUploadRow}>
                {selectedPhotoUri ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image
                      source={{ uri: selectedPhotoUri }}
                      style={styles.photoPreviewImg}
                      contentFit="cover"
                      transition={150}
                    />
                    {!uploadingPhoto && (
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={handleRemoveProductPhoto}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={tokens.colors.outline} />
                    <Text style={styles.photoPlaceholderText}>No photo</Text>
                  </View>
                )}

                <View style={styles.photoBtnCol}>
                  <TouchableOpacity
                    style={styles.photoPickBtn}
                    onPress={handleTakeProductPhoto}
                    activeOpacity={0.8}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons name="camera" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.photoPickBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoPickBtn}
                    onPress={handlePickProductPhotoFromGallery}
                    activeOpacity={0.8}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons name="images" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.photoPickBtnText}>Choose Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Progress Bar & Uploading Indicator */}
              {Boolean(uploadingPhoto) && (
                <View style={{ marginTop: 12, paddingHorizontal: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: tokens.colors.primaryContainer }}>
                        Uploading photo to cloud...
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.colors.primaryContainer }}>
                      {uploadProgress || 15}%
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: tokens.colors.surfaceMuted, borderRadius: 3, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(12, uploadProgress || 15))}%`,
                        backgroundColor: tokens.colors.primaryContainer,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Product Structure Selector: Simple vs Variable */}
            <Text style={styles.formLabel}>Product Type</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[styles.typeChoice, productType === 'SIMPLE' && styles.typeChoiceActive]}
                onPress={() => setValue('productType', 'SIMPLE')}
              >
                <Ionicons
                  name="cube-outline"
                  size={16}
                  color={productType === 'SIMPLE' ? tokens.colors.onPrimary : tokens.colors.secondary}
                />
                <Text style={[styles.typeChoiceText, productType === 'SIMPLE' && styles.typeChoiceTextActive]}>
                  Simple Product
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeChoice, productType === 'VARIABLE' && styles.typeChoiceActive]}
                onPress={() => setValue('productType', 'VARIABLE')}
              >
                <Ionicons
                  name="shirt-outline"
                  size={16}
                  color={productType === 'VARIABLE' ? tokens.colors.onPrimary : tokens.colors.secondary}
                />
                <Text style={[styles.typeChoiceText, productType === 'VARIABLE' && styles.typeChoiceTextActive]}>
                  Variable Product
                </Text>
              </TouchableOpacity>
            </View>

            {/* Base Information */}
            <ControlledInput
              name="name"
              control={control}
              label="Product Name *"
              placeholder={productType === 'VARIABLE' ? 'e.g. Vintage Cotton Graphic Tee' : 'e.g. Anker Fast Charger 65W'}
            />

            {/* Category Selector with inline + New Category */}
            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
              <TouchableOpacity
                style={styles.addCategoryChipBtn}
                onPress={() => setNewCatModalOpen(true)}
              >
                <Ionicons name="add-circle" size={14} color={tokens.colors.onPrimary} />
                <Text style={styles.addCategoryChipBtnText}>+ New Category</Text>
              </TouchableOpacity>

              {managedCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPickChip, formCategory === cat.name && styles.catPickChipActive]}
                  onPress={() => setValue('category', cat.name)}
                >
                  <Text style={[styles.catPickChipText, formCategory === cat.name && styles.catPickChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Product / Master Barcode with 1-Tap Camera Scanner (Shared for Simple & Variable) */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.alignedFormLabel, { marginBottom: 4 }]}>Barcode</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <ControlledInput
                    name="simpleBarcode"
                    control={control}
                    containerStyle={styles.compactFieldContainer}
                    placeholder="Barcode"
                    inputProps={{ style: styles.alignedTextInput }}
                  />
                </View>
                <TouchableOpacity
                  style={styles.scanBarcodeRowBtn}
                  onPress={() => setSimpleBarcodeScannerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="barcode-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.scanBarcodeRowBtnText}>Scan</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Product Options (Dynamic for any merchandise: Color, Material, Size, Flavor) */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.alignedFormLabel}>Product Options</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 6 }}
                  onPress={() => setAddOptionPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={14} color="#2563EB" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>+ Add Option</Text>
                </TouchableOpacity>
              </View>

              {productOptions.length === 0 ? (
                <TouchableOpacity
                  style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', backgroundColor: '#F8FAFC' }}
                  onPress={() => setAddOptionPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>+ Add options (e.g. Color, Material, Flavor, Fit)</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 8 }}>
                  {productOptions.map((opt) => (
                    <View key={opt.name} style={styles.attrCard}>
                      <View style={styles.attrCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="options-outline" size={14} color={tokens.colors.primaryContainer} />
                          <Text style={styles.attrCardTitle}>{opt.name}</Text>
                          <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                            ({opt.values.length} selected)
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveProductOption(opt.name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color={tokens.colors.statusError} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.attrDropdownTrigger}
                        onPress={() => setActiveOptionName(opt.name)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 }}>
                          <Ionicons name="options" size={16} color={tokens.colors.primaryContainer} />
                          <Text
                            style={opt.values.length > 0 ? styles.attrDropdownTriggerText : styles.attrDropdownTriggerPlaceholder}
                            numberOfLines={1}
                          >
                            {opt.values.length > 0
                              ? `${opt.name}: ${opt.values.join(', ')}`
                              : `Select ${opt.name} values...`}
                          </Text>
                        </View>
                        <Ionicons name="chevron-down" size={18} color={tokens.colors.secondary} />
                      </TouchableOpacity>

                      {opt.values.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {opt.values.map((val) => (
                            <View key={val} style={styles.selectedBadge}>
                              <Ionicons name="checkmark-circle" size={13} color={tokens.colors.primaryContainer} />
                              <Text style={styles.selectedBadgeText}>{val}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Base Pricing & Reorder Row */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <ControlledInput
                  name="purchase_price"
                  control={control}
                  label="Base Cost ($)"
                  labelStyle={styles.alignedFormLabel}
                  containerStyle={styles.compactFieldContainer}
                  placeholder="0.00"
                  inputProps={{ keyboardType: 'numeric', style: styles.alignedTextInput }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ControlledInput
                  name="selling_price"
                  control={control}
                  label="Base Price ($) *"
                  labelStyle={styles.alignedFormLabel}
                  containerStyle={styles.compactFieldContainer}
                  placeholder="0.00"
                  inputProps={{ keyboardType: 'numeric', style: styles.alignedTextInput }}
                />
              </View>
              <View style={{ flex: 0.9 }}>
                <ControlledInput
                  name="default_reorder_level"
                  control={control}
                  label="Reorder Alert"
                  labelStyle={styles.alignedFormLabel}
                  containerStyle={styles.compactFieldContainer}
                  placeholder="10"
                  inputProps={{ keyboardType: 'numeric', style: styles.alignedTextInput }}
                />
              </View>
            </View>

            {/* SECTION A: SIMPLE PRODUCT FIELDS */}
            {productType === 'SIMPLE' && (
              <View style={styles.simpleFieldsContainer}>
                <Text style={styles.sectionHeaderInner}>Inventory</Text>

                {/* SKU and Initial Quantity */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1.5 }}>
                    <ControlledInput
                      name="simpleSku"
                      control={control}
                      label="Store SKU (Optional)"
                      labelStyle={styles.alignedFormLabel}
                      containerStyle={styles.compactFieldContainer}
                      placeholder="e.g. CHG-ANK-001"
                      inputProps={{ style: styles.alignedTextInput }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ControlledInput
                      name="simpleStock"
                      control={control}
                      label="Initial Stock"
                      labelStyle={styles.alignedFormLabel}
                      containerStyle={styles.compactFieldContainer}
                      placeholder="0"
                      inputProps={{ keyboardType: 'numeric', style: styles.alignedTextInput }}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* SECTION B: VARIABLE PRODUCT BUILDER */}
            {productType === 'VARIABLE' && (
              <View style={styles.variableBuilderContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={styles.sectionHeaderInner}>Attributes & Options</Text>
                  <TouchableOpacity
                    style={styles.addCategoryChipBtn}
                    onPress={() => setNewAttrModalOpen(true)}
                  >
                    <Ionicons name="add-circle" size={14} color={tokens.colors.onPrimary} />
                    <Text style={styles.addCategoryChipBtnText}>+ New Attribute</Text>
                  </TouchableOpacity>
                </View>

                {/* Available DB Attributes Quick Picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
                  {managedAttributes.map((attr) => {
                    const isAdded = selectedProductAttributes.some((a) => a.id === attr.id)
                    return (
                      <TouchableOpacity
                        key={attr.id}
                        style={[styles.quickAttrChip, isAdded && { backgroundColor: '#E2E8F0' }]}
                        onPress={() => {
                          if (!isAdded) {
                            setSelectedProductAttributes((prev) => [
                              ...prev,
                              {
                                id: attr.id,
                                name: attr.name,
                                selectedValues: attr.values?.slice(0, 2) || [],
                                allValues: attr.values || ['Default'],
                              },
                            ])
                          }
                        }}
                        disabled={isAdded}
                      >
                        <Ionicons
                          name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
                          size={14}
                          color={isAdded ? '#16A34A' : tokens.colors.primaryContainer}
                        />
                        <Text style={[styles.quickAttrChipText, isAdded && { color: '#475569' }]}>
                          {attr.name} {isAdded ? '(Added)' : ''}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>

                {/* Selected Attributes & Values Setup */}
                <View style={{ marginTop: 12, gap: 10 }}>
                  {selectedProductAttributes.length === 0 ? (
                    <View style={styles.emptyAttrPrompt}>
                      <Ionicons name="options-outline" size={24} color={tokens.colors.secondary} />
                      <Text style={{ fontSize: 12, color: tokens.colors.secondary, marginTop: 4, textAlign: 'center' }}>
                        Tap attributes above (e.g. Size, Color) to choose preset values.
                      </Text>
                    </View>
                  ) : (
                    selectedProductAttributes.map((attr) => (
                      <View key={attr.id} style={styles.attrCard}>
                        <View style={styles.attrCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="layers-outline" size={14} color={tokens.colors.primaryContainer} />
                            <Text style={styles.attrCardTitle}>{attr.name}</Text>
                            <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                              ({attr.selectedValues.length} active)
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveAttribute(attr.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={18} color={tokens.colors.statusError} />
                          </TouchableOpacity>
                        </View>

                        {/* Value Selection Dropdown Trigger */}
                        <TouchableOpacity
                          style={styles.attrDropdownTrigger}
                          onPress={() => setActiveDropdownAttrId(attr.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 }}>
                            <Ionicons name="options" size={16} color={tokens.colors.primaryContainer} />
                            <Text
                              style={attr.selectedValues.length > 0 ? styles.attrDropdownTriggerText : styles.attrDropdownTriggerPlaceholder}
                              numberOfLines={1}
                            >
                              {attr.selectedValues.length > 0
                                ? `${attr.name}: ${attr.selectedValues.join(', ')} (${attr.selectedValues.length} selected)`
                                : `Select ${attr.name} options...`}
                            </Text>
                          </View>
                          <Ionicons name="chevron-down" size={18} color={tokens.colors.secondary} />
                        </TouchableOpacity>

                        {/* Read-only selected value badges - no accidental delete buttons */}
                        {attr.selectedValues.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {attr.selectedValues.map((val) => (
                              <View key={val} style={styles.selectedBadge}>
                                <Ionicons name="checkmark-circle" size={13} color={tokens.colors.primaryContainer} />
                                <Text style={styles.selectedBadgeText}>{val}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  )}

                  {/* Configurable Initial Stock per Variant */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="cube-outline" size={14} color={tokens.colors.primaryContainer} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.colors.onBackground }}>
                          Default Stock per Variant
                        </Text>
                      </View>
                    </View>
                    <View style={{ width: 75 }}>
                      <ControlledInput
                        name="variantInitialStock"
                        control={control}
                        containerStyle={styles.compactFieldContainer}
                        placeholder="0"
                        inputProps={{ keyboardType: 'numeric', style: [styles.variantTextInput, { textAlign: 'center', fontWeight: '700' }] }}
                      />
                    </View>
                  </View>

                  {/* Generate Variant Matrix Action */}
                  <TouchableOpacity
                    style={[styles.generateBtn, selectedProductAttributes.length === 0 && { opacity: 0.6 }]}
                    onPress={handleGenerateMatrix}
                    disabled={selectedProductAttributes.length === 0}
                  >
                    <Ionicons name="flash-outline" size={16} color={tokens.colors.onPrimary} />
                    <Text style={styles.generateBtnText}>
                      {variantsFields.length > 0 ? 'Update Variants' : 'Generate Variants'}
                    </Text>
                  </TouchableOpacity>

                  {/* Variant Matrix Table */}
                  {Boolean(variantsFields.length > 0) && (
                    <View style={styles.matrixContainer}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.matrixTitle}>Variants ({variantsFields.length})</Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#EFF6FF',
                            borderColor: '#BFDBFE',
                            borderWidth: 1,
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 6,
                          }}
                          onPress={handleBatchApplyStockToAll}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="copy-outline" size={12} color="#2563EB" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>
                            Apply to All
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {variantsFields.map((v, vIdx) => (
                        <View key={v.id} style={styles.variantRowCard}>
                          <View style={styles.variantRowTop}>
                            <View style={styles.varBadge}>
                              <Ionicons name="pricetag" size={11} color="#B45309" />
                              <Text style={styles.varBadgeText}>{v.name}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleConfirmRemoveVariant(vIdx)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                            </TouchableOpacity>
                          </View>

                          {/* Row 1: Barcode Front & Center with 1-Tap Camera Scan Button */}
                          <View style={{ marginBottom: 8 }}>
                            <Text style={styles.variantFieldLabel}>BARCODE (OPTIONAL)</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ flex: 1 }}>
                                <ControlledInput
                                  name={`variantsList.${vIdx}.barcode`}
                                  control={control}
                                  containerStyle={styles.compactFieldContainer}
                                  placeholder="Barcode"
                                  inputProps={{ style: styles.variantTextInput }}
                                />
                              </View>
                              <TouchableOpacity
                                style={styles.scanBarcodeRowBtn}
                                onPress={() => handleStartScanVariantBarcode(vIdx)}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="barcode-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.scanBarcodeRowBtnText}>Scan</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Row 2: SKU, Stock, Price Override */}
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <View style={{ flex: 1.2 }}>
                              <ControlledInput
                                name={`variantsList.${vIdx}.sku`}
                                control={control}
                                label="SKU"
                                labelStyle={styles.variantFieldLabel}
                                containerStyle={styles.compactFieldContainer}
                                placeholder="SKU"
                                inputProps={{ style: styles.variantTextInput }}
                              />
                            </View>
                            <View style={{ flex: 0.8 }}>
                              <ControlledInput
                                name={`variantsList.${vIdx}.stock`}
                                control={control}
                                label="STOCK"
                                labelStyle={styles.variantFieldLabel}
                                containerStyle={styles.compactFieldContainer}
                                placeholder="0"
                                inputProps={{ keyboardType: 'numeric', style: [styles.variantTextInput, { textAlign: 'center' }] }}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <ControlledInput
                                name={`variantsList.${vIdx}.priceOverride`}
                                control={control}
                                label="PRICE ($)"
                                labelStyle={styles.variantFieldLabel}
                                containerStyle={styles.compactFieldContainer}
                                placeholder="Base"
                                inputProps={{ keyboardType: 'numeric', style: styles.variantTextInput }}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

          </ScrollView>

          {/* Sticky Bottom Action Bar — Always accessible without scrolling */}
          <View style={styles.formFooterBar}>
            <View style={styles.formFooterSwitchRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={formIsActive ? 'eye-outline' : 'eye-off-outline'}
                  size={15}
                  color={formIsActive ? tokens.colors.primaryContainer : tokens.colors.secondary}
                />
                <Text style={styles.switchLabel}>Active in POS Catalog</Text>
              </View>
              <Switch
                value={formIsActive}
                onValueChange={(val) => setValue('is_active', val)}
                trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
              />
            </View>

            <TouchableOpacity
              style={[styles.formFooterSubmitBtn, (isSavingProduct || uploadingPhoto) && { opacity: 0.75 }]}
              onPress={handleSubmit(onSubmit, onFormError)}
              disabled={isSavingProduct || uploadingPhoto}
              activeOpacity={0.85}
            >
              {isSavingProduct ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  <Text style={styles.submitBtnText}>Saving Product...</Text>
                </View>
              ) : uploadingPhoto ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  <Text style={styles.submitBtnText}>Uploading Photo ({uploadProgress || 15}%)...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>{editingProduct ? 'Save Product Changes' : 'Create Product'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* In-Modal Attribute Value Dropdown Selector */}
          {Boolean(activeDropdownAttrId) && (() => {
            const currentAttr = selectedProductAttributes.find((a) => a.id === activeDropdownAttrId)
            if (!currentAttr) return null
            const allSelected =
              currentAttr.allValues.length > 0 &&
              currentAttr.allValues.every((v) => currentAttr.selectedValues.includes(v))

            return (
              <View style={styles.dialogOverlay}>
                <TouchableOpacity
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  activeOpacity={1}
                  onPress={() => setActiveDropdownAttrId(null)}
                />
                <View style={[styles.dialogCard, { maxHeight: '80%' }]}>
                  {/* Dialog Header */}
                  <View style={styles.dialogHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="shirt-outline" size={18} color={tokens.colors.primaryContainer} />
                      <Text style={styles.dialogTitle}>Select {currentAttr.name} Options</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActiveDropdownAttrId(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={22} color={tokens.colors.secondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Bulk Select Actions */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginVertical: 8,
                      paddingBottom: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>
                      {currentAttr.selectedValues.length} of {currentAttr.allValues.length} selected
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.dropdownQuickBtn}
                        onPress={() => {
                          if (allSelected) {
                            setSelectedProductAttributes((prev) =>
                              prev.map((a) => (a.id === currentAttr.id ? { ...a, selectedValues: [] } : a))
                            )
                          } else {
                            setSelectedProductAttributes((prev) =>
                              prev.map((a) =>
                                a.id === currentAttr.id ? { ...a, selectedValues: [...a.allValues] } : a
                              )
                            )
                          }
                        }}
                      >
                        <Text style={styles.dropdownQuickBtnText}>{allSelected ? 'Clear All' : 'Select All'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dropdownQuickBtn, { backgroundColor: tokens.colors.actionPrimaryBg }]}
                        onPress={() => {
                          const targetId = currentAttr.id
                          const targetName = currentAttr.name
                          setActiveDropdownAttrId(null)
                          handleOpenAddCustomValueModal(targetId, targetName)
                        }}
                      >
                        <Text style={[styles.dropdownQuickBtnText, { color: tokens.colors.primaryContainer }]}>
                          + New Value
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Spacious, Easy-to-Tap Option Rows */}
                  <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={true}>
                    {currentAttr.allValues.map((val) => {
                      const isSelected = currentAttr.selectedValues.includes(val)
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[styles.dropdownOptionRow, isSelected && styles.dropdownOptionRowSelected]}
                          onPress={() => handleToggleAttributeValue(currentAttr.id, val)}
                          activeOpacity={0.6}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={isSelected ? tokens.colors.primaryContainer : '#94A3B8'}
                            />
                            <Text
                              style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}
                            >
                              {val}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>

                  {/* Footer Done Button */}
                  <TouchableOpacity
                    style={[styles.dialogBtn, { marginTop: 12 }]}
                    onPress={() => setActiveDropdownAttrId(null)}
                  >
                    <Text style={styles.dialogBtnText}>
                      Done ({currentAttr.selectedValues.length} Selected)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })()}

          {/* Add Option Picker Modal */}
          {Boolean(addOptionPickerOpen) && (
            <View style={styles.dialogOverlay}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                activeOpacity={1}
                onPress={() => setAddOptionPickerOpen(false)}
              />
              <View style={[styles.dialogCard, { maxHeight: '70%' }]}>
                <View style={styles.dialogHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="add-circle" size={18} color={tokens.colors.primaryContainer} />
                    <Text style={styles.dialogTitle}>Add Product Option</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAddOptionPickerOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={tokens.colors.secondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 300, marginVertical: 8 }} showsVerticalScrollIndicator={true}>
                  {managedAttributes
                    .filter((a) => !productOptions.some((po) => po.name.toLowerCase() === a.name.toLowerCase()))
                    .map((attr) => (
                      <TouchableOpacity
                        key={attr.id}
                        style={styles.dropdownOptionRow}
                        onPress={() => {
                          handleAddProductOption(attr.name)
                          setAddOptionPickerOpen(false)
                          setActiveOptionName(attr.name)
                        }}
                        activeOpacity={0.6}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <Ionicons name="options-outline" size={18} color={tokens.colors.primaryContainer} />
                          <View>
                            <Text style={styles.dropdownOptionText}>{attr.name}</Text>
                            <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                              {attr.values?.length || 0} values in database
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={tokens.colors.secondary} />
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => setAddOptionPickerOpen(false)}
                >
                  <Text style={[styles.dialogBtnText, { color: tokens.colors.secondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Option Values Dropdown Selector */}
          {Boolean(activeOptionName) && (() => {
            const currentOption = productOptions.find((o) => o.name.toLowerCase() === activeOptionName!.toLowerCase())
            const matchingAttr = managedAttributes.find((a) => a.name.toLowerCase() === activeOptionName!.toLowerCase())
            const availableValues = matchingAttr?.values && matchingAttr.values.length > 0
              ? matchingAttr.values
              : currentOption?.values || []
            const selectedVals = currentOption?.values || []
            const allSelected = availableValues.length > 0 && availableValues.every((v) => selectedVals.includes(v))

            return (
              <View style={styles.dialogOverlay}>
                <TouchableOpacity
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  activeOpacity={1}
                  onPress={() => setActiveOptionName(null)}
                />
                <View style={[styles.dialogCard, { maxHeight: '80%' }]}>
                  {/* Dialog Header */}
                  <View style={styles.dialogHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="options" size={18} color={tokens.colors.primaryContainer} />
                      <Text style={styles.dialogTitle}>Select {activeOptionName} Options</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActiveOptionName(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={22} color={tokens.colors.secondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Bulk Select Actions */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginVertical: 8,
                      paddingBottom: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>
                      {selectedVals.length} of {availableValues.length} selected
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.dropdownQuickBtn}
                        onPress={() => {
                          if (allSelected) {
                            handleClearOptionValues(activeOptionName!)
                          } else {
                            handleSelectAllOptionValues(activeOptionName!, availableValues)
                          }
                        }}
                      >
                        <Text style={styles.dropdownQuickBtnText}>
                          {allSelected ? 'Clear All' : 'Select All'}
                        </Text>
                      </TouchableOpacity>
                      {Boolean(matchingAttr) && (
                        <TouchableOpacity
                          style={[styles.dropdownQuickBtn, { backgroundColor: tokens.colors.actionPrimaryBg }]}
                          onPress={() => {
                            const targetId = matchingAttr!.id
                            const targetName = matchingAttr!.name
                            setActiveOptionName(null)
                            handleOpenAddCustomValueModal(targetId, targetName)
                          }}
                        >
                          <Text style={[styles.dropdownQuickBtnText, { color: tokens.colors.primaryContainer }]}>
                            + New Value
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Value Rows with Checkboxes */}
                  <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={true}>
                    {availableValues.map((v) => {
                      const isSelected = selectedVals.includes(v)
                      return (
                        <TouchableOpacity
                          key={v}
                          style={[styles.dropdownOptionRow, isSelected && styles.dropdownOptionRowSelected]}
                          onPress={() => handleToggleProductOptionValue(activeOptionName!, v)}
                          activeOpacity={0.6}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={isSelected ? tokens.colors.primaryContainer : '#94A3B8'}
                            />
                            <Text
                              style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}
                            >
                              {v}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>

                  {/* Footer Done Button */}
                  <TouchableOpacity
                    style={[styles.dialogBtn, { marginTop: 12 }]}
                    onPress={() => setActiveOptionName(null)}
                  >
                    <Text style={styles.dialogBtnText}>
                      Done ({selectedVals.length} Selected)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })()}

          {/* In-Modal Inline Creator Overlays */}
          <InlineCreatorModals
            newCatModalOpen={newCatModalOpen}
            setNewCatModalOpen={setNewCatModalOpen}
            inlineCatName={inlineCatName}
            setInlineCatName={setInlineCatName}
            inlineCatCode={inlineCatCode}
            setInlineCatCode={setInlineCatCode}
            handleSaveInlineCategory={handleSaveInlineCategory}
            newAttrModalOpen={newAttrModalOpen}
            setNewAttrModalOpen={setNewAttrModalOpen}
            inlineAttrName={inlineAttrName}
            setInlineAttrName={setInlineAttrName}
            inlineAttrValues={inlineAttrValues}
            setInlineAttrValues={setInlineAttrValues}
            handleSaveInlineAttribute={handleSaveInlineAttribute}
            customValueModalOpen={customValueModalOpen}
            setCustomValueModalOpen={setCustomValueModalOpen}
            targetAttrForCustomVal={targetAttrForCustomVal}
            customValInput={customValInput}
            setCustomValInput={setCustomValInput}
            handleConfirmAddCustomValue={handleConfirmAddCustomValue}
          />
        </View>
      </View>
    </Modal>
  )
}
