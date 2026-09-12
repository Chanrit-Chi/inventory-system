<?php

namespace App\Http\Requests\Api\V1;

use App\Traits\ApiResponseTrait;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StockAdjustmentRequest extends FormRequest
{
    use ApiResponseTrait;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $resolveVariant = function ($vId, $pId = null) {
            if (!empty($pId) && empty($vId)) {
                $product = \App\Models\Product::find($pId);
                if ($product) {
                    $variant = $product->variants()->first();
                    if (!$variant) {
                        $variant = \App\Models\ProductVariant::create([
                            'product_id'       => $product->id,
                            'name'             => 'Standard',
                            'sku'              => $product->sku ?: ('SKU-' . strtoupper(\Illuminate\Support\Str::random(6))),
                            'barcode'          => $product->barcode,
                            'cost_price'       => $product->purchase_price ?? $product->cost_price ?? 0,
                            'selling_price'    => $product->selling_price ?? 0,
                            'quantity_on_hand' => 0,
                            'reorder_level'    => $product->default_reorder_level ?? 5,
                            'is_active'        => true,
                        ]);
                    }
                    return $variant->id;
                }
            } elseif (!empty($vId)) {
                $exists = \App\Models\ProductVariant::where('id', $vId)->exists();
                if (!$exists) {
                    $product = \App\Models\Product::find($vId);
                    if ($product) {
                        $variant = $product->variants()->first();
                        if (!$variant) {
                            $variant = \App\Models\ProductVariant::create([
                                'product_id'       => $product->id,
                                'name'             => 'Standard',
                                'sku'              => $product->sku ?: ('SKU-' . strtoupper(\Illuminate\Support\Str::random(6))),
                                'barcode'          => $product->barcode,
                                'cost_price'       => $product->purchase_price ?? $product->cost_price ?? 0,
                                'selling_price'    => $product->selling_price ?? 0,
                                'quantity_on_hand' => 0,
                                'reorder_level'    => $product->default_reorder_level ?? 5,
                                'is_active'        => true,
                            ]);
                        }
                        return $variant->id;
                    }
                }
            }
            return $vId;
        };

        // Handle bulk items
        if ($this->has('items') && is_array($this->input('items'))) {
            $items = $this->input('items');
            foreach ($items as $idx => $item) {
                if (is_array($item)) {
                    $vId = $item['variant_id'] ?? null;
                    $pId = $item['product_id'] ?? null;
                    $items[$idx]['variant_id'] = $resolveVariant($vId, $pId);
                }
            }
            $this->merge(['items' => $items]);
        } else {
            // Handle single item
            $resolved = $resolveVariant($this->input('variant_id'), $this->input('product_id'));
            if ($resolved) {
                $this->merge(['variant_id' => $resolved]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'client_mutation_id' => ['nullable', 'string', 'max:100'],
            'variant_id'         => ['required_without:items', 'nullable', 'uuid', 'exists:product_variants,id'],
            'current_quantity'   => ['nullable', 'integer', 'min:0'],
            'new_quantity'       => ['required_without:items', 'nullable', 'integer', 'min:0'],
            'difference'         => ['nullable', 'integer'],
            'reason'             => ['required_without:items', 'nullable', 'string', 'in:Damaged,Audit,Restock,Return,Shrinkage'],
            'notes'              => ['nullable', 'string'],
            'adjusted_at'        => ['nullable', 'date'],

            // Bulk items support
            'items'                    => ['nullable', 'array'],
            'items.*.variant_id'       => ['required', 'uuid', 'exists:product_variants,id'],
            'items.*.current_quantity' => ['nullable', 'integer', 'min:0'],
            'items.*.new_quantity'     => ['required', 'integer', 'min:0'],
            'items.*.difference'       => ['nullable', 'integer'],
            'items.*.reason'           => ['nullable', 'string', 'in:Damaged,Audit,Restock,Return,Shrinkage'],
            'items.*.notes'            => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'variant_id.required'          => 'Variant ID is required.',
            'variant_id.required_without'  => 'Variant ID is required when items list is not provided.',
            'variant_id.exists'            => 'Selected product variant does not exist.',
            'current_quantity.integer'     => 'Current quantity must be an integer.',
            'current_quantity.min'         => 'Current quantity cannot be negative.',
            'new_quantity.required'        => 'New quantity is required.',
            'new_quantity.required_without'=> 'New quantity is required when items list is not provided.',
            'new_quantity.min'             => 'New quantity cannot be negative.',
            'reason.required'              => 'Adjustment reason is required.',
            'reason.required_without'      => 'Adjustment reason is required when items list is not provided.',
            'reason.in'                    => 'Reason must be one of: Damaged, Audit, Restock, Return, Shrinkage.',
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
