import React, { useCallback, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { styles } from '../PayrollScreen.styles'
import { MONTH_NAMES } from '../payrollUtils'

interface FilterItem<T> {
  label: string
  value: T
}

function FilterChipBar<T extends string | number>({
  items,
  current,
  onSelect,
}: {
  items: FilterItem<T>[]
  current: T
  onSelect: (v: T) => void
}) {
  const listRef = React.useRef<FlatList>(null)

  const scrollToActive = useCallback(
    (index: number, animated = true) => {
      if (index >= 0) {
        try {
          listRef.current?.scrollToIndex({
            index,
            animated,
            viewPosition: 0.5,
          })
        } catch {
          // Handled by onScrollToIndexFailed
        }
      }
    },
    []
  )

  useEffect(() => {
    const idx = items.findIndex((it) => it.value === current)
    if (idx >= 0) {
      const timer = setTimeout(() => scrollToActive(idx, true), 120)
      return () => clearTimeout(timer)
    }
  }, [current, items, scrollToActive])

  return (
    <FlatList
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(it) => String(it.value)}
      contentContainerStyle={styles.filterRow}
      initialNumToRender={15}
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: info.index,
            animated: false,
            viewPosition: 0.5,
          })
        }, 120)
      }}
      renderItem={({ item }) => {
        const active = current === item.value
        return (
          <TouchableOpacity
            key={String(item.value)}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onSelect(item.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )
      }}
    />
  )
}

export interface PayrollFilterBarProps {
  filterMonth: number | 'ALL'
  setFilterMonth: (m: number | 'ALL') => void
  filterYear: number | 'ALL'
  setFilterYear: (y: number | 'ALL') => void
  availableYears: number[]
}

export const PayrollFilterBar: React.FC<PayrollFilterBarProps> = ({
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  availableYears,
}) => {
  return (
    <View style={styles.filterSection}>
      <FilterChipBar
        items={[
          { label: 'All Months', value: 'ALL' },
          ...MONTH_NAMES.map((m, i) => ({ label: m, value: (i + 1) as number | 'ALL' })),
        ]}
        current={filterMonth}
        onSelect={setFilterMonth}
      />
      <FilterChipBar
        items={[
          { label: 'All Years', value: 'ALL' },
          ...availableYears.map((y) => ({ label: String(y), value: y as number | 'ALL' })),
        ]}
        current={filterYear}
        onSelect={setFilterYear}
      />
    </View>
  )
}
