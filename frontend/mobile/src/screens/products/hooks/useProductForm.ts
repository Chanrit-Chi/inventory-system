import { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { compressProductImage } from '../../../utils/imageCompressor'
import { queryKeys } from '../../../api/queryKeys'
import { productSchema, ProductFormValues } from '../../../utils/validation'
import { createProduct, updateProduct, uploadMedia } from '../../../api/endpoints'
import type { Product, ProductVariant, ScannedAttributeValue, ApiResponse } from '../../../types'

export interface VariantDraft {
  id: string
  name: string
  sku: string
  barcode: string
  stock: number
  priceOverride: string
  costOverride: string
  attribute_values: ScannedAttributeValue[]
}

export interface SelectedProductAttribute {
  id: string
  name: string
  selectedValues: string[]
  allValues: string[]
}

export interface UseProductFormProps {
  products: Product[]
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>
  detailProduct: Product | null
  setDetailProduct: React.Dispatch<React.SetStateAction<Product | null>>
  loadProducts: () => void
  managedCategories: Array<{ id: string; name: string; code?: string }>
}

export type ProductFormInstance = ReturnType<typeof useProductForm>

export function useProductForm({
  products,
  setProducts,
  detailProduct,
  setDetailProduct,
  loadProducts,
  managedCategories,
}: UseProductFormProps) {
  const queryClient = useQueryClient()
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const { control, handleSubmit, reset, watch, setValue, getValues } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productType: 'VARIABLE',
      name: '',
      category: 'Apparel',
      purchase_price: '',
      selling_price: '',
      default_reorder_level: '10',
      is_active: true,
      image_url: '',
      simpleSku: '',
      simpleBarcode: '',
      simpleStock: '10',
      attributesList: [
        { id: 'attr-1', name: 'Color', valuesText: 'Black, White' },
        { id: 'attr-2', name: 'Size', valuesText: 'M, L, XL' },
      ],
      variantsList: [],
    },
  })

  // Product Photo Upload State
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isSavingProduct, setIsSavingProduct] = useState(false)

  // Interactive Product Attributes Selection State (Selected from DB)
  const [selectedProductAttributes, setSelectedProductAttributes] = useState<SelectedProductAttribute[]>([])

  // Barcode Camera Scanner State for Product & Variants
  const [variantScannerOpen, setVariantScannerOpen] = useState(false)
  const [activeScanVariantIndex, setActiveScanVariantIndex] = useState<number | null>(null)
  const [simpleBarcodeScannerOpen, setSimpleBarcodeScannerOpen] = useState(false)

  const { fields: attributesFields, append: appendAttribute, remove: removeAttribute, update: updateAttribute } = useFieldArray({
    control,
    name: 'attributesList',
  })

  const { fields: variantsFields, replace: replaceVariants, remove: removeVariant, update: updateVariant } = useFieldArray({
    control,
    name: 'variantsList',
  })

  const productType = watch('productType')
  const formCategory = watch('category')
  const formIsActive = watch('is_active')
  const formName = watch('name')
  const formSellPrice = watch('selling_price')

  const uploadPhotoImmediately = async (file: { uri: string; name: string; type: string }) => {
    setUploadingPhoto(true)
    setUploadProgress(15)
    try {
      const uploadRes = await uploadMedia(file, 'products', (pct) => {
        setUploadProgress(Math.max(15, Math.min(95, pct)))
      })
      if (uploadRes && uploadRes.data?.url) {
        setUploadProgress(100)
        setUploadedImageUrl(uploadRes.data.url)
        setSelectedPhotoUri(uploadRes.data.url)
      }
    } catch (err: unknown) {
      console.warn('Immediate photo upload failed, keeping local preview:', err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handlePickProductPhotoFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        setSelectedPhotoUri(asset.uri)
        const compressed = await compressProductImage(asset.uri, 1800, 0.85)
        setSelectedPhotoFile(compressed)
        uploadPhotoImmediately(compressed)
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to select image.')
    }
  }

  const handleTakeProductPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to take product photos.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        setSelectedPhotoUri(asset.uri)
        const compressed = await compressProductImage(asset.uri, 1800, 0.85)
        setSelectedPhotoFile(compressed)
        uploadPhotoImmediately(compressed)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to capture photo.'
      Alert.alert('Error', msg)
    }
  }

  const handleRemoveProductPhoto = () => {
    setSelectedPhotoUri(null)
    setSelectedPhotoFile(null)
    setUploadedImageUrl(null)
    setUploadProgress(0)
    setUploadingPhoto(false)
  }

  const handleToggleAttributeValue = (attrId: string, value: string) => {
    setSelectedProductAttributes((prev) =>
      prev.map((attr) => {
        if (attr.id === attrId) {
          const isSelected = attr.selectedValues.includes(value)
          const nextSelected = isSelected
            ? attr.selectedValues.filter((v) => v !== value)
            : [...attr.selectedValues, value]
          return { ...attr, selectedValues: nextSelected }
        }
        return attr
      })
    )
  }

  const handleAddCustomValueToAttribute = (attrId: string, customVal: string) => {
    const trimmed = customVal.trim()
    if (!trimmed) return
    setSelectedProductAttributes((prev) =>
      prev.map((attr) => {
        if (attr.id === attrId) {
          const nextAll = attr.allValues.includes(trimmed)
            ? attr.allValues
            : [...attr.allValues, trimmed]
          const nextSelected = attr.selectedValues.includes(trimmed)
            ? attr.selectedValues
            : [...attr.selectedValues, trimmed]
          return { ...attr, allValues: nextAll, selectedValues: nextSelected }
        }
        return attr
      })
    )
  }

  const handleRemoveAttribute = (attrId: string) => {
    setSelectedProductAttributes((prev) => prev.filter((a) => a.id !== attrId))
  }

  // Generate Matrix combinations from database selected attributes
  const handleGenerateMatrix = () => {
    const activeAttrs = selectedProductAttributes.filter((a) => a.selectedValues.length > 0)
    if (activeAttrs.length === 0) {
      Alert.alert(
        'Select Attributes & Values',
        'Please select at least one attribute from the database and tap one or more values to generate variants.'
      )
      return
    }

    const combinations: ScannedAttributeValue[][] = activeAttrs.reduce(
      (acc, attr) => {
        const next: ScannedAttributeValue[][] = []
        acc.forEach((existingComb) => {
          attr.selectedValues.forEach((val) => {
            next.push([
              ...existingComb,
              { id: `av-${attr.name}-${val}`, value_name: val, attribute: { name: attr.name } },
            ])
          })
        })
        return next
      },
      [[]] as ScannedAttributeValue[][]
    )

    const baseSkuPrefix = formName
      ? formName
          .split(' ')
          .map((w) => w.substring(0, 3).toUpperCase())
          .join('-')
      : 'PROD'

    const generated: VariantDraft[] = combinations.map((comb, idx) => {
      const name = comb.map((c) => c.value_name).join(' / ')
      const skuSuffix = comb.map((c) => c.value_name.substring(0, 3).toUpperCase()).join('-')
      const sku = `${baseSkuPrefix}-${skuSuffix}`
      const existingVariant = (editingProduct?.variants || []).find(
        (v) => v.name.toLowerCase() === name.toLowerCase()
      )
      const barcode = existingVariant?.barcode || ''

      return {
        id: existingVariant?.id || `var-new-${idx}-${Date.now()}`,
        name,
        sku,
        barcode,
        stock: existingVariant?.quantity_on_hand ?? 10,
        priceOverride: existingVariant?.selling_price_override || '',
        costOverride: existingVariant?.cost_price_override || '',
        attribute_values: comb,
      }
    })

    replaceVariants(generated)
    Alert.alert(
      'Matrix Generated',
      `Generated ${generated.length} variant combinations from database attributes. You can now scan supplier physical barcodes directly.`
    )
  }

  const handleStartScanVariantBarcode = (vIdx: number) => {
    setActiveScanVariantIndex(vIdx)
    setVariantScannerOpen(true)
  }

  const handleScanCodeForVariant = async (code: string) => {
    if (activeScanVariantIndex !== null && activeScanVariantIndex < variantsFields.length) {
      setValue(`variantsList.${activeScanVariantIndex}.barcode`, code)
      Alert.alert(
        'Barcode Scanned',
        `Assigned barcode "${code}" to variant "${variantsFields[activeScanVariantIndex].name}".`
      )
      setVariantScannerOpen(false)
      setActiveScanVariantIndex(null)
    }
  }

  const handleScanCodeForSimpleProduct = async (code: string) => {
    setValue('simpleBarcode', code)
    Alert.alert('Barcode Scanned', `Assigned barcode "${code}" to product.`)
    setSimpleBarcodeScannerOpen(false)
  }

  const onSubmit = async (data: ProductFormValues) => {
    const buyP = parseFloat(data.purchase_price || '0') || 0
    const sellP = parseFloat(data.selling_price || '0') || 0
    const reorder = parseInt(data.default_reorder_level || '10') || 10

    let finalImageUrl: string | null = null
    if (uploadedImageUrl?.startsWith('http')) {
      finalImageUrl = uploadedImageUrl
    } else if (selectedPhotoUri?.startsWith('http')) {
      finalImageUrl = selectedPhotoUri
    }

    // Fallback if user clicked submit while background upload was still pending
    if (!finalImageUrl && selectedPhotoFile && !uploadingPhoto) {
      try {
        setUploadingPhoto(true)
        const uploadRes = await uploadMedia(selectedPhotoFile, 'products')
        if (uploadRes && uploadRes.data?.url) {
          finalImageUrl = uploadRes.data.url
          setUploadedImageUrl(uploadRes.data.url)
        }
      } catch (err: unknown) {
        console.warn('Fallback image upload failed, proceeding without cloud image:', err)
      } finally {
        setUploadingPhoto(false)
      }
    }

    let finalVariants: ProductVariant[] = []

    if (data.productType === 'SIMPLE') {
      const stock = parseInt(data.simpleStock || '0') || 0
      finalVariants = [
        {
          id: editingProduct?.variants?.[0]?.id || `v-base-${Date.now()}`,
          product_id: editingProduct?.id || `prod-${Date.now()}`,
          name: 'Standard',
          sku: data.simpleSku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          barcode: data.simpleBarcode || null,
          quantity_on_hand: stock,
          is_active: true,
          selling_price: sellP.toString(),
          attribute_values: [],
        },
      ]
    } else {
      if (!data.variantsList || data.variantsList.length === 0) {
        Alert.alert('No Variants', 'Please generate or add at least one variant combination for this variable product.')
        return
      }

      finalVariants = data.variantsList.map((vd) => ({
        id: vd.id || `var-${Math.random().toString(36).slice(2, 8)}`,
        product_id: editingProduct?.id || `prod-${Date.now()}`,
        name: vd.name || 'Standard',
        sku: vd.sku || '',
        barcode: vd.barcode || null,
        quantity_on_hand: vd.stock,
        is_active: true,
        selling_price_override: vd.priceOverride || null,
        selling_price: vd.priceOverride || sellP.toString(),
        cost_price_override: vd.costOverride || null,
        attribute_values: (vd.attribute_values || []).map((av: any) => ({
          id: String(av.id || `av-${av.value_name || av.value || ''}`),
          value_name: String(av.value_name || av.value || ''),
          attribute: av.attribute ? { id: String(av.attribute.id || ''), name: String(av.attribute.name || '') } : undefined,
        })),
      }))
    }

    const mainSku = data.productType === 'SIMPLE' ? (data.simpleSku || '') : finalVariants[0]?.sku || `SKU-VAR-${Date.now()}`
    const mainBarcode = data.productType === 'SIMPLE' ? (data.simpleBarcode || '') : finalVariants[0]?.barcode || null

    const matchedCategory = managedCategories.find(
      (c) => c.name.toLowerCase() === data.category?.toLowerCase() || c.id === data.category
    )

    const variantsPayload = data.productType === 'VARIABLE'
      ? finalVariants.map((v) => ({
          id: v.id && !v.id.startsWith('var-new') && !v.id.startsWith('prod-') && !v.id.startsWith('v-') ? v.id : undefined,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode || null,
          quantity_on_hand: Number(v.quantity_on_hand) || 0,
          stock: Number(v.quantity_on_hand) || 0,
          initial_stock: Number(v.quantity_on_hand) || 0,
          selling_price: Number(v.selling_price) || sellP,
          cost_price: buyP,
          selling_price_override: v.selling_price_override ? Number(v.selling_price_override) : null,
          cost_price_override: v.cost_price_override ? Number(v.cost_price_override) : null,
          attribute_values: v.attribute_values,
        }))
      : undefined

    const simpleStock = data.productType === 'SIMPLE' ? (parseInt(data.simpleStock || '0') || 0) : undefined

    setIsSavingProduct(true)
    try {
      if (editingProduct) {
        const res = await updateProduct(editingProduct.id, {
          name: data.name,
          sku: mainSku,
          barcode: mainBarcode,
          purchase_price: buyP,
          selling_price: sellP,
          default_reorder_level: reorder,
          image_url: finalImageUrl,
          is_active: data.is_active,
          category_id: matchedCategory?.id,
          quantity_on_hand: simpleStock,
          stock: simpleStock,
          variants: variantsPayload,
        })
        const savedProd = res?.data as Product | undefined
        const updated: Product = savedProd && savedProd.id ? savedProd : {
          ...editingProduct,
          name: data.name,
          sku: mainSku,
          barcode: mainBarcode,
          purchase_price: buyP,
          selling_price: sellP,
          default_reorder_level: reorder,
          image_url: finalImageUrl,
          is_active: data.is_active,
          category: (matchedCategory || (data.category ? { id: 'cat-1', name: data.category, code: data.category.substring(0, 3).toUpperCase() } : undefined)) as any,
          variants: finalVariants,
        }

        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)))
        if (detailProduct?.id === editingProduct.id) {
          setDetailProduct(updated)
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
        loadProducts()
        Alert.alert('Product Saved', `Product "${data.name}" updated successfully.`)
      } else {
        const res = await createProduct({
          name: data.name,
          sku: mainSku,
          barcode: mainBarcode,
          purchase_price: buyP,
          selling_price: sellP,
          default_reorder_level: reorder,
          image_url: finalImageUrl,
          is_active: data.is_active,
          category_id: matchedCategory?.id,
          quantity_on_hand: simpleStock,
          stock: simpleStock,
          variants: variantsPayload,
        })
        const createdProd = res?.data as Product | undefined
        if (createdProd && createdProd.id) {
          setProducts((prev) => [createdProd, ...prev.filter((p) => p.id !== createdProd.id)])
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
        loadProducts()
        Alert.alert('Product Created', `New ${data.productType === 'VARIABLE' ? 'Variable' : 'Simple'} product "${data.name}" created.`)
      }

      setProductModalOpen(false)
    } catch (err: unknown) {
      console.warn('Product save error:', err)
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Could not save product changes.')
      loadProducts()
    } finally {
      setIsSavingProduct(false)
    }
  }

  const handleOpenCreateProduct = useCallback(() => {
    setEditingProduct(null)
    setSelectedPhotoUri(null)
    setSelectedPhotoFile(null)
    setUploadedImageUrl(null)
    setUploadProgress(0)
    setUploadingPhoto(false)
    setSelectedProductAttributes([])
    reset({
      productType: 'VARIABLE',
      name: '',
      category: managedCategories[0]?.name || 'Apparel',
      purchase_price: '',
      selling_price: '',
      default_reorder_level: '10',
      is_active: true,
      image_url: '',
      simpleSku: '',
      simpleBarcode: '',
      simpleStock: '10',
      attributesList: [],
      variantsList: [],
    })
    setProductModalOpen(true)
  }, [managedCategories, reset])

  const handleOpenEditProduct = useCallback((prod: Product) => {
    setEditingProduct(prod)
    setSelectedPhotoUri(prod.image_url || null)
    setSelectedPhotoFile(null)
    setUploadedImageUrl(prod.image_url || null)
    setUploadProgress(prod.image_url ? 100 : 0)
    setUploadingPhoto(false)

    const isVar =
      (prod.variants && prod.variants.length > 1) ||
      (prod.variants?.[0]?.attribute_values && prod.variants[0].attribute_values.length > 0)

    const existingAttrsMap: Record<string, { id: string; name: string; selected: Set<string>; all: Set<string> }> = {}

    if (isVar && prod.variants) {
      prod.variants.forEach((v) => {
        v.attribute_values?.forEach((av) => {
          const attrName = av.attribute?.name || 'Option'
          const val = av.value_name || (av as { value?: string }).value || ''
          if (!existingAttrsMap[attrName]) {
            existingAttrsMap[attrName] = {
              id: av.attribute?.id || `attr-${attrName}`,
              name: attrName,
              selected: new Set<string>(),
              all: new Set<string>(),
            }
          }
          if (val) {
            existingAttrsMap[attrName].selected.add(val)
            existingAttrsMap[attrName].all.add(val)
          }
        })
      })
    }

    const rehydratedAttrs: SelectedProductAttribute[] = Object.values(existingAttrsMap).map((item) => ({
      id: item.id,
      name: item.name,
      selectedValues: Array.from(item.selected),
      allValues: Array.from(item.all),
    }))

    setSelectedProductAttributes(rehydratedAttrs)

    const draftVariants: VariantDraft[] = (prod.variants || []).map((v) => ({
      id: v.id,
      name: v.name || 'Standard',
      sku: v.sku,
      barcode: v.barcode || '',
      stock: v.quantity_on_hand ?? 0,
      priceOverride: v.selling_price_override !== null && v.selling_price_override !== undefined ? String(v.selling_price_override) : '',
      costOverride: v.cost_price_override !== null && v.cost_price_override !== undefined ? String(v.cost_price_override) : '',
      attribute_values: v.attribute_values || [],
    }))

    const firstVar = prod.variants?.[0]
    const buyPriceStr = prod.purchase_price !== null && prod.purchase_price !== undefined ? String(prod.purchase_price) : ''
    const sellPriceStr = prod.selling_price !== null && prod.selling_price !== undefined ? String(prod.selling_price) : ''
    const reorderStr = prod.default_reorder_level !== null && prod.default_reorder_level !== undefined ? String(prod.default_reorder_level) : '10'

    reset({
      productType: isVar ? 'VARIABLE' : 'SIMPLE',
      name: prod.name,
      category: prod.category?.name || 'General',
      purchase_price: buyPriceStr,
      selling_price: sellPriceStr,
      default_reorder_level: reorderStr,
      is_active: prod.is_active !== false,
      image_url: prod.image_url || '',
      simpleSku: !isVar ? prod.sku || firstVar?.sku || '' : '',
      simpleBarcode: !isVar ? prod.barcode || firstVar?.barcode || '' : '',
      simpleStock: !isVar ? String(firstVar?.quantity_on_hand ?? 0) : '0',
      attributesList: [],
      variantsList: draftVariants,
    })

    setProductModalOpen(true)
  }, [reset])

  return {
    productModalOpen,
    setProductModalOpen,
    editingProduct,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    selectedPhotoUri,
    uploadingPhoto,
    uploadProgress,
    uploadedImageUrl,
    isSavingProduct,
    handlePickProductPhotoFromGallery,
    handleTakeProductPhoto,
    handleRemoveProductPhoto,
    productType,
    formCategory,
    formIsActive,
    selectedProductAttributes,
    setSelectedProductAttributes,
    handleToggleAttributeValue,
    handleAddCustomValueToAttribute,
    handleRemoveAttribute,
    handleGenerateMatrix,
    variantScannerOpen,
    setVariantScannerOpen,
    simpleBarcodeScannerOpen,
    setSimpleBarcodeScannerOpen,
    activeScanVariantIndex,
    setActiveScanVariantIndex,
    handleStartScanVariantBarcode,
    handleScanCodeForVariant,
    handleScanCodeForSimpleProduct,
    variantsFields,
    removeVariant,
    onSubmit,
    handleOpenCreateProduct,
    handleOpenEditProduct,
  }
}
