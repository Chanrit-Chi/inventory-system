import React from 'react'
import { TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../InvoicesScreen.styles'
import { GenericFilterBar, FilterChipItem } from '../../../components/common/GenericFilterBar'

export interface InvoiceFilterBarProps {
  search: string
  setSearch: (s: string) => void
  statusFilter: string
  setStatusFilter: (s: string) => void
  canCreate: boolean
  onOpenCreate: () => void
}

const INVOICE_CHIPS: FilterChipItem[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ISSUED', label: 'Issued' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

export const InvoiceFilterBar: React.FC<InvoiceFilterBarProps> = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  canCreate,
  onOpenCreate,
}) => {
  return (
    <GenericFilterBar
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search invoices, customer, phone..."
      chips={INVOICE_CHIPS}
      activeChip={statusFilter}
      onSelectChip={setStatusFilter}
      rightSearchAction={
        canCreate ? (
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={onOpenCreate}
            accessibilityRole="button"
            accessibilityLabel="Create New Invoice"
          >
            <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        ) : null
      }
    />
  )
}
