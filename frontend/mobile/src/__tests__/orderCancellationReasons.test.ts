export const CANCELLATION_REASONS = [
  'Customer changed mind',
  'Wrong item / order mistake',
  'Defective / damaged item',
  'Payment issue / failed transaction',
  'Duplicate order',
  'Other reason',
] as const

export function formatCancellationReason(selectedReason: string, customNotes?: string): string {
  const trimmed = (customNotes || '').trim()
  if (selectedReason === 'Other reason') {
    return trimmed || 'Other reason'
  }
  if (trimmed) {
    return `${selectedReason} - ${trimmed}`
  }
  return selectedReason
}

describe('Order Cancellation Reasons & Formatting', () => {
  it('includes standard pre-defined cancellation reasons', () => {
    expect(CANCELLATION_REASONS).toContain('Customer changed mind')
    expect(CANCELLATION_REASONS).toContain('Wrong item / order mistake')
    expect(CANCELLATION_REASONS).toContain('Defective / damaged item')
    expect(CANCELLATION_REASONS).toContain('Payment issue / failed transaction')
    expect(CANCELLATION_REASONS).toContain('Duplicate order')
    expect(CANCELLATION_REASONS).toContain('Other reason')
  })

  it('formats pre-defined reason without custom notes', () => {
    const reason = formatCancellationReason('Customer changed mind')
    expect(reason).toBe('Customer changed mind')
  })

  it('combines pre-defined reason with custom notes when provided', () => {
    const reason = formatCancellationReason('Wrong item / order mistake', 'Customer wanted XL instead of L')
    expect(reason).toBe('Wrong item / order mistake - Customer wanted XL instead of L')
  })

  it('uses custom notes directly when "Other reason" is selected', () => {
    const reason = formatCancellationReason('Other reason', 'Customer forgot wallet, will come back tomorrow')
    expect(reason).toBe('Customer forgot wallet, will come back tomorrow')
  })

  it('falls back to "Other reason" when "Other reason" is selected without notes', () => {
    const reason = formatCancellationReason('Other reason', '')
    expect(reason).toBe('Other reason')
  })

  it('ignores leading and trailing whitespace in notes', () => {
    const reason = formatCancellationReason('Customer changed mind', '   no cash   ')
    expect(reason).toBe('Customer changed mind - no cash')
  })
})
