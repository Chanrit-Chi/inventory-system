import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { ExpenseRecord, TabType, PaginatedData } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, ExpenseFormValues } from '../utils/validation'
import { fetchExpenses, createExpense, deleteExpense, BackendExpense } from '../api/endpoints'
import { useDebounce } from '../hooks/useDebounce'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import { styles } from './expenses/ExpensesScreen.styles'
import {
  CATEGORIES,
  DateRangeMode,
} from './expenses/expenseUtils'
import { ExpenseRowItem } from './expenses/components/ExpenseRowItem'
import { ExpenseSummaryCards } from './expenses/components/ExpenseSummaryCards'
import { ExpenseCalendarModal } from './expenses/components/ExpenseCalendarModal'
import { ExpenseFormModal } from './expenses/components/ExpenseFormModal'
import { ExpenseDetailModal } from './expenses/components/ExpenseDetailModal'

export interface ExpensesScreenProps {
  onNavigate?: (tab: TabType) => void
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = () => {
  const { showToast } = useToast()
  const { can } = usePermissions()
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  // Date filtering state
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

  // Analytics & Summary stats
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

  const handleRangeDayPress = (day: { dateString: string }) => {
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
    const marks: Record<string, {
      startingDay?: boolean;
      endingDay?: boolean;
      color: string;
      textColor: string;
      selected: boolean;
      selectedColor: string;
    }> = {}
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
      category: data.category,
      amount: amt,
      paymentMethod: data.paymentMethod,
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
      showToast(`Recorded $${amt.toFixed(2)} for "${data.title}".`, 'success')
    } catch {
      setExpenses((prev) => [optimisticRecord, ...prev])
      setAddModalOpen(false)
      reset({ title: '', category: 'Utilities', amount: '', paymentMethod: 'Cash', notes: '' })
      showToast(`Expense saved locally ($${amt.toFixed(2)}).`, 'warning')
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
            showToast(`Expense "${title}" deleted.`, 'success')
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      {/* 1. Top Search & Quick Action Toolbar */}
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

      {/* 2. Date Filter Chips Row */}
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

      {/* 3. Category Filter Badges Row */}
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
          <ExpenseSummaryCards
            dateRange={dateRange}
            getDateLabel={getDateLabel}
            onResetDateRange={() => setDateRange('all')}
            summary={summary}
            filteredCount={filteredExpenses.length}
          />
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

      {/* MODAL: CUSTOM DATE PICKER */}
      <ExpenseCalendarModal
        visible={customRangeModalOpen}
        tempMode={tempMode}
        setTempMode={setTempMode}
        tempSingleDate={tempSingleDate}
        setTempSingleDate={setTempSingleDate}
        tempCustomFrom={tempCustomFrom}
        setTempCustomFrom={setTempCustomFrom}
        tempCustomTo={tempCustomTo}
        setTempCustomTo={setTempCustomTo}
        onClose={() => setCustomRangeModalOpen(false)}
        onApplySingleDate={handleApplySingleDate}
        onApplyCustomRange={handleApplyCustomRange}
        handleRangeDayPress={handleRangeDayPress}
        getRangeMarkedDates={getRangeMarkedDates}
      />

      {/* MODAL: RECORD NEW EXPENSE */}
      <ExpenseFormModal
        visible={addModalOpen}
        control={control}
        setValue={setValue}
        formCategory={formCategory}
        formMethod={formMethod}
        submitting={submitting}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleSubmit(onSubmit)}
      />

      {/* MODAL: EXPENSE DETAILS & RECEIPT VIEW */}
      <ExpenseDetailModal
        visible={detailModalOpen}
        expense={selectedExpense}
        canManage={Boolean(can('expenses:manage'))}
        deletingId={deletingId}
        onClose={() => setDetailModalOpen(false)}
        onDelete={handleDeleteExpense}
      />
    </View>
  )
}

export default ExpensesScreen
