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

        // 3. Delimiter match (e.g. tag barcode "12345-03", "12345_01", "12345/A" -> "12345")
        if (preg_match('/^([a-zA-Z0-9]{3,})[-_\/\s]/', $code, $matches)) {
            $baseCode = $matches[1];

            // Check variant with baseCode
            $delimVariant = ProductVariant::where(function ($q) use ($baseCode) {
                $q->where('barcode', $baseCode)->orWhere('sku', $baseCode);
            })
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->with(['product', 'attributeValues.attribute'])
                ->first();

            if ($delimVariant !== null) {
                return [
                    'type'    => 'variant',
                    'variant' => $delimVariant,
                    'product' => $delimVariant->product,
                ];
            }

            // Check master product with baseCode
            $delimProduct = Product::where('barcode', $baseCode)
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->with([
                    'variants' => fn ($q) => $q->where('is_active', true)->whereNull('deleted_at'),
                    'variants.attributeValues.attribute',
                ])
                ->first();

            if ($delimProduct !== null) {
                return [
                    'type'     => 'product',
                    'product'  => $delimProduct,
                    'variants' => $delimProduct->variants,
                ];
            }
        }

        // 4. Longest Prefix Match (e.g. Tag "1234567" matches Master Product barcode "12345")
        // Minimum prefix length of 4 characters to prevent false-positive over-matching
        if (strlen($code) >= 4) {
            // 4a. Check master products where scanned code starts with product.barcode
            $candidateProducts = Product::whereNotNull('barcode')
                ->where('barcode', '!=', '')
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->with([
                    'variants' => fn ($q) => $q->where('is_active', true)->whereNull('deleted_at'),
                    'variants.attributeValues.attribute',
                ])
                ->get()
                ->filter(function ($p) use ($code) {
                    $pCode = trim((string) $p->barcode);
                    return strlen($pCode) >= 4 && str_starts_with($code, $pCode);
                })
                ->sortByDesc(fn ($p) => strlen(trim((string) $p->barcode)))
                ->values();

            if ($candidateProducts->isNotEmpty()) {
                $bestMatch = $candidateProducts->first();
                return [
                    'type'     => 'product',
                    'product'  => $bestMatch,
                    'variants' => $bestMatch->variants,
                ];
            }

            // 4b. Check variants where scanned code starts with variant.barcode or variant.sku
            $candidateVariants = ProductVariant::whereNotNull('barcode')
                ->where('barcode', '!=', '')
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->with(['product', 'attributeValues.attribute'])
                ->get()
                ->filter(function ($v) use ($code) {
                    $vCode = trim((string) $v->barcode);
                    return strlen($vCode) >= 4 && str_starts_with($code, $vCode);
                })
                ->sortByDesc(fn ($v) => strlen(trim((string) $v->barcode)))
                ->values();

            if ($candidateVariants->isNotEmpty()) {
                $bestVariant = $candidateVariants->first();
                return [
                    'type'    => 'variant',
                    'variant' => $bestVariant,
                    'product' => $bestVariant->product,
                ];
            }
        }

        throw new ModelNotFoundException("No product or variant found for code: '{$code}'.");
    }
}
