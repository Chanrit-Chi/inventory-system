import { round2 } from '../../utils/money'
import type { SalesChannel, Customer, DeliveryCompany, DeliveryZone, BankAccount, CartItem } from '../../types'

export function getChannelDisplayName(channel?: SalesChannel | null): string {
  if (!channel) return 'In-Store POS'
  return channel.name || 'In-Store POS'
}

export function calculateDeliveryFee(
  fulfillmentType: 'store_pickup' | 'delivery',
  zone?: DeliveryZone | null
): number {
  if (fulfillmentType !== 'delivery' || !zone) return 0
  return zone.cost ? Number(zone.cost) : 0
}

export function buildOrderPayload(params: {
  cart: CartItem[]
  total: number
  paymentMethod: string
  activeChannel?: SalesChannel | null
  customer?: Customer | null
  fulfillmentType: 'store_pickup' | 'delivery'
  deliveryCompany?: DeliveryCompany | null
  deliveryZone?: DeliveryZone | null
  deliveryAddress?: string
  bankAccount?: BankAccount | null
  notes?: string
}) {
  const {
    cart,
    total,
    paymentMethod,
    activeChannel,
    customer,
    fulfillmentType,
    deliveryCompany,
    deliveryZone,
    deliveryAddress,
    bankAccount,
    notes,
  } = params

  const items = cart.map((item) => ({
    variant_id: item.variantId,
    product_name: item.productName,
    sku: item.sku,
    unit_price: round2(item.unitPrice),
    quantity: item.quantity,
    total_price: round2(item.unitPrice * item.quantity),
  }))

  const deliveryFee = calculateDeliveryFee(fulfillmentType, deliveryZone)

  return {
    customer_id: customer?.id || undefined,
    customer_name: customer?.name || undefined,
    customer_phone: customer?.phone || undefined,
    channel_id: activeChannel?.id || undefined,
    payment_method: paymentMethod,
    bank_account_id: bankAccount?.id || undefined,
    fulfillment_type: fulfillmentType,
    delivery_company_id: deliveryCompany?.id || undefined,
    delivery_zone_id: deliveryZone?.id || undefined,
    delivery_address: deliveryAddress || undefined,
    delivery_fee: deliveryFee,
    notes: notes || undefined,
    items,
    total_amount: round2(total + deliveryFee),
  }
}
