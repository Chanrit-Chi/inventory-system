<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class BarcodeScannerService
{
    /**
     * Resolve a barcode or SKU string to a variant or parent product.
     *
     * @param  string  $code
     * @return array{type: 'variant'|'product', variant?: ProductVariant, product: Product, variants?: \Illuminate\Database\Eloquent\Collection}
     *
     * @throws ModelNotFoundException
     */
    public function scan(string $code): array
    {
        $code = trim($code);

        // 1. Try direct variant match by barcode or SKU
        $variant = ProductVariant::where(function ($q) use ($code) {
            $q->where('barcode', $code)->orWhere('sku', $code);
        })
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->with(['product', 'attributeValues.attribute'])
            ->first();

        if ($variant !== null) {
            return [
                'type'    => 'variant',
                'variant' => $variant,
                'product' => $variant->product,
            ];
        }

        // 2. Try master product barcode (expands to all active variants)
        $product = Product::where('barcode', $code)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->with([
                'variants' => fn ($q) => $q->where('is_active', true)->whereNull('deleted_at'),
                'variants.attributeValues.attribute',
            ])
            ->first();

        if ($product !== null) {
            return [
                'type'     => 'product',
                'product'  => $product,
                'variants' => $product->variants,
            ];
        }

        throw new ModelNotFoundException("No product or variant found for code: '{$code}'.");
    }
}
