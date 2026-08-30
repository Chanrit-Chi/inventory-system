import React from 'react'
import { TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../QuotationsScreen.styles'
import { GenericFilterBar, FilterChipItem } from '../../../components/common/GenericFilterBar'

export interface QuotationFilterToolbarProps {
  search: string
  setSearch: (s: string) => void
  statusFilter: string
  setStatusFilter: (s: string) => void
  canCreateQuote: boolean
  onOpenCreateModal: () => void
}

const QUOTATION_CHIPS: FilterChipItem[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SENT', label: 'Sent' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'CONVERTED', label: 'Converted' },
  { key: 'REJECTED', label: 'Rejected' },
]

export const QuotationFilterToolbar: React.FC<QuotationFilterToolbarProps> = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  canCreateQuote,
  onOpenCreateModal,
}) => {
  return (
    <GenericFilterBar
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search quote #, customer, phone, products..."
      chips={QUOTATION_CHIPS}
      activeChip={statusFilter}
      onSelectChip={setStatusFilter}
      rightSearchAction={
        canCreateQuote ? (
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={onOpenCreateModal}
            accessibilityLabel="New Quote"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        ) : null
      }
    />
  )
}
