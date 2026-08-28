import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import { tokens } from '../theme/tokens'
import type { ExpenseRecord, TabType, PaginatedData } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, ExpenseFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { fetchExpenses, createExpense, deleteExpense, BackendExpense } from '../api/endpoints'
import { useDebounce } from '../hooks/useDebounce'
import { usePermissions } from '../hooks/usePermissions'

export interface ExpensesScreenProps {
  onNavigate?: (tab: TabType) => void
}

type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'

const INITIAL_EXPENSES: ExpenseRecord[] = []


const CATEGORIES: ExpenseRecord['category'][] = [
  'Rent',
  'Utilities',
  'Salary',
  'Logistics',
  'Marketing',
  'Supplies',
  'Maintenance',
  'Other',
]

// Date & Time Formatting Helpers
function formatExpenseDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recent'
  try {
    const target = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`).getTime()
    const diffMs = Date.now() - target
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays <= 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    const d = new Date(target)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recent'
  }
}

function getCategoryConfig(category: string) {
  switch (category) {
    case 'Rent':
      return { icon: 'business-outline' as const, color: tokens.colors.primaryContainer, bg: tokens.colors.actionPrimaryBg, label: 'Rent' }
    case 'Utilities':
      return { icon: 'flash-outline' as const, color: '#F59E0B', bg: '#FEF3C7', label: 'Utilities' }
    case 'Salary':
      return { icon: 'people-outline' as const, color: '#8B5CF6', bg: '#F5F3FF', label: 'Salary' }
    case 'Logistics':
      return { icon: 'car-outline' as const, color: '#06B6D4', bg: '#ECFEFF', label: 'Logistics' }
    case 'Marketing':
      return { icon: 'megaphone-outline' as const, color: '#EC4899', bg: '#FDF2F8', label: 'Marketing' }
    case 'Supplies':
      return { icon: 'cart-outline' as const, color: '#10B981', bg: '#ECFDF5', label: 'Supplies' }
    case 'Maintenance':
      return { icon: 'construct-outline' as const, color: '#F97316', bg: '#FFF7ED', label: 'Maintenance' }
    default:
      return { icon: 'receipt-outline' as const, color: '#64748B', bg: '#F1F5F9', label: 'Other' }
  }
}

function getPaymentBadge(method: string) {
  const m = (method || '').toLowerCase()
  if (m.includes('aba') || m.includes('khqr')) {
    return { name: 'qr-code' as const, color: '#005F83', bg: '#E0F2FE', label: 'ABA QR' }
  }
  if (m.includes('bank') || m.includes('transfer')) {
    return { name: 'business' as const, color: '#1E3A8A', bg: '#FFF7ED', label: 'Bank' }
  }
  if (m.includes('card')) {
    return { name: 'card' as const, color: '#7C3AED', bg: '#EDE9FE', label: 'Card' }
  }
  return { name: 'cash' as const, color: '#16A34A', bg: '#DCFCE7', label: 'Cash' }
}

interface ExpenseRowItemProps {
  exp: ExpenseRecord
  onPress: (exp: ExpenseRecord) => void
}

const ExpenseRowItem: React.FC<ExpenseRowItemProps> = React.memo(({ exp, onPress }) => {
  const catConfig = getCategoryConfig(exp.category)
  const payBadge = getPaymentBadge(exp.paymentMethod)

  return (
    <TouchableOpacity
      style={styles.expenseCard}
      onPress={() => onPress(exp)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Expense ${exp.title}, amount $${exp.amount.toFixed(2)}`}
    >
      {/* Card Header: Category & Date */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.catPill}>
          <View style={[styles.catIconWrap, { backgroundColor: catConfig.bg }]}>
            <Ionicons name={catConfig.icon} size={12} color={catConfig.color} />
          </View>
          <Text style={styles.catPillText}>{exp.category}</Text>
        </View>

        <View style={styles.headerRightInfo}>
          <Text style={styles.relativeTimeText}>{formatRelativeTime(exp.expenseDate)}</Text>
          <View style={[styles.payMethodBadge, { backgroundColor: payBadge.bg }]}>
            <Ionicons name={payBadge.name} size={10} color={payBadge.color} />
            <Text style={[styles.payMethodText, { color: payBadge.color }]}>{payBadge.label}</Text>
          </View>
        </View>
      </View>

      {/* Card Body: Title & Amount */}
      <View style={styles.cardBodyRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.expTitle} numberOfLines={2}>
            {exp.title}
          </Text>
          {exp.notes ? (
            <Text style={styles.expNotes} numberOfLines={1}>
              {exp.notes}
            </Text>
          ) : null}
        </View>
        <Text style={styles.expAmount}>-${exp.amount.toFixed(2)}</Text>
      </View>

      <View style={styles.cardDivider} />

      {/* Card Footer: Recorded By & Formatted Date */}
      <View style={styles.cardFooterRow}>
        <View style={styles.staffWrap}>
          <Ionicons name="person-circle-outline" size={13} color={tokens.colors.secondary} />
          <Text style={styles.staffText}>{exp.recordedBy || 'Staff Member'}</Text>
        </View>
        <View style={styles.dateWrap}>
          <Ionicons name="calendar-outline" size={12} color={tokens.colors.secondary} />
          <Text style={styles.dateText}>{formatExpenseDate(exp.expenseDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
})

export const ExpensesScreen: React.FC<ExpensesScreenProps> = () => {
  const { can } = usePermissions()
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  
  // Date filtering state (Matching TransactionsScreen)
  const [dateRange, setDateRange] = useState<DateRangeMode>('all')
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  )
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().split('T')[0])

  // Custom Calendar Modal State
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'custom'>('custom')
  const [tempSingleDate, setTempSingleDate] = useState(singleDate)
  const [tempCustomFrom, setTempCustomFrom] = useState(customFrom)
  const [tempCustomTo, setTempCustomTo] = useState(customTo)

  // Data Loading & Pagination
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Debounced Search Query
  const debouncedSearch = useDebounce(search, 400)

  // Form handling
  const { control, handleSubmit, reset, watch, setValue } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { title: '', category: 'Utilities', amount: '', paymentMethod: 'Cash', notes: '' },
  })

  const formCategory = watch('category')
  const formMethod = watch('paymentMethod')

  // Calculate active date bounds for backend and client filtering
  const activeDateBounds = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (dateRange === 'today') {
      return { from: todayStr, to: todayStr }
    }
    if (dateRange === '7d') {
      const fromStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
      return { from: fromStr, to: todayStr }
    }
    if (dateRange === '30d') {
      const fromStr = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
      return { from: fromStr, to: todayStr }
    }
    if (dateRange === 'year') {
      const thisYear = new Date().getFullYear()
      return { from: `${thisYear}-01-01`, to: todayStr }
    }
    if (dateRange === 'single') {
      return { from: singleDate, to: singleDate }
    }
    if (dateRange === 'custom') {
      return { from: customFrom, to: customTo }
    }
    return { from: undefined, to: undefined }
  }, [dateRange, singleDate, customFrom, customTo])

  // Fetch Expenses with database integration
  const loadExpenses = useCallback(
    async (pageNum = 1, isLoadMore = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        const res = await fetchExpenses({
          page: pageNum,
          per_page: 15,
          search: debouncedSearch.trim() || undefined,
          category: categoryFilter === 'ALL' ? undefined : categoryFilter,
          date_from: activeDateBounds.from,
          date_to: activeDateBounds.to,
        })

        const resData = res?.data
        let list: BackendExpense[] = []
        if (Array.isArray(resData)) {
          list = resData
        } else if (
          resData &&
          typeof resData === 'object' &&
          'data' in resData &&
          Array.isArray((resData as PaginatedData<BackendExpense>).data)
        ) {
          list = (resData as PaginatedData<BackendExpense>).data
        }

        const mapped: ExpenseRecord[] = list.map((b) => ({
          id: b.id,
          title: b.title || b.notes || `${b.category} Expense`,
          category: (b.category as any) || 'Other',
          amount: typeof b.amount === 'number' ? b.amount : parseFloat(String(b.amount || '0')) || 0,
          paymentMethod: (b.payment_method as any) || 'Cash',
          expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
          recordedBy: b.user?.name || 'Staff Member',
          notes: b.notes || undefined,
        }))

        if (pageNum === 1) {
          if (mapped.length > 0) {
            setExpenses(mapped)
          } else {
            setExpenses([])
          }
        } else {
          if (mapped.length > 0) {
            setExpenses((prev) => [...prev, ...mapped])
          }
        }

        setHasMore(mapped.length >= 15)
        setPage(pageNum)
      } catch {
        if (pageNum === 1) {
          setExpenses([])
        }
        setHasMore(false)
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [debouncedSearch, categoryFilter, activeDateBounds.from, activeDateBounds.to]
  )

  useEffect(() => {
    loadExpenses(1, false)
  }, [loadExpenses])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadExpenses(1, false)
  }, [loadExpenses])

  // Category counts within current loaded list
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: expenses.length }
    CATEGORIES.forEach((c) => {
      counts[c] = 0
    })
    expenses.forEach((e) => {
      if (counts[e.category] !== undefined) {
        counts[e.category]++
      }
    })
    return counts
  }, [expenses])

  // Filtered expenses (safe client fallback)
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = debouncedSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.recordedBy.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      const matchCategory = categoryFilter === 'ALL' || e.category === categoryFilter
      return matchSearch && matchCategory
    })
  }, [expenses, debouncedSearch, categoryFilter])

  // Analytics & Summary stats (Inspired by ReportsScreen Bento)
  const summary = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
    const count = filteredExpenses.length
    const avg = count > 0 ? total / count : 0

    const catTotals: Record<string, number> = {}
    filteredExpenses.forEach((e) => {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount
    })

    let topCat = 'None'
    let maxCatVal = 0
    Object.entries(catTotals).forEach(([cat, val]) => {
      if (val > maxCatVal) {
        maxCatVal = val
        topCat = cat
      }
    })

    return { total, count, avg, topCat }
  }, [filteredExpenses])

  // Date picker handlers
  const getDateLabel = () => {
    if (dateRange === 'today') return 'Today'
    if (dateRange === '7d') return '7 Days'
    if (dateRange === '30d') return '30 Days'
    if (dateRange === 'year') return 'This Year'
    if (dateRange === 'single') return singleDate
    if (dateRange === 'custom') {
      try {
        const f = new Date(customFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const t = new Date(customTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `${f} - ${t}`
      } catch {
        return `${customFrom} - ${customTo}`
      }
    }
    return 'All Time'
  }

  const handleOpenCustomModal = () => {
    setTempMode(dateRange === 'single' ? 'single' : 'custom')
    setTempSingleDate(singleDate)
    setTempCustomFrom(customFrom)
    setTempCustomTo(customTo)
    setCustomRangeModalOpen(true)
  }

  const handleApplySingleDate = () => {
    if (!tempSingleDate.trim()) {
      Alert.alert('Required', 'Please enter a valid date (YYYY-MM-DD).')
      return
    }
    setSingleDate(tempSingleDate.trim())
    setDateRange('single')
    setCustomRangeModalOpen(false)
  }

  const handleApplyCustomRange = () => {
    if (!tempCustomFrom.trim() || !tempCustomTo.trim()) {
      Alert.alert('Required', 'Please enter both start date and end date (YYYY-MM-DD).')
      return
    }
    setCustomFrom(tempCustomFrom.trim())
    setCustomTo(tempCustomTo.trim())
    setDateRange('custom')
    setCustomRangeModalOpen(false)
  }

  const handleRangeDayPress = (day: any) => {
    if (!tempCustomFrom || (tempCustomFrom && tempCustomTo)) {
      setTempCustomFrom(day.dateString)
      setTempCustomTo('')
    } else {
      if (day.dateString < tempCustomFrom) {
        setTempCustomTo(tempCustomFrom)
        setTempCustomFrom(day.dateString)
      } else {
        setTempCustomTo(day.dateString)
      }
    }
  }

  const getRangeMarkedDates = () => {
    const marks: any = {}
    if (tempCustomFrom) {
      marks[tempCustomFrom] = {
        startingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: 'white',
        selected: true,
        selectedColor: tokens.colors.primaryContainer,
      }
    }
    if (tempCustomTo) {
      marks[tempCustomTo] = {
        endingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: 'white',
        selected: true,
        selectedColor: tokens.colors.primaryContainer,
      }

      let curr = new Date(tempCustomFrom)
      curr.setDate(curr.getDate() + 1)
      const end = new Date(tempCustomTo)
      while (curr < end) {
        const dateStr = curr.toISOString().split('T')[0]
        marks[dateStr] = {
          color: tokens.colors.primaryContainer + '40',
          textColor: tokens.colors.onBackground,
          selected: true,
          selectedColor: tokens.colors.primaryContainer + '40',
        }
        curr.setDate(curr.getDate() + 1)
      }
    }
    return marks
  }

  // Create new expense via API
  const onSubmit = async (data: ExpenseFormValues) => {
    const amt = parseFloat(data.amount)
    setSubmitting(true)

    const todayStr = new Date().toISOString().split('T')[0]
    const optimisticRecord: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      title: data.title,
      category: data.category as any,
      amount: amt,
      paymentMethod: data.paymentMethod as any,
      expenseDate: todayStr,
      recordedBy: 'You',
      notes: data.notes,
    }

    try {
      const res = await createExpense({
        title: data.title,
        expense_date: todayStr,
        category: data.category,
        amount: amt,
        payment_method: data.paymentMethod,
        notes: data.notes || undefined,
      })

      if (res?.data) {
        optimisticRecord.id = res.data.id
        optimisticRecord.recordedBy = res.data.user?.name || 'You'
      }

      setExpenses((prev) => [optimisticRecord, ...prev])
      setAddModalOpen(false)
      reset({ title: '', category: 'Utilities', amount: '', paymentMethod: 'Cash', notes: '' })
      Alert.alert('Expense Recorded', `Successfully recorded $${amt.toFixed(2)} for "${data.title}".`)
    } catch (err: any) {
      setExpenses((prev) => [optimisticRecord, ...prev])
      setAddModalOpen(false)
      reset({ title: '', category: 'Utilities', amount: '', paymentMethod: 'Cash', notes: '' })
      Alert.alert('Recorded Locally', `Expense saved locally ($${amt.toFixed(2)}).`)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete expense handler
  const handleDeleteExpense = async (id: string, title: string) => {
    Alert.alert('Delete Expense', `Are you sure you want to delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id)
          try {
            await deleteExpense(id)
          } catch {
            // Silently ignore or fallback
          } finally {
            setExpenses((prev) => prev.filter((e) => e.id !== id))
            setDetailModalOpen(false)
            setSelectedExpense(null)
            setDeletingId(null)
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      {/* 1. Top Search & Quick Action Toolbar (Ultra-compact) */}
      <View style={styles.compactToolbar}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={14} color={tokens.colors.secondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses, notes, staff..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={tokens.colors.secondary}
            returnKeyType="search"
          />
          {Boolean(search.length > 0) && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={15} color={tokens.colors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {Boolean(can('expenses:manage')) && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              reset({ title: '', category: 'Utilities', amount: '', paymentMethod: 'Cash', notes: '' })
              setAddModalOpen(true)
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Record New Expense"
          >
            <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
            <Text style={styles.addBtnText}>Log</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Date Filter Chips Row (Ultra-compact, low profile) */}
      <View style={styles.dateSelectorRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateSelectorContent}
        >
          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'all' && styles.dateBtnActive]}
            onPress={() => setDateRange('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === 'all' && styles.dateBtnTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'today' && styles.dateBtnActive]}
            onPress={() => setDateRange('today')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === 'today' && styles.dateBtnTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '7d' && styles.dateBtnActive]}
            onPress={() => setDateRange('7d')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === '7d' && styles.dateBtnTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '30d' && styles.dateBtnActive]}
            onPress={() => setDateRange('30d')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === '30d' && styles.dateBtnTextActive]}>
              30 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'year' && styles.dateBtnActive]}
            onPress={() => setDateRange('year')}
            activeOpacity={0.75}
          >
            <Text style={[styles.dateBtnText, dateRange === 'year' && styles.dateBtnTextActive]}>
              Year
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dateBtn,
              (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnActive,
              { flexDirection: 'row', gap: 4 },
            ]}
            onPress={handleOpenCustomModal}
            activeOpacity={0.75}
          >
            <Ionicons
              name="calendar-outline"
              size={12}
              color={
                dateRange === 'single' || dateRange === 'custom'
                  ? tokens.colors.onPrimary
                  : tokens.colors.secondary
              }
            />
            <Text
              style={[
                styles.dateBtnText,
                (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnTextActive,
              ]}
              numberOfLines={1}
            >
              {dateRange === 'single' || dateRange === 'custom' ? getDateLabel() : 'Custom'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. Category Filter Badges Row (Ultra-compact, low profile) */}
      <View style={styles.categoryChipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsContent}
        >
          {['ALL', ...CATEGORIES].map((cat) => {
            const isSelected = categoryFilter === cat
            const count = categoryCounts[cat] || 0
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => setCategoryFilter(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </Text>
                <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                  <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* 4. Main Virtualized Expenses List (FlatList) */}
      <FlatList
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primaryContainer}
            colors={[tokens.colors.primaryContainer]}
          />
        }
        onEndReached={() => {
          if (!loading && !loadingMore && hasMore) {
            loadExpenses(page + 1, true)
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {/* Active Date Context Banner */}
            {dateRange !== 'all' && (
              <View style={styles.activeFilterBanner}>
                <Ionicons name="time-outline" size={13} color={tokens.colors.primaryContainer} />
                <Text style={styles.activeFilterBannerText}>
                  Period: <Text style={styles.activeFilterHighlight}>{getDateLabel()}</Text>
                </Text>
                <TouchableOpacity onPress={() => setDateRange('all')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Hero Analytics Card (Reports & Analytics #1E293B Theme) */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroSubtitle}>TOTAL OPERATIONAL EXPENSES</Text>
                  <Text style={styles.heroAmount}>
                    ${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.heroTrendBadge}>
                  <Ionicons name="pie-chart" size={12} color="#F87171" />
                  <Text style={styles.heroTrendText}>Active</Text>
                </View>
              </View>

              <View style={styles.heroBreakdownRow}>
                <View style={styles.heroPillItem}>
                  <Ionicons name="receipt-outline" size={11} color="#38BDF8" />
                  <Text style={styles.heroPillText}>
                    {summary.count} {summary.count === 1 ? 'Entry' : 'Entries'}
                  </Text>
                </View>
                <View style={styles.heroPillItem}>
                  <Ionicons name="analytics-outline" size={11} color="#FB923C" />
                  <Text style={styles.heroPillText}>Avg ${summary.avg.toFixed(2)}</Text>
                </View>
                <View style={styles.heroPillItem}>
                  <Ionicons name="pricetag-outline" size={11} color="#A78BFA" />
                  <Text style={styles.heroPillText}>Top: {summary.topCat}</Text>
                </View>
              </View>
            </View>

            {/* Section Header */}
            <View style={styles.listSectionHeader}>
              <Text style={styles.listSectionTitle}>Expenses ({filteredExpenses.length})</Text>
              <Text style={styles.listSectionSub}>Tap card for details & receipt breakdown</Text>
            </View>
          </>
        }
        renderItem={({ item: exp }) => (
          <ExpenseRowItem
            exp={exp}
            onPress={(selected) => {
              setSelectedExpense(selected)
              setDetailModalOpen(true)
            }}
          />
        )}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
              <Text style={styles.centerLoadingText}>Loading expenses...</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="cash-outline" size={40} color={tokens.colors.secondaryFixedDim} />
              <Text style={styles.emptyTitle}>No matching expenses</Text>
              <Text style={styles.emptySub}>
                {search
                  ? 'No results found matching your search keyword.'
                  : dateRange !== 'all'
                  ? `No expenses found for the selected period (${getDateLabel()}).`
                  : 'Tap "+ Log" above to record your first operational expense.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreRow}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
              <Text style={styles.loadingMoreText}>Loading more expenses...</Text>
            </View>
          ) : null
        }
      />

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM DATE PICKER (Matching TransactionsScreen)                   */}
      {/* ========================================================================= */}
      <Modal visible={customRangeModalOpen} animationType="slide" transparent onRequestClose={() => setCustomRangeModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.modalTitle}>Select Date Range</Text>
              </View>
              <TouchableOpacity onPress={() => setCustomRangeModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Filter expenses by single day or date range</Text>

            {/* Mode Switcher Tabs */}
            <View style={styles.modalModeSwitcher}>
              <TouchableOpacity
                style={[styles.modalModeTab, tempMode === 'custom' && styles.modalModeTabActive]}
                onPress={() => setTempMode('custom')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={tempMode === 'custom' ? tokens.colors.onPrimary : tokens.colors.secondary}
                />
                <Text style={[styles.modalModeTabText, tempMode === 'custom' && styles.modalModeTabTextActive]}>
                  Date Range
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalModeTab, tempMode === 'single' && styles.modalModeTabActive]}
                onPress={() => setTempMode('single')}
              >
                <Ionicons
                  name="today-outline"
                  size={14}
                  color={tempMode === 'single' ? tokens.colors.onPrimary : tokens.colors.secondary}
                />
                <Text style={[styles.modalModeTabText, tempMode === 'single' && styles.modalModeTabTextActive]}>
                  Single Date
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Quick Presets */}
              <Text style={styles.inputLabel}>QUICK PRESETS</Text>
              <View style={styles.quickPresetsGrid}>
                {[
                  {
                    label: 'Today',
                    action: () => {
                      const t = new Date().toISOString().split('T')[0]
                      setTempSingleDate(t)
                      setTempCustomFrom(t)
                      setTempCustomTo(t)
                    },
                  },
                  {
                    label: 'Yesterday',
                    action: () => {
                      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                      setTempSingleDate(y)
                      setTempCustomFrom(y)
                      setTempCustomTo(y)
                    },
                  },
                  {
                    label: 'Last 7 Days',
                    action: () => {
                      const t = new Date().toISOString().split('T')[0]
                      const f = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
                      setTempMode('custom')
                      setTempCustomFrom(f)
                      setTempCustomTo(t)
                    },
                  },
                  {
                    label: 'Last 30 Days',
                    action: () => {
                      const t = new Date().toISOString().split('T')[0]
                      const f = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
                      setTempMode('custom')
                      setTempCustomFrom(f)
                      setTempCustomTo(t)
                    },
                  },
                  {
                    label: 'This Month',
                    action: () => {
                      const now = new Date()
                      const f = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                      const t = now.toISOString().split('T')[0]
                      setTempMode('custom')
                      setTempCustomFrom(f)
                      setTempCustomTo(t)
                    },
                  },
                  {
                    label: 'This Year',
                    action: () => {
                      const now = new Date()
                      const f = `${now.getFullYear()}-01-01`
                      const t = now.toISOString().split('T')[0]
                      setTempMode('custom')
                      setTempCustomFrom(f)
                      setTempCustomTo(t)
                    },
                  },
                ].map((preset, idx) => (
                  <TouchableOpacity key={idx} style={styles.presetChip} onPress={preset.action}>
                    <Text style={styles.presetChipText}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tempMode === 'single' ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputLabel}>CALENDAR PICKER</Text>
                  <Calendar
                    current={tempSingleDate}
                    onDayPress={(day: any) => setTempSingleDate(day.dateString)}
                    markedDates={{
                      [tempSingleDate]: {
                        selected: true,
                        selectedColor: tokens.colors.primaryContainer,
                      },
                    }}
                    theme={{
                      todayTextColor: tokens.colors.primaryContainer,
                      arrowColor: tokens.colors.primaryContainer,
                      textDayFontSize: 13,
                      textMonthFontSize: 14,
                      textDayHeaderFontSize: 12,
                    }}
                  />
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>OR TYPE DATE (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    value={tempSingleDate}
                    onChangeText={setTempSingleDate}
                    placeholderTextColor={tokens.colors.secondary}
                  />
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputLabel}>SELECT START & END DATES ON CALENDAR</Text>
                  <Calendar
                    onDayPress={handleRangeDayPress}
                    markingType="period"
                    markedDates={getRangeMarkedDates()}
                    theme={{
                      todayTextColor: tokens.colors.primaryContainer,
                      arrowColor: tokens.colors.primaryContainer,
                      textDayFontSize: 13,
                      textMonthFontSize: 14,
                      textDayHeaderFontSize: 12,
                    }}
                  />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>FROM DATE</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="YYYY-MM-DD"
                        value={tempCustomFrom}
                        onChangeText={setTempCustomFrom}
                        placeholderTextColor={tokens.colors.secondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>TO DATE</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="YYYY-MM-DD"
                        value={tempCustomTo}
                        onChangeText={setTempCustomTo}
                        placeholderTextColor={tokens.colors.secondary}
                      />
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCustomRangeModalOpen(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={tempMode === 'single' ? handleApplySingleDate : handleApplyCustomRange}
              >
                <Text style={styles.modalApplyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: RECORD NEW EXPENSE                                                 */}
      {/* ========================================================================= */}
      <Modal visible={addModalOpen} transparent animationType="slide" onRequestClose={() => setAddModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.catIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="receipt" size={16} color={tokens.colors.primaryContainer} />
                </View>
                <Text style={styles.detailTitle}>Record New Expense</Text>
              </View>
              <TouchableOpacity onPress={() => setAddModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
              <ControlledInput
                name="title"
                control={control}
                label="Expense Title / Description *"
                placeholder="e.g. Storefront electricity & water bill"
              />

              <Text style={styles.formLabel}>Category *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((c) => {
                  const cfg = getCategoryConfig(c)
                  const isActive = formCategory === c
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.catBtn, isActive && styles.catBtnActive]}
                      onPress={() => setValue('category', c as any)}
                    >
                      <Ionicons name={cfg.icon} size={12} color={isActive ? tokens.colors.onPrimary : cfg.color} />
                      <Text style={[styles.catBtnText, isActive && styles.catBtnTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <ControlledInput
                name="amount"
                control={control}
                label="Amount ($) *"
                placeholder="0.00"
                inputProps={{ keyboardType: 'numeric' }}
              />

              <Text style={styles.formLabel}>Payment Method *</Text>
              <View style={styles.methodRow}>
                {(['Cash', 'ABA QR', 'Card', 'Bank Transfer'] as const).map((m) => {
                  const badge = getPaymentBadge(m)
                  const isActive = formMethod === m
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodBtn, isActive && styles.methodBtnActive]}
                      onPress={() => setValue('paymentMethod', m as any)}
                    >
                      <Ionicons name={badge.name} size={14} color={isActive ? tokens.colors.onPrimary : badge.color} />
                      <Text style={[styles.methodBtnText, isActive && styles.methodBtnTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <ControlledInput
                name="notes"
                control={control}
                label="Notes / Vendor Reference"
                placeholder="Invoice reference, vendor details, or memo..."
                inputProps={{ multiline: true, style: { height: 65 } }}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit(onSubmit)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={tokens.colors.onPrimary} />
                    <Text style={styles.submitBtnText}>Save & Log Expense</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EXPENSE DETAILS & RECEIPT VIEW                                     */}
      {/* ========================================================================= */}
      <Modal
        visible={detailModalOpen && !!selectedExpense}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.catIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="cash" size={16} color={tokens.colors.statusError} />
                </View>
                <Text style={styles.detailTitle}>Expense Details</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            {selectedExpense ? (
              <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                {/* Amount Callout */}
                <View style={styles.detailAmountCard}>
                  <Text style={styles.detailAmountSub}>TOTAL EXPENDITURE</Text>
                  <Text style={styles.detailAmountVal}>${selectedExpense.amount.toFixed(2)}</Text>
                  <View style={styles.detailAmountBadge}>
                    <Text style={styles.detailAmountBadgeText}>{selectedExpense.category}</Text>
                  </View>
                </View>

                {/* Information Rows */}
                <View style={styles.detailInfoBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Title</Text>
                    <Text style={styles.detailRowVal}>{selectedExpense.title}</Text>
                  </View>
                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Category</Text>
                    <Text style={styles.detailRowVal}>{selectedExpense.category}</Text>
                  </View>
                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Payment Method</Text>
                    <Text style={styles.detailRowVal}>{selectedExpense.paymentMethod}</Text>
                  </View>
                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Expense Date</Text>
                    <Text style={styles.detailRowVal}>{formatExpenseDate(selectedExpense.expenseDate)}</Text>
                  </View>
                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Recorded By</Text>
                    <Text style={styles.detailRowVal}>{selectedExpense.recordedBy || 'Staff'}</Text>
                  </View>

                  {selectedExpense.notes ? (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                        <Text style={styles.detailRowLabel}>Notes / Reference</Text>
                        <Text style={styles.detailNotesText}>{selectedExpense.notes}</Text>
                      </View>
                    </>
                  ) : null}
                </View>

                {/* Actions */}
                {Boolean(can('expenses:manage')) && (
                  <TouchableOpacity
                    style={styles.deleteExpenseBtn}
                    onPress={() => handleDeleteExpense(selectedExpense.id, selectedExpense.title)}
                    disabled={deletingId === selectedExpense.id}
                  >
                    {deletingId === selectedExpense.id ? (
                      <ActivityIndicator size="small" color={tokens.colors.statusError} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                        <Text style={styles.deleteExpenseBtnText}>Delete This Expense Record</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
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
  // 1. Top Compact Toolbar
  compactToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 5,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 32,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  addBtnText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  // 2. Date Selector Row (Ultra-compact)
  dateSelectorRow: {
    backgroundColor: tokens.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  dateSelectorContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 4,
    gap: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  dateBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
    includeFontPadding: false,
  },
  dateBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  // 3. Category Chips Row (Ultra-compact, no excess margin)
  categoryChipsRow: {
    backgroundColor: tokens.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  categoryChipsContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 4,
    gap: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  categoryChipTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  countBadgeTextActive: {
    color: tokens.colors.onPrimary,
  },
  // Scroll & FlatList area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs + 2,
    paddingBottom: tokens.spacing.xl + 40,
  },
  // Active Filter Context Banner
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.xs + 2,
  },
  activeFilterBannerText: {
    fontSize: 11,
    color: tokens.colors.primary,
    fontWeight: '600',
  },
  activeFilterHighlight: {
    fontWeight: '800',
  },
  // Hero Bento Card (Reports & Analytics #1E293B Theme)
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.8,
  },
  heroTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  heroTrendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  heroPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  // Section Header
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  // Redesigned Expense Card
  expenseCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.sm + 4,
    marginBottom: tokens.spacing.xs + 2,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  catIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  headerRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  relativeTimeText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
  },
  payMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    gap: 3,
  },
  payMethodText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    lineHeight: 18,
  },
  expNotes: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  expAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.statusError,
  },
  cardDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 6,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  staffText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  // Loading & Empty States
  centerLoading: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  centerLoadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptySub: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  loadingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  loadingMoreText: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: tokens.spacing.md,
  },
  modalCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    ...tokens.shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  modalSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginBottom: 10,
  },
  modalModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    padding: 3,
    marginBottom: 10,
  },
  modalModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  modalModeTabActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  modalModeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  modalModeTabTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  quickPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: tokens.colors.onBackground,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  modalApplyBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  modalApplyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  // Detail & Add Sheets
  detailSheet: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    borderBottomLeftRadius: Platform.OS === 'ios' ? tokens.borderRadius.card : 0,
    borderBottomRightRadius: Platform.OS === 'ios' ? tokens.borderRadius.card : 0,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  detailBody: {
    padding: tokens.spacing.md,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  catBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  catBtnText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  methodBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  methodBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  methodBtnText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  methodBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 20,
    gap: 6,
    ...tokens.shadows.card,
  },
  submitBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  // Detail Modal Content
  detailAmountCard: {
    backgroundColor: '#1E293B',
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    alignItems: 'center',
    marginBottom: 12,
  },
  detailAmountSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  detailAmountVal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F87171',
    marginTop: 4,
  },
  detailAmountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    marginTop: 8,
  },
  detailAmountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  detailInfoBox: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailRowLabel: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  detailRowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  detailDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 6,
  },
  detailNotesText: {
    fontSize: 12,
    color: tokens.colors.onBackground,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  deleteExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 11,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    marginBottom: 20,
  },
  deleteExpenseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.statusError,
  },
})

export default ExpensesScreen
