import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import { checkoutOrder, updateOrderStatus, updateOrder } from '../../api/endpoints'
import type { CheckoutPayload, Order } from '../../types'

/**
 * Mutation for POS Checkout with automatic cache invalidation
 */
export function useCheckoutMutation() {
  const queryClient = useQueryClient()

  return useMutation<Order, Error, CheckoutPayload>({
    mutationFn: (payload: CheckoutPayload) => checkoutOrder(payload),
    onSuccess: (newOrder) => {
      // Invalidate orders list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      // Invalidate product inventory counts
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      // If customer was updated or created, invalidate customers
      if (newOrder.customer_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      }
    },
  })
}

/**
 * Mutation for updating order status (COMPLETED, PENDING, CANCELLED)
 */
export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation<
    Order,
    Error,
    { id: string; status: 'completed' | 'pending' | 'cancelled' | string; paymentMethod?: string; notes?: string }
  >({
    mutationFn: ({ id, status, paymentMethod, notes }) => updateOrderStatus(id, status, paymentMethod, notes),
    onSuccess: (updatedOrder, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

/**
 * Mutation for updating order notes and metadata
 */
export function useUpdateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation<
    Order,
    Error,
    { id: string; payload: { status?: string; payment_method?: string; notes?: string; delivery_address?: string; region?: string } }
  >({
    mutationFn: ({ id, payload }) => updateOrder(id, payload),
    onSuccess: (updatedOrder, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.id) })
    },
  })
}
