<?php

namespace App\Http\Requests\Api\V1;

use App\Traits\ApiResponseTrait;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreInvoiceRequest extends FormRequest
{
    use ApiResponseTrait;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_id'         => ['nullable', 'uuid', 'exists:orders,id'],
            'order_number'     => ['nullable', 'string', 'max:50'],
            'customer_id'      => ['nullable', 'uuid', 'exists:customers,id'],
            'customer_name'    => ['required', 'string', 'max:150'],
            'customer_phone'   => ['nullable', 'string', 'max:50'],
            'due_date'         => ['nullable', 'date'],
            'notes'            => ['nullable', 'string', 'max:1000'],
            'items'            => ['required', 'array', 'min:1'],
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
            'items.required'         => 'At least one line item is required.',
            'items.min'              => 'At least one line item is required.',
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
