import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { ProductCategory, AttributeTaxonomy, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { categorySchema, CategoryFormValues, attributeSchema, AttributeFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
} from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'

export interface CategoriesAttributesScreenProps {
  onNavigate: (tab: TabType) => void
}

export const INITIAL_CATEGORIES: ProductCategory[] = []

export const INITIAL_ATTRIBUTES: AttributeTaxonomy[] = []

export const CategoriesAttributesScreen: React.FC<CategoriesAttributesScreenProps> = ({ onNavigate }) => {
  const { showToast } = useToast()
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState<'categories' | 'attributes'>('categories')
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [attributes, setAttributes] = useState<AttributeTaxonomy[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null)
  
  const { control: catControl, handleSubmit: handleCatSubmit, reset: resetCat } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', code: '', description: '' },
  })

  // Attribute Modal
  const [attrModalOpen, setAttrModalOpen] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AttributeTaxonomy | null>(null)
  const [attrValuesList, setAttrValuesList] = useState<string[]>([])
  const [attrInputValue, setAttrInputValue] = useState('')
  
  const { control: attrControl, handleSubmit: handleAttrSubmit, reset: resetAttr } = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeSchema),
    defaultValues: { name: '', code: '', values: '' },
  })

  const handleAddChip = (text?: string) => {
    const raw = (text !== undefined ? text : attrInputValue).trim()
    if (!raw) return

    const parts = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    setAttrValuesList((prev) => {
      const next = [...prev]
      for (const part of parts) {
        if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) {
          next.push(part)
        }
      }
      return next
    })
    setAttrInputValue('')
  }

  const handleRemoveChip = (index: number) => {
    setAttrValuesList((prev) => prev.filter((_, i) => i !== index))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    interface ApiCategoryItem {
      id?: string;
      name?: string;
      code?: string;
      description?: string;
      products_count?: number;
      product_count?: number;
    }
    interface ApiAttributeItem {
      id?: string;
      name?: string;
      code?: string;
      values?: unknown[];
      bound_variants_count?: number;
      product_count?: number;
      products_count?: number;
    }
    try {
      // 1. Fetch Categories
      try {
        const catRes = await fetchCategories()
        const rawCats = Array.isArray(catRes) ? (catRes as ApiCategoryItem[]) : ((catRes.data || []) as ApiCategoryItem[])
        if (Array.isArray(rawCats)) {
          const mappedCats: ProductCategory[] = rawCats.map((item) => {
            const name = item.name || 'Unnamed Category'
            return {
              id: item.id || `cat-${Date.now()}`,
              name,
              code: item.code || name.substring(0, 3).toUpperCase(),
              description: item.description || '',
              productCount: item.products_count ?? item.product_count ?? 0,
            }
          })
          setCategories(mappedCats)
        } else {
          setCategories([])
        }
      } catch {
        setCategories([])
      }

      // 2. Fetch Attributes
      try {
        const res = await fetchAttributes()
        const rawList = Array.isArray(res) ? res : res.data || []
        if (Array.isArray(rawList)) {
          const mapped: AttributeTaxonomy[] = rawList.map((item: import('../types').AttributeTaxonomy & { value_name?: string; bound_variants_count?: number; products_count?: number; product_count?: number }) => ({
            id: item.id || `tax-${Date.now()}`,
            name: item.name,
            code: item.code || item.name.substring(0, 3).toUpperCase(),
            values: Array.isArray(item.values)
              ? item.values.map((v: string | { value_name?: string; name?: string }) => (typeof v === 'string' ? v : v.value_name || v.name || ''))
              : [],
            productCount: item.bound_variants_count ?? item.product_count ?? item.products_count ?? 0,
          }))
          setAttributes(mapped)
        } else {
          setAttributes([])
        }
      } catch {
        setAttributes([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  // Filtered lists
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    return categories.filter((c) =>
      matchSearch(searchQuery, c.name, c.code, c.description)
    )
  }, [categories, searchQuery])

  const filteredAttributes = useMemo(() => {
    if (!searchQuery.trim()) return attributes
    return attributes.filter((a) =>
      matchSearch(searchQuery, a.name, a.code, a.values)
    )
  }, [attributes, searchQuery])

  // Category Actions
  const handleOpenAddCategory = () => {
    setEditingCat(null)
    resetCat({ name: '', code: '', description: '' })
    setCatModalOpen(true)
  }

  const handleOpenEditCategory = (cat: ProductCategory) => {
    setEditingCat(cat)
    resetCat({
      name: cat.name,
      code: cat.code || '',
      description: cat.description || '',
    })
    setCatModalOpen(true)
  }

  const onSubmitCategory = async (data: CategoryFormValues) => {
    const code = data.code?.trim() || data.name.substring(0, 3).toUpperCase()

    if (editingCat) {
      const updated: ProductCategory = {
        ...editingCat,
        name: data.name.trim(),
        code,
        description: data.description?.trim(),
      }
      setCategories(categories.map((c) => (c.id === editingCat.id ? updated : c)))
      try {
        await updateCategory(editingCat.id, {
          name: data.name.trim(),
          code,
          description: data.description?.trim(),
        })
      } catch {
        // Fallback optimistic
      }
      showToast(`Category "${data.name}" updated.`, 'success')
    } else {
      const newCat: ProductCategory = {
        id: `cat-${Date.now()}`,
        name: data.name.trim(),
        code,
        description: data.description?.trim(),
        productCount: 0,
      }
      setCategories([...categories, newCat])
      try {
        const res = await createCategory({
          name: data.name.trim(),
          code,
          description: data.description?.trim(),
        })
        if (res?.data?.id) {
          newCat.id = res.data.id
        }
      } catch {
        // Fallback optimistic
      }
      showToast(`New category "${data.name}" created.`, 'success')
    }

    setCatModalOpen(false)
  }

  const handleDeleteCategory = (cat: ProductCategory) => {
    if (cat.productCount && cat.productCount > 0) {
      Alert.alert(
        'Cannot Delete Linked Category',
        `Category "${cat.name}" is currently linked to ${cat.productCount} active products in your catalog.\n\nTo protect inventory history, change their category before deleting.`
      )
      return
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to permanently delete category "${cat.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setCategories((prev) => prev.filter((c) => c.id !== cat.id))
            setCatModalOpen(false)
            try {
              await deleteCategory(cat.id)
            } catch (err: unknown) {
              const error = err as { response?: { data?: { message?: string } } }
              const msg = error.response?.data?.message || 'Failed to delete category from server.'
              showToast(msg, 'warning')
            }
            showToast(`Category "${cat.name}" has been deleted.`, 'success')
          },
        },
      ]
    )
  }

  // Attribute Actions
  const handleOpenAddAttribute = () => {
    setEditingAttr(null)
    resetAttr({ name: '', code: '', values: '' })
    setAttrValuesList([])
    setAttrInputValue('')
    setAttrModalOpen(true)
  }

  const handleOpenEditAttribute = (attr: AttributeTaxonomy) => {
    setEditingAttr(attr)
    resetAttr({
      name: attr.name,
      code: attr.code || '',
      values: attr.values.join(', '),
    })
    setAttrValuesList([...attr.values])
    setAttrInputValue('')
    setAttrModalOpen(true)
  }

  const onSubmitAttribute = async (data: AttributeFormValues) => {
    let finalValues = [...attrValuesList]
    if (attrInputValue.trim()) {
      const parts = attrInputValue.trim().split(',').map((p) => p.trim()).filter((p) => p.length > 0)
      for (const part of parts) {
        if (!finalValues.some((item) => item.toLowerCase() === part.toLowerCase())) {
          finalValues.push(part)
        }
      }
    }

    if (finalValues.length === 0) {
      showToast('Please add at least one preset value.', 'warning')
      return
    }

    const code = data.code?.trim() || data.name.substring(0, 3).toUpperCase()

    if (editingAttr) {
      const updated: AttributeTaxonomy = {
        ...editingAttr,
        name: data.name.trim(),
        code,
        values: finalValues,
      }
      setAttributes(attributes.map((a) => (a.id === editingAttr.id ? updated : a)))
      try {
        await updateAttribute(editingAttr.id, {
          name: data.name.trim(),
          code,
          values: finalValues,
        })
      } catch {
        // Fallback optimistic
      }
      showToast(`Attribute "${data.name}" updated.`, 'success')
    } else {
      const newAttr: AttributeTaxonomy = {
        id: `tax-${Date.now()}`,
        name: data.name.trim(),
        code,
        values: finalValues,
        productCount: 0,
      }
      setAttributes([...attributes, newAttr])
      try {
        const res = await createAttribute({ name: data.name.trim(), code, values: finalValues })
        if (res?.data?.id) {
          newAttr.id = res.data.id
        }
      } catch {
        // Fallback optimistic
      }
      showToast(`New attribute "${data.name}" created.`, 'success')
    }

    setAttrModalOpen(false)
  }

  const handleDeleteAttribute = (attr: AttributeTaxonomy) => {
    if (attr.productCount && attr.productCount > 0) {
      Alert.alert(
        'Cannot Delete Linked Attribute',
        `Attribute "${attr.name}" is currently linked to ${attr.productCount} active product variants in your catalog.\n\nTo protect inventory history, unlink it from products before deleting.`
      )
      return
    }

    Alert.alert(
      'Delete Attribute',
      `Are you sure you want to permanently delete attribute "${attr.name}" and its ${attr.values.length} preset values?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setAttributes((prev) => prev.filter((a) => a.id !== attr.id))
            setAttrModalOpen(false)
            try {
              await deleteAttribute(attr.id)
            } catch (err: unknown) {
              const error = err as { response?: { data?: { message?: string } } }
              const msg = error.response?.data?.message || 'Failed to delete attribute from server.'
              showToast(msg, 'warning')
            }
            showToast(`Attribute "${attr.name}" has been deleted.`, 'success')
          },
        },
      ]
    )
  }


  return (
    <View style={styles.container}>
      {/* Compact Tab Row: tabs + add icon button */}
      <View style={styles.compactTabRow}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'categories' && styles.tabBtnActive]}
            onPress={() => setActiveTab('categories')}
          >
            <Ionicons
              name="folder-open"
              size={14}
              color={activeTab === 'categories' ? tokens.colors.onPrimary : tokens.colors.secondary}
            />
            <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]} numberOfLines={1}>
              Categories ({categories.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'attributes' && styles.tabBtnActive]}
            onPress={() => setActiveTab('attributes')}
          >
            <Ionicons
              name="pricetags"
              size={14}
              color={activeTab === 'attributes' ? tokens.colors.onPrimary : tokens.colors.secondary}
            />
            <Text style={[styles.tabText, activeTab === 'attributes' && styles.tabTextActive]} numberOfLines={1}>
              Attributes ({attributes.length})
            </Text>
          </TouchableOpacity>
        </View>

        {Boolean(activeTab === 'categories' ? can('categories:manage') : can('attributes:manage')) && (
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={activeTab === 'categories' ? handleOpenAddCategory : handleOpenAddAttribute}
            activeOpacity={0.8}
            accessibilityLabel={activeTab === 'categories' ? 'Add Category' : 'Add Attribute'}
          >
            <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={activeTab === 'categories' ? 'Search categories...' : 'Search attributes...'}
        containerStyle={styles.searchBar}
      />

      {/* Content List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primaryContainer]}
            tintColor={tokens.colors.primaryContainer}
          />
        }
      >
        {loading && !refreshing && (activeTab === 'categories' ? categories.length === 0 : attributes.length === 0) ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
          </View>
        ) : null}
        {/* TAB 1: CATEGORIES LIST */}
        {activeTab === 'categories' && (
          <View style={styles.cardsList}>
            {filteredCategories.map((cat) => {
              const isUnlinked = !cat.productCount || cat.productCount === 0

              return (
                <View key={cat.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.iconBoxCat}>
                      <Ionicons name="folder-outline" size={20} color={tokens.colors.primaryContainer} />
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: 12 }}
                      onPress={() => handleOpenEditCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardTitle}>{cat.name}</Text>
                      {cat.productCount !== undefined && (
                        <Text style={styles.attrCountSub}>
                          {cat.productCount === 0 ? 'No products assigned' : `${cat.productCount} products assigned`}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Status Badge & Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isUnlinked ? (
                        <View style={styles.unlinkedBadge}>
                          <Text style={styles.unlinkedBadgeText}>Unlinked</Text>
                        </View>
                      ) : (
                        <View style={styles.linkedBadge}>
                          <Ionicons name="lock-closed" size={10} color="#0369A1" />
                          <Text style={styles.linkedBadgeText}>{cat.productCount} Linked</Text>
                        </View>
                      )}

                      {Boolean(can('categories:manage')) && (
                        <TouchableOpacity
                          style={styles.editIconBadge}
                          onPress={() => handleOpenEditCategory(cat)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="create-outline" size={16} color={tokens.colors.primaryContainer} />
                        </TouchableOpacity>
                      )}

                      {Boolean(isUnlinked && can('categories:manage')) && (
                        <TouchableOpacity
                          style={styles.deleteIconBadge}
                          onPress={() => handleDeleteCategory(cat)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {cat.description ? <Text style={styles.cardDesc}>{cat.description}</Text> : null}
                </View>
              )
            })}
          </View>
        )}

        {/* TAB 2: ATTRIBUTES LIST */}
        {activeTab === 'attributes' && (
          <View style={styles.cardsList}>
            {filteredAttributes.map((attr) => {
              const isUnlinked = !attr.productCount || attr.productCount === 0

              return (
                <View key={attr.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.iconBoxAttr}>
                      <Ionicons name="pricetag-outline" size={20} color="#0284C7" />
                    </View>
                    <TouchableOpacity
                      style={{ flex: 1, marginLeft: 12 }}
                      onPress={() => handleOpenEditAttribute(attr)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardTitle}>{attr.name}</Text>
                      <Text style={styles.attrCountSub}>{attr.values.length} preset values</Text>
                    </TouchableOpacity>

                    {/* Status Badge & Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isUnlinked ? (
                        <View style={styles.unlinkedBadge}>
                          <Text style={styles.unlinkedBadgeText}>Unlinked</Text>
                        </View>
                      ) : (
                        <View style={styles.linkedBadge}>
                          <Ionicons name="lock-closed" size={10} color="#0369A1" />
                          <Text style={styles.linkedBadgeText}>{attr.productCount} Linked</Text>
                        </View>
                      )}

                      {Boolean(can('attributes:manage')) && (
                        <TouchableOpacity
                          style={styles.editIconBadge}
                          onPress={() => handleOpenEditAttribute(attr)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="create-outline" size={16} color={tokens.colors.primaryContainer} />
                        </TouchableOpacity>
                      )}

                      {Boolean(isUnlinked && can('attributes:manage')) && (
                        <TouchableOpacity
                          style={styles.deleteIconBadge}
                          onPress={() => handleDeleteAttribute(attr)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Values Chip Cloud */}
                  <View style={styles.chipCloud}>
                    {attr.values.map((v, i) => (
                      <View key={i} style={styles.valueChip}>
                        <Text style={styles.valueChipText}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Category Create / Edit Modal */}
      <Modal visible={catModalOpen} transparent animationType="slide" onRequestClose={() => setCatModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>{editingCat ? 'Edit Category' : 'New Category'}</Text>
              <TouchableOpacity onPress={() => setCatModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <ControlledInput
                name="name"
                control={catControl}
                label="Category Name *"
                placeholder="e.g. Footwear, Electronics, Apparel"
              />

              <ControlledInput
                name="code"
                control={catControl}
                label="Category Short Code"
                placeholder="e.g. FTW, ELEC, APP"
              />

              <ControlledInput
                name="description"
                control={catControl}
                label="Description (Optional)"
                placeholder="Category notes or product types..."
                inputProps={{
                  multiline: true,
                  numberOfLines: 3,
                  style: styles.multilineInput,
                }}
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleCatSubmit(onSubmitCategory)}>
                <Text style={styles.submitBtnText}>{editingCat ? 'Save Category' : 'Create Category'}</Text>
              </TouchableOpacity>

              {editingCat ? (
                <TouchableOpacity
                  style={[
                    styles.deleteAttrModalBtn,
                    Boolean(editingCat.productCount && editingCat.productCount > 0) && {
                      opacity: 0.6,
                      backgroundColor: '#F1F5F9',
                      borderColor: '#CBD5E1',
                    },
                  ]}
                  onPress={() => handleDeleteCategory(editingCat)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={
                      editingCat.productCount && editingCat.productCount > 0
                        ? tokens.colors.secondary
                        : tokens.colors.statusError
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.deleteAttrModalBtnText,
                      Boolean(editingCat.productCount && editingCat.productCount > 0) && {
                        color: tokens.colors.secondary,
                      },
                    ]}
                  >
                    {editingCat.productCount && editingCat.productCount > 0
                      ? `Locked (Linked to ${editingCat.productCount} Products)`
                      : 'Delete Unlinked Category'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Attribute Create / Edit Modal */}
      <Modal visible={attrModalOpen} transparent animationType="slide" onRequestClose={() => setAttrModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>{editingAttr ? 'Edit Attribute' : 'New Attribute'}</Text>
              <TouchableOpacity onPress={() => setAttrModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <ControlledInput
                name="name"
                control={attrControl}
                label="Attribute Name *"
                placeholder="e.g. Size, Color, Waist, Material"
              />

              <ControlledInput
                name="code"
                control={attrControl}
                label="Short Code"
                placeholder="e.g. SIZE, CLR, WST"
              />

              {/* Interactive Preset Values Tag/Chip Builder */}
              <View style={styles.chipSection}>
                <View style={styles.chipHeaderRow}>
                  <Text style={styles.formLabel}>Preset Values *</Text>
                  <Text style={styles.chipCountLabel}>{attrValuesList.length} value(s)</Text>
                </View>

                {/* Chips Container */}
                {attrValuesList.length > 0 ? (
                  <View style={styles.tagWrapContainer}>
                    {attrValuesList.map((val, idx) => (
                      <View key={idx} style={styles.removableChip}>
                        <Ionicons name="pricetag-outline" size={11} color={tokens.colors.primaryContainer} />
                        <Text style={styles.removableChipText} numberOfLines={1}>{val}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveChip(idx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.chipRemoveBtn}
                        >
                          <Ionicons name="close-circle" size={15} color={tokens.colors.secondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Add Input Row */}
                <View style={styles.chipInputRow}>
                  <TextInput
                    style={styles.chipTextInput}
                    placeholder="Type value (e.g. S, M, L or Red, Blue)..."
                    placeholderTextColor={tokens.colors.textMuted}
                    value={attrInputValue}
                    onChangeText={(text) => {
                      if (text.includes(',')) {
                        handleAddChip(text)
                      } else {
                        setAttrInputValue(text)
                      }
                    }}
                    onSubmitEditing={() => handleAddChip()}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={[styles.addChipBtn, !attrInputValue.trim() && styles.addChipBtnDisabled]}
                    onPress={() => handleAddChip()}
                    disabled={!attrInputValue.trim()}
                  >
                    <Ionicons name="add" size={18} color={attrInputValue.trim() ? tokens.colors.onPrimary : tokens.colors.secondary} />
                    <Text style={[styles.addChipBtnText, !attrInputValue.trim() && { color: tokens.colors.secondary }]}>Add</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.chipHelperText}>
                  Type and tap Add or comma. You can also paste comma-separated lists.
                </Text>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleAttrSubmit(onSubmitAttribute)}>
                <Text style={styles.submitBtnText}>{editingAttr ? 'Save Attribute' : 'Create Attribute'}</Text>
              </TouchableOpacity>

              {editingAttr ? (
                <TouchableOpacity
                  style={[
                    styles.deleteAttrModalBtn,
                    Boolean(editingAttr.productCount && editingAttr.productCount > 0) && {
                      opacity: 0.6,
                      backgroundColor: '#F1F5F9',
                      borderColor: '#CBD5E1',
                    },
                  ]}
                  onPress={() => handleDeleteAttribute(editingAttr)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={
                      editingAttr.productCount && editingAttr.productCount > 0
                        ? tokens.colors.secondary
                        : tokens.colors.statusError
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.deleteAttrModalBtnText,
                      Boolean(editingAttr.productCount && editingAttr.productCount > 0) && {
                        color: tokens.colors.secondary,
                      },
                    ]}
                  >
                    {editingAttr.productCount && editingAttr.productCount > 0
                      ? `Locked (Linked to ${editingAttr.productCount} Products)`
                      : 'Delete Unlinked Attribute'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  compactTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: tokens.spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: tokens.spacing.sm,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  tabTextActive: {
    color: tokens.colors.onPrimary,
  },
  addIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 2,
    ...tokens.shadows.card,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: tokens.spacing.md,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
    ...tokens.shadows.card,
  },
  addBtnText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  cardsList: {
    gap: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBoxCat: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxAttr: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  cardCode: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  attrCountSub: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  editIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDesc: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 8,
    lineHeight: 16,
  },
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  valueChip: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  valueChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  formScroll: {
    padding: tokens.spacing.md,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  multilineInput: {
    height: 75,
    textAlignVertical: 'top',
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  submitBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    ...tokens.shadows.card,
  },
  submitBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  unlinkedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  unlinkedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    gap: 3,
  },
  linkedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  deleteIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAttrModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    marginTop: 6,
    marginBottom: 24,
  },
  deleteAttrModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.statusError,
  },
  chipSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  chipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chipCountLabel: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontFamily: tokens.fonts.medium,
  },
  tagWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.input,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  removableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  removableChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
    maxWidth: 120,
  },
  chipRemoveBtn: {
    padding: 2,
    marginLeft: 2,
  },
  chipInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chipTextInput: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  addChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  addChipBtnDisabled: {
    backgroundColor: tokens.colors.surfaceMuted,
  },
  addChipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  chipHelperText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 4,
  },
})

export default CategoriesAttributesScreen
