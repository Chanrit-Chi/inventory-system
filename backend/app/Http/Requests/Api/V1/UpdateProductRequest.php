<?php

namespace App\Http\Requests\Api\V1;

use App\Traits\ApiResponseTrait;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateProductRequest extends FormRequest
{
    use ApiResponseTrait;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if ($this->has('is_active')) {
            $val = $this->input('is_active');
            if (is_string($val) || is_numeric($val) || is_bool($val)) {
                $converted = filter_var($val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($converted !== null) {
                    $merge['is_active'] = $converted;
                }
            }
        }
        if (is_string($this->input('variants'))) {
            $decoded = json_decode($this->input('variants'), true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $merge['variants'] = $decoded;
            }
        }
        if (is_string($this->input('attributes'))) {
            $decoded = json_decode($this->input('attributes'), true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $merge['attributes'] = $decoded;
            }
        }
        if ($merge) {
            $this->merge($merge);
        }
    }

    public function rules(): array
    {
        return [
            'name'                              => ['sometimes', 'string', 'max:255'],
            'barcode'                           => ['nullable', 'string', 'max:100'],
            'sku'                               => ['nullable', 'string', 'max:100'],
            'purchase_price'                    => ['sometimes', 'numeric', 'min:0'],
            'selling_price'                     => ['sometimes', 'numeric', 'min:0'],
            'default_reorder_level'             => ['nullable', 'integer', 'min:0'],
            'image_url'                         => ['nullable', 'string', 'max:2048'],
            'is_active'                         => ['boolean'],
            'category_id'                       => ['nullable', 'uuid', 'exists:product_categories,id'],
            'description'                       => ['nullable', 'string'],
            'quantity_on_hand'                  => ['nullable', 'integer', 'min:0'],
            'stock'                             => ['nullable', 'integer', 'min:0'],
            'simple_stock'                      => ['nullable', 'integer', 'min:0'],
            'variants'                          => ['nullable', 'array'],
            'variants.*.id'                     => ['nullable', 'string'],
            'variants.*.name'                   => ['nullable', 'string', 'max:255'],
            'variants.*.sku'                    => ['nullable', 'string', 'max:100'],
            'variants.*.barcode'                => ['nullable', 'string', 'max:100'],
            'variants.*.quantity_on_hand'       => ['nullable', 'integer', 'min:0'],
            'variants.*.stock'                  => ['nullable', 'integer', 'min:0'],
            'variants.*.selling_price'          => ['nullable', 'numeric', 'min:0'],
            'variants.*.cost_price'             => ['nullable', 'numeric', 'min:0'],
            'variants.*.selling_price_override' => ['nullable', 'numeric', 'min:0'],
            'variants.*.cost_price_override'    => ['nullable', 'numeric', 'min:0'],
            'variants.*.reorder_level'          => ['nullable', 'integer', 'min:0'],
            'variants.*.is_active'              => ['nullable', 'boolean'],
            'variants.*.attribute_values'       => ['nullable', 'array'],
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
