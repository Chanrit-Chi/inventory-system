<?php

namespace App\Http\Requests\Api\V1;

use App\Traits\ApiResponseTrait;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class CheckoutRequest extends FormRequest
{
    use ApiResponseTrait;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_mutation_id'    => ['required', 'string', 'max:100'],
            'channel_id'            => ['required', 'uuid', 'exists:sales_channels,id,is_active,1'],
            'items'                 => ['required', 'array', 'min:1'],
            'items.*.variant_id'    => ['required', 'string', 'max:100'],
            'items.*.quantity'      => ['required', 'integer', 'min:1'],
            'items.*.unit_price'    => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount'      => ['nullable', 'numeric', 'min:0'],
            'payment_method'        => ['required', 'string', 'max:50'],
            'payment_amount'        => ['required', 'numeric', 'min:0'],
            'customer'              => ['nullable', 'array'],
            'customer.name'         => ['nullable', 'string', 'max:150'],
            'customer.phone'        => ['nullable', 'string', 'max:50'],
            'discount'              => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'tax_type'              => ['nullable', 'string', 'in:flat,percentage,percent'],
            'tax_rate'              => ['nullable', 'numeric', 'min:0'],
            'tax_amount'            => ['nullable', 'numeric', 'min:0'],
            'delivery_cost'         => ['nullable', 'numeric', 'min:0'],
            'delivery_address'      => ['nullable', 'string'],
            'region'                => ['nullable', 'string', 'max:100'],
            'note'                  => ['nullable', 'string'],
            'transaction_ref'       => ['nullable', 'string', 'max:100'],
            'seller_id'             => ['nullable', 'uuid', 'exists:users,id'],
            'status'                => ['nullable', 'string', 'in:paid,pending,completed,PAID,PENDING,COMPLETED'],
            'payment_status'        => ['nullable', 'string', 'in:paid,pending,PAID,PENDING'],
        ];
    }

    public function messages(): array
    {
        return [
            'client_mutation_id.required'   => 'A unique mutation ID is required for idempotency.',
            'channel_id.required'           => 'A sales channel is required.',
            'items.required'                => 'At least one item is required.',
            'items.min'                     => 'At least one item is required.',
            'payment_method.required'       => 'Payment method is required.',
            'payment_amount.required'       => 'Payment amount is required.',
        ];
    }

    public function after(): array
    {
        return [
            function (\Illuminate\Validation\Validator $validator) {
                $taxType = $this->input('tax_type');
                if ($taxType === 'percentage' && $this->input('tax_rate') > 100) {
                    $validator->errors()->add('tax_rate', 'Tax rate cannot exceed 100%.');
                }
            },
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
