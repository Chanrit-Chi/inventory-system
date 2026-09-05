<?php

namespace App\Services;

use App\Enums\MovementType;
use App\Enums\OrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutService
{
    /**
     * Process an idempotent checkout transaction.
     *
     * @param  array{
     *   client_mutation_id: string,
     *   channel_id: string,
     *   items: array<int, array{variant_id: string, quantity: int, unit_price: float}>,
     *   payment_method: string,
     *   payment_amount: float,
     *   customer?: array{name?: string, phone?: string}|null,
     *   discount?: float,
     *   delivery_cost?: float,
     *   delivery_address?: string,
     *   region?: string,
     *   note?: string,
     *   transaction_ref?: string,
     * }  $data
     * @param  User|null  $actor  The authenticated staff member processing the sale
     * @return Order
     *
     * @throws \Exception
     */
    public function checkout(array $data, ?User $actor = null): Order
    {
        // --- Idempotency check ---
        $existing = Order::where('client_mutation_id', $data['client_mutation_id'])
            ->with(['items.variant', 'payments', 'customer', 'channel'])
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        try {
            return DB::transaction(function () use ($data, $actor): Order {
                $items        = $data['items'];
                $discount     = (float) ($data['discount'] ?? 0);
                $deliveryCost = (float) ($data['delivery_cost'] ?? 0);

                // --- Lock variants & validate stock ---
                $rawVariantIds = array_unique(array_column($items, 'variant_id'));
                
                $existingVariants = ProductVariant::whereIn('id', $rawVariantIds)
                    ->with('product')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                // Resolve variant IDs — try by UUID first, then by SKU/barcode
                foreach ($items as &$item) {
                    $vid = $item['variant_id'];
                    if (!$existingVariants->has($vid)) {
                        // Try SKU/barcode lookup for quotation-converted items
                        $bySku = ProductVariant::where('sku', $vid)
                            ->orWhere('barcode', $vid)
                            ->with('product')
                            ->lockForUpdate()
                            ->first();
                        if ($bySku) {
                            $item['variant_id'] = $bySku->id;
                            $existingVariants->put($bySku->id, $bySku);
                        } else {
                            throw new \Exception(
                                "Unknown product variant: '{$vid}'. "
                                . 'Item could not be matched by ID, SKU, or barcode.'
                            );
                        }
                    }
                }
                unset($item);

                $variants = $existingVariants;

                $itemQuantities = [];
                foreach ($items as $item) {
                    $vid = $item['variant_id'];
                    $itemQuantities[$vid] = ($itemQuantities[$vid] ?? 0) + $item['quantity'];
                }

                foreach ($itemQuantities as $vid => $totalQty) {
                    $variant = $variants->get($vid)
                        ?? throw new \Exception("Variant {$vid} not found.");

                    // Real catalog variants must have sufficient stock; overselling
                    // is rejected and rolls back the whole order.
                    if ($variant->quantity_on_hand < $totalQty) {
                        throw new \Exception(
                            "Insufficient stock for {$variant->sku}: requested {$totalQty}, available {$variant->quantity_on_hand}."
                        );
                    }
                }

                // --- Generate order number ---
                $orderNumber = Order::generateOrderNumber();

                // --- Upsert customer ---
                $customerId = null;
                if (!empty($data['customer']['phone'])) {
                    $customerData = $data['customer'];
                    $customer = Customer::lockForUpdate()->firstOrCreate(
                        ['phone' => $customerData['phone']],
                        ['name'  => $customerData['name'] ?? $customerData['phone']]
                    );
                    // Atomic increment avoids read-modify-write race
                    $customer->increment('total_purchased');
                    $customerId = $customer->id;
                }

                // --- Calculate financials with precise decimal arithmetic ---
                $subtotal = 0.0;
                $processedItems = [];

                foreach ($items as $item) {
                    $variant = $variants->get($item['variant_id']);
                    $basePrice = (float) $variant->effective_selling_price;
                    $effectiveUnitPrice = isset($item['unit_price']) && is_numeric($item['unit_price']) && (float)$item['unit_price'] >= 0
                        ? (float) $item['unit_price']
                        : $basePrice;

                    $qty = (int) $item['quantity'];
                    $lineDiscount = (float) ($item['discount_amount'] ?? $item['discount'] ?? 0);
                    $lineSubtotal = function_exists('bcmul')
                        ? (float) bcmul((string) $effectiveUnitPrice, (string) $qty, 2)
                        : round($effectiveUnitPrice * $qty, 2);
                    $lineFinal = function_exists('bcsub')
                        ? max(0.0, (float) bcsub((string) $lineSubtotal, (string) $lineDiscount, 2))
                        : max(0.0, round($lineSubtotal - $lineDiscount, 2));

                    $subtotal = function_exists('bcadd')
                        ? (float) bcadd((string) $subtotal, (string) $lineFinal, 2)
                        : round($subtotal + $lineFinal, 2);

                    $processedItems[] = [
                        'variant'         => $variant,
                        'quantity'        => $qty,
                        'unit_price'      => $effectiveUnitPrice,
                        'subtotal'        => $lineSubtotal,
                        'discount_amount' => $lineDiscount,
                        'total_price'     => $lineFinal,
                        'final_amount'    => $lineFinal,
                    ];
                }

                $taxType = $data['tax_type'] ?? (isset($data['tax_amount']) && !isset($data['tax_rate']) ? 'flat' : 'percentage');
                if ($taxType === 'flat') {
                    $taxAmount = (float) ($data['tax_amount'] ?? $data['tax_rate'] ?? 0);
                    $taxRate = $subtotal > 0 ? round(($taxAmount / $subtotal) * 100, 2) : 0.0;
                } else {
                    $taxRate = (float) ($data['tax_rate'] ?? 0);
                    $taxAmount = round($subtotal * ($taxRate / 100), 2);
                }
                $taxAmount = max(0.0, $taxAmount);
                $taxRate = max(0.0, $taxRate);

                $totalAmount = round($subtotal - $discount + $deliveryCost + $taxAmount, 2);

                // Prevent negative order totals from over-discounting
                if ($totalAmount < 0) {
                    throw new \Exception(
                        'Discount exceeds order total. Subtotal: ' . $subtotal
                        . ', Discount: ' . $discount
                        . '. Reduce the discount amount.'
                    );
                }

                // --- Validate payment amount >= total amount ---
                $paidAmount = (float) ($data['payment_amount'] ?? 0);
                if ($paidAmount < $totalAmount) {
                    throw new \Exception('Payment amount insufficient. Required: ' . $totalAmount . ', Received: ' . $paidAmount . '. Adjust payment_amount or apply additional discount.');
                }

                $statusInput = strtolower($data['status'] ?? $data['payment_status'] ?? 'paid');
                $isPending = $statusInput === 'pending';

                $orderStatus = $isPending ? OrderStatus::PENDING->value : OrderStatus::COMPLETED->value;
                $paymentStatus = $isPending ? 'PENDING' : 'PAID';
                $completedAt = $isPending ? null : now();
                $paymentRecordStatus = $isPending ? 'pending' : 'completed';

                // --- Create Order ---
                try {
                    $order = Order::create([
                        'order_number'       => $orderNumber,
                        'client_mutation_id' => $data['client_mutation_id'],
                        'customer_id'        => $customerId,
                        'channel_id'         => $data['channel_id'],
                        'user_id'            => $actor?->id,
                        'seller_id'          => $data['seller_id'] ?? null,
                        'status'             => $orderStatus,
                        'completed_at'       => $completedAt,
                        'payment_status'     => $paymentStatus,
                        'subtotal'           => $subtotal,
                        'tax_rate'           => $taxRate,
                        'tax_amount'         => $taxAmount,
                        'discount'           => $discount,
                        'delivery_cost'      => $deliveryCost,
                        'total_amount'       => $totalAmount,
                        'delivery_address'   => $data['delivery_address'] ?? null,
                        'region'             => $data['region'] ?? null,
                        'note'               => $data['note'] ?? null,
                    ]);
                } catch (\Illuminate\Database\QueryException $e) {
                    $existing = Order::where('client_mutation_id', $data['client_mutation_id'])
                        ->with(['items.variant', 'payments', 'customer', 'channel'])
                        ->first();
                    if ($existing !== null) {
                        return $existing;
                    }
                    throw $e;
                }

                // --- Create OrderItems, decrement stock, write StockMovements ---
                foreach ($processedItems as $pItem) {
                    $variant      = $pItem['variant'];
                    $qtyBefore    = $variant->quantity_on_hand;
                    $qtyAfter     = $qtyBefore - $pItem['quantity'];

                    // Decrement
                    $variant->decrement('quantity_on_hand', $pItem['quantity']);

                    OrderItem::create([
                        'order_id'        => $order->id,
                        'product_id'      => $variant->product_id,
                        'variant_id'      => $variant->id,
                        'quantity'        => $pItem['quantity'],
                        'unit_price'      => $pItem['unit_price'],
                        'subtotal'        => $pItem['subtotal'],
                        'discount_amount' => $pItem['discount_amount'],
                        'total_price'     => $pItem['total_price'],
                        'final_amount'    => $pItem['final_amount'],
                    ]);

                    StockMovement::create([
                        'variant_id'      => $variant->id,
                        'movement_type'   => MovementType::SALE->value,
                        'quantity_change' => -$pItem['quantity'],
                        'quantity_before' => $qtyBefore,
                        'quantity_after'  => $qtyAfter,
                        'reference_id'    => $orderNumber,
                        'notes'           => "Sale via order {$orderNumber}",
                    ]);
                }

                // --- Create Payment ---
                Payment::create([
                    'order_id'        => $order->id,
                    'payment_method'  => $data['payment_method'],
                    'amount'          => $data['payment_amount'],
                    'status'          => $paymentRecordStatus,
                    'transaction_ref' => $data['transaction_ref'] ?? null,
                ]);

                // --- Update customer spend & default address ---
                if ($customerId) {
                    $roundedTotal = round((float) $totalAmount, 2);
                    $customerUpdateData = [
                        'total_spent'      => DB::raw("ROUND(total_spent + {$roundedTotal}, 2)"),
                        'last_purchase_at' => now(),
                    ];
                    if (!empty($data['delivery_address'])) {
                        $customerUpdateData['address'] = $data['delivery_address'];
                    }
                    Customer::where('id', $customerId)->update($customerUpdateData);
                }

                $loadedOrder = $order->load(['items.variant', 'payments', 'customer', 'channel']);
                \App\Events\OrderPlaced::dispatch($loadedOrder);

                return $loadedOrder;
            });
        } catch (\Illuminate\Database\QueryException $e) {
            $existing = Order::where('client_mutation_id', $data['client_mutation_id'])
                ->with(['items.variant', 'payments', 'customer', 'channel'])
                ->first();
            if ($existing !== null) {
                return $existing;
            }
            throw $e;
        }
    }
}
