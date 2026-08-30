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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
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
}

export function ProductFormModal({
  form,
  managedCategories,
  setNewCatModalOpen,
  managedAttributes,
  setNewAttrModalOpen,
  handleOpenAddCustomValueModal,
}: ProductFormModalProps) {
  const {
    productModalOpen,
    setProductModalOpen,
    editingProduct,
    control,
    handleSubmit,
    setValue,
    onSubmit,
    isSavingProduct,
    selectedPhotoUri,
    uploadingPhoto,
    handleTakeProductPhoto,
    handlePickProductPhotoFromGallery,
    handleRemoveProductPhoto,
    productType,
    formCategory,
    formIsActive,
    setSimpleBarcodeScannerOpen,
    selectedProductAttributes,
    setSelectedProductAttributes,
    handleToggleAttributeValue,
    handleRemoveAttribute,
    handleGenerateMatrix,
    variantsFields,
    handleStartScanVariantBarcode,
    removeVariant,
  } = form
  const onFormError = (errors: Record<string, { message?: string }>) => {
    const firstKey = Object.keys(errors)[0]
    const msg = errors[firstKey]?.message || 'Please review required fields in product form.'
    Alert.alert('Incomplete Form', msg)
  }

  return (
    <Modal visible={productModalOpen} transparent animationType="slide" onRequestClose={() => setProductModalOpen(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'New Product'}</Text>
            <TouchableOpacity onPress={() => setProductModalOpen(false)}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            {/* Product Photo Upload Section */}
            <View style={styles.formPhotoCard}>
              <View style={styles.formPhotoHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="image-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.formSectionTitle}>Product Photo</Text>
                </View>
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
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={handleRemoveProductPhoto}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                    </TouchableOpacity>
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
                  >
                    <Ionicons name="camera" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.photoPickBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoPickBtn}
                    onPress={handlePickProductPhotoFromGallery}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.photoPickBtnText}>Choose Gallery</Text>
                  </TouchableOpacity>

                  {Boolean(uploadingPhoto) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                      <Text style={{ fontSize: 10.5, color: tokens.colors.secondary }}>Uploading photo...</Text>
                    </View>
                  )}
                </View>
              </View>
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
                <Text style={styles.sectionHeaderInner}>Simple Inventory Details</Text>
                
                {/* Supplier Barcode with 1-Tap Camera Scanner */}
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.alignedFormLabel}>Supplier Barcode (Physical)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <ControlledInput
                        name="simpleBarcode"
                        control={control}
                        containerStyle={styles.compactFieldContainer}
                        placeholder="Scan or enter manufacturer barcode"
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
                      placeholder="10"
                      inputProps={{ keyboardType: 'numeric', style: styles.alignedTextInput }}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* SECTION B: VARIABLE PRODUCT BUILDER */}
            {productType === 'VARIABLE' && (
              <View style={styles.variableBuilderContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.sectionHeaderInner}>Variant Attribute Matrix</Text>
                  <TouchableOpacity
                    style={styles.addCategoryChipBtn}
                    onPress={() => setNewAttrModalOpen(true)}
                  >
                    <Ionicons name="add-circle" size={14} color={tokens.colors.onPrimary} />
                    <Text style={styles.addCategoryChipBtnText}>+ New Attribute</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginBottom: 10 }}>
                  Choose attributes from the database, then tap values to generate combinations.
                </Text>

                {/* Available DB Attributes Quick Picker */}
                <Text style={styles.formLabel}>Available Database Attributes:</Text>
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

                        {/* Value Selection Chips */}
                        <View style={styles.valChipsWrapper}>
                          {attr.allValues.map((val) => {
                            const isSelected = attr.selectedValues.includes(val)
                            return (
                              <TouchableOpacity
                                key={val}
                                style={[styles.valChip, isSelected && styles.valChipSelected]}
                                onPress={() => handleToggleAttributeValue(attr.id, val)}
                              >
                                {Boolean(isSelected) && (
                                  <Ionicons
                                    name="checkmark"
                                    size={11}
                                    color="#FFFFFF"
                                    style={{ marginRight: 3 }}
                                  />
                                )}
                                <Text style={[styles.valChipText, isSelected && styles.valChipTextSelected]}>
                                  {val}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                          <TouchableOpacity
                            style={styles.valChipAdd}
                            onPress={() => handleOpenAddCustomValueModal(attr.id, attr.name)}
                          >
                            <Ionicons name="add" size={12} color={tokens.colors.primaryContainer} />
                            <Text style={styles.valChipAddText}>Add Value</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}

                  {/* Generate Variant Matrix Action */}
                  <TouchableOpacity
                    style={[styles.generateBtn, selectedProductAttributes.length === 0 && { opacity: 0.6 }]}
                    onPress={handleGenerateMatrix}
                    disabled={selectedProductAttributes.length === 0}
                  >
                    <Ionicons name="flash-outline" size={16} color={tokens.colors.onPrimary} />
                    <Text style={styles.generateBtnText}>Generate Variant Combinations</Text>
                  </TouchableOpacity>

                  {/* Variant Matrix Table */}
                  {Boolean(variantsFields.length > 0) && (
                    <View style={styles.matrixContainer}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View>
                          <Text style={styles.matrixTitle}>Variant Combinations ({variantsFields.length})</Text>
                          <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                            Scan supplier barcodes or edit inventory
                          </Text>
                        </View>
                      </View>

                      {variantsFields.map((v, vIdx) => (
                        <View key={v.id} style={styles.variantRowCard}>
                          <View style={styles.variantRowTop}>
                            <View style={styles.varBadge}>
                              <Ionicons name="pricetag" size={11} color="#B45309" />
                              <Text style={styles.varBadgeText}>{v.name}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => removeVariant(vIdx)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                            </TouchableOpacity>
                          </View>

                          {/* Row 1: Barcode Front & Center with 1-Tap Camera Scan Button */}
                          <View style={{ marginBottom: 8 }}>
                            <Text style={styles.variantFieldLabel}>SUPPLIER BARCODE</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ flex: 1 }}>
                                <ControlledInput
                                  name={`variantsList.${vIdx}.barcode`}
                                  control={control}
                                  containerStyle={styles.compactFieldContainer}
                                  placeholder="Scan or type supplier barcode"
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
                                placeholder="10"
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

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active in POS Catalog</Text>
              <Switch
                value={formIsActive}
                onValueChange={(val) => setValue('is_active', val)}
                trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isSavingProduct && { opacity: 0.7 }]}
              onPress={handleSubmit(onSubmit, onFormError)}
              disabled={isSavingProduct}
              activeOpacity={0.85}
            >
              {isSavingProduct ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  <Text style={styles.submitBtnText}>Saving Product...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>{editingProduct ? 'Save Product Changes' : 'Create Product'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
