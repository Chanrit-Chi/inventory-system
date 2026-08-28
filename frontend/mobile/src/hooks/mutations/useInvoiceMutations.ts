import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import {
  createInvoice,
  recordInvoicePayment,
  updateInvoiceStatus,
  deleteInvoice,
  createQuotation,
  updateQuotationStatus,
  convertQuotation,
  deleteQuotation,
} from '../../api/endpoints'
import type { InvoiceStatus, QuotationStatus } from '../../types'

/**
 * Record a payment on an invoice and invalidate invoice queries
 */
export function useRecordPaymentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      invoiceId,
      payload,
    }: {
      invoiceId: string
      payload: {
        amount: number
        payment_method: string
        transaction_ref?: string
        recorded_by?: string
        notes?: string
      }
    }) => recordInvoicePayment(invoiceId, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) })
    },
  })
}

/**
 * Convert a quotation to a sales order
 */
export function useConvertQuotationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (quotationId: string) => convertQuotation(quotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })
}

/**
 * Delete invoice mutation
 */
export function useDeleteInvoiceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })
}

/**
 * Delete quotation mutation
 */
export function useDeleteQuotationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteQuotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all })
    },
  })
}
