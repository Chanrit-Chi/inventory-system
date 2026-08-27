<?php

namespace App\Http\Requests\Api\V1;

use App\Traits\ApiResponseTrait;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreQuotationRequest extends FormRequest
{
    use ApiResponseTrait;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id'      => ['nullable', 'uuid', 'exists:customers,id'],
            'customer_name'    => ['required', 'string', 'max:150'],
            'customer_phone'   => ['nullable', 'string', 'max:50'],
            'customer_email'   => ['nullable', 'email', 'max:150'],
            'discount'         => ['nullable', 'numeric', 'min:0'],
            'notes'            => ['nullable', 'string', 'max:1000'],
            'valid_until'      => ['nullable', 'date'],
            'items'            => ['required', 'array', 'min:1'],
            'items.*.variant_id'   => ['nullable', 'uuid'],
            'items.*.product_name' => ['required', 'string', 'max:255'],
            'items.*.sku'          => ['nullable', 'string', 'max:100'],
            'items.*.quantity'     => ['required', 'integer', 'min:1'],
            'items.*.unit_price'   => ['required', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_name.required' => 'Customer name is required.',
            'items.required'         => 'At least one item is required in the quotation.',
            'items.min'              => 'At least one item is required in the quotation.',
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
