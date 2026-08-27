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

    public function rules(): array
    {
        return [
            'client_mutation_id' => ['nullable', 'string', 'max:100'],
            'variant_id'         => ['required', 'uuid', 'exists:product_variants,id'],
            'current_quantity'   => ['nullable', 'integer', 'min:0'],
            'new_quantity'       => ['required', 'integer', 'min:0'],
            'difference'         => ['nullable', 'integer'],
            'reason'             => ['required', 'string', 'in:Damaged,Audit,Restock,Return,Shrinkage'],
            'notes'              => ['nullable', 'string'],
            'adjusted_at'        => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'variant_id.required'       => 'Variant ID is required.',
            'variant_id.exists'         => 'Selected product variant does not exist.',
            'current_quantity.integer'  => 'Current quantity must be an integer.',
            'current_quantity.min'      => 'Current quantity cannot be negative.',
            'new_quantity.required'     => 'New quantity is required.',
            'new_quantity.min'          => 'New quantity cannot be negative.',
            'reason.required'           => 'Adjustment reason is required.',
            'reason.in'                 => 'Reason must be one of: Damaged, Audit, Restock, Return, Shrinkage.',
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
