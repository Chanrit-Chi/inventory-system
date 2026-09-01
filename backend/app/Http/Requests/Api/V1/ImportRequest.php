<?php

namespace App\Http\Requests\Api\V1;

use App\Traits\ApiResponseTrait;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class ImportRequest extends FormRequest
{
    use ApiResponseTrait;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file'            => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
            'update_existing' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'An import file is required.',
            'file.mimes'    => 'The file must be an Excel (.xlsx, .xls) or CSV file.',
            'file.max'      => 'The file may not be larger than 10 MB.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('update_existing')) {
            $val = $this->input('update_existing');
            if (is_string($val) || is_numeric($val)) {
                $converted = filter_var($val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($converted !== null) {
                    $this->merge(['update_existing' => $converted]);
                }
            }
        }
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            $this->errorResponse('Validation failed.', $validator->errors()->toArray(), 422)
        );
    }
}
