<?php

namespace App\Services;

use App\Enums\MovementType;
use App\Enums\OrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\SalesChannel;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class ImportService
{
    private VariantGeneratorService $variantGenerator;

    public function __construct(VariantGeneratorService $variantGenerator)
    {
        $this->variantGenerator = $variantGenerator;
    }

    // -------------------------------------------------------------------------
    // Products Import
    // -------------------------------------------------------------------------

    /**
     * Import products from an XLSX/CSV file.
     *
     * Supports both Simple and Variable products:
     * - Rows sharing the same `name` or `parent_sku` are grouped into a single master product
     *   with multiple variants.
     * - Columns `variant_name` (or `variant`, `variable`) and `attributes` (e.g. "Color: Red | Size: M")
     *   are parsed, auto-creating attributes and linking them to variants.
     * - If `quantity` > 0, an opening RESTOCK stock movement is recorded for each variant.
     *
     * @return array{ imported: int, updated: int, skipped: int, errors: array }
     */
    public function importProducts(UploadedFile|string $file, User $actor, bool $updateExisting = false): array
    {
        $rows   = $this->readSheet($file);
        $result = ['imported' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];

        if (empty($rows)) {
            return $result;
        }

        // Group rows by parent product (by parent_sku or product name)
        $productGroups = [];
        foreach ($rows as $rowIndex => $row) {
            $lineNum = $rowIndex + 2; // 1-indexed, +1 for header row

            // Skip completely empty rows
            if (empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) {
                continue;
            }

            $name      = trim((string) ($row['name'] ?? $row['product_name'] ?? ''));
            $parentSku = trim((string) ($row['parent_sku'] ?? ''));

            if ($name === '' && $parentSku === '') {
                $result['errors'][] = ['row' => $lineNum, 'message' => 'Missing required product name or parent_sku.'];
                $result['skipped']++;
                continue;
            }

            // Fallback selling and purchase price check
            $purchasePrice = $row['purchase_price'] ?? $row['cost_price'] ?? null;
            $sellingPrice  = $row['selling_price'] ?? null;

            if (($purchasePrice === null || $purchasePrice === '') && ($sellingPrice === null || $sellingPrice === '')) {
                // If this is a subsequent variant row with same parent, it may inherit parent's price,
                // otherwise it's missing pricing
            }

            // Grouping key: parent_sku takes precedence, otherwise name
            $groupKey = $parentSku !== ''
                ? 'psku:' . strtolower($parentSku)
                : 'name:' . strtolower($name);

            if (!isset($productGroups[$groupKey])) {
                $productGroups[$groupKey] = [
                    'name'       => $name,
                    'parent_sku' => $parentSku,
                    'meta'       => $row,
                    'items'      => [],
                    'lines'      => [],
                ];
            } elseif ($productGroups[$groupKey]['name'] === '' && $name !== '') {
                $productGroups[$groupKey]['name'] = $name;
            }

            $productGroups[$groupKey]['items'][] = $row;
            $productGroups[$groupKey]['lines'][] = $lineNum;
        }

        // Process each product group
        foreach ($productGroups as $groupKey => $group) {
            $firstLine = $group['lines'][0];

            // Validate that we have prices either at group meta or per row
            $meta = $group['meta'];
            $defaultPurchase = $meta['purchase_price'] ?? $meta['cost_price'] ?? null;
            $defaultSelling  = $meta['selling_price'] ?? null;

            if (($defaultPurchase === null || $defaultPurchase === '') && ($defaultSelling === null || $defaultSelling === '')) {
                $result['errors'][] = ['row' => $firstLine, 'message' => "Missing required price columns (purchase_price, selling_price) for product \"{$group['name']}\"."];
                $result['skipped']++;
                continue;
            }

            try {
                $this->processProductGroup($group, $actor, $updateExisting, $result);
            } catch (\Throwable $e) {
                $result['errors'][] = ['row' => $firstLine, 'message' => $e->getMessage()];
                $result['skipped']++;
            }
        }

        return $result;
    }

    private function processProductGroup(array $group, User $actor, bool $updateExisting, array &$result): void
    {
        $meta      = $group['meta'];
        $items     = $group['items'];
        $lines     = $group['lines'];
        $firstLine = $lines[0];

        $name          = trim((string) ($group['name'] !== '' ? $group['name'] : ($meta['name'] ?? $meta['product_name'] ?? '')));
        $parentSku     = $group['parent_sku'] !== '' ? $group['parent_sku'] : null;
        $categoryName  = isset($meta['category']) && $meta['category'] !== '' ? trim((string) $meta['category']) : null;
        $purchasePrice = (float) ($meta['purchase_price'] ?? $meta['cost_price'] ?? 0);
        $sellingPrice  = (float) ($meta['selling_price'] ?? 0);
        $reorderLevel  = isset($meta['reorder_level']) && $meta['reorder_level'] !== '' ? (int) $meta['reorder_level'] : 5;
        $description   = isset($meta['description']) && $meta['description'] !== '' ? trim((string) $meta['description']) : null;
        $isActive      = isset($meta['is_active']) && $meta['is_active'] !== '' ? filter_var($meta['is_active'], FILTER_VALIDATE_BOOLEAN) : true;
        $productBarcode= isset($meta['barcode']) && $meta['barcode'] !== '' ? trim((string) $meta['barcode']) : null;

        $categoryId = $this->resolveCategory($categoryName);

        // Resolve product image URL if provided in row
        $rawImageUrl = null;
        foreach ($items as $item) {
            $candidate = $this->resolveImageUrl($item);
            if ($candidate) {
                $rawImageUrl = $candidate;
                break;
            }
        }
        if (!$rawImageUrl) {
            $rawImageUrl = $this->resolveImageUrl($meta);
        }

        // Gather all SKUs and barcodes in this group for duplicate/existing detection
        $groupSkus = [];
        $groupBarcodes = [];
        foreach ($items as $item) {
            if (!empty($item['sku'])) {
                $groupSkus[] = trim((string) $item['sku']);
            }
            if (!empty($item['barcode'])) {
                $groupBarcodes[] = trim((string) $item['barcode']);
            }
        }
        if ($parentSku) {
            $groupSkus[] = $parentSku;
        }

        // Duplicate detection:
        // 1. By variant SKU
        $existingProduct = null;
        if (!empty($groupSkus)) {
            $existingVariant = ProductVariant::withTrashed()->whereIn('sku', $groupSkus)->first();
            if ($existingVariant) {
                $existingProduct = $existingVariant->product()->withTrashed()->first();
            }
            if (!$existingProduct) {
                $existingProduct = Product::withTrashed()->whereIn('sku', $groupSkus)->first();
            }
        }
        // 2. By barcode
        if (!$existingProduct && !empty($groupBarcodes)) {
            $existingVariant = ProductVariant::withTrashed()->whereIn('barcode', $groupBarcodes)->first();
            if ($existingVariant) {
                $existingProduct = $existingVariant->product()->withTrashed()->first();
            }
            if (!$existingProduct) {
                $existingProduct = Product::withTrashed()->whereIn('barcode', $groupBarcodes)->first();
            }
        }
        // 3. By exact product name
        if (!$existingProduct && $name !== '') {
            $existingProduct = Product::withTrashed()->whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
        }

        if ($existingProduct) {
            if (!$updateExisting) {
                $result['errors'][] = ['row' => $firstLine, 'message' => "Duplicate product (SKU, barcode, or name already exists): \"{$name}\" — skipped."];
                $result['skipped']++;
                return;
            }

            // Download and store image if URL is provided
            $storedImageUrl = null;
            if ($rawImageUrl) {
                $storedImageUrl = $this->downloadAndStoreImage($rawImageUrl);
            }

            // Update existing master product and its variants
            DB::transaction(function () use (
                $existingProduct, $name, $purchasePrice, $sellingPrice, $reorderLevel,
                $description, $isActive, $categoryId, $storedImageUrl, $items, $lines, $actor
            ) {
                $updateData = [
                    'name'                  => $name,
                    'purchase_price'        => $purchasePrice,
                    'selling_price'         => $sellingPrice,
                    'default_reorder_level' => $reorderLevel,
                    'description'           => $description,
                    'is_active'             => $isActive,
                    'category_id'           => $categoryId,
                ];
                if ($storedImageUrl) {
                    $updateData['image_url'] = $storedImageUrl;
                }

                $existingProduct->update($updateData);

                $isMultiVariant = count($items) > 1;

                foreach ($items as $idx => $row) {
                    $vSku          = isset($row['sku']) && $row['sku'] !== '' ? trim((string) $row['sku']) : null;
                    $vBarcode      = isset($row['barcode']) && $row['barcode'] !== '' ? trim((string) $row['barcode']) : null;
                    $vCostPrice    = (float) ($row['purchase_price'] ?? $row['cost_price'] ?? $purchasePrice);
                    $vSellingPrice = (float) ($row['selling_price'] ?? $sellingPrice);
                    $vQuantity     = (int) ($row['quantity'] ?? $row['stock'] ?? 0);
                    $vReorder      = isset($row['reorder_level']) && $row['reorder_level'] !== '' ? (int) $row['reorder_level'] : $reorderLevel;
                    $vIsActive     = isset($row['is_active']) && $row['is_active'] !== '' ? filter_var($row['is_active'], FILTER_VALIDATE_BOOLEAN) : $isActive;

                    $attrString  = $row['attributes'] ?? $row['variant_options'] ?? $row['options'] ?? null;
                    $parsedAttrs = $this->parseAttributesString($attrString);
                    $vName       = $this->resolveVariantName($row, $parsedAttrs, $isMultiVariant, $idx);

                    // Find variant under existingProduct
                    $variant = null;
                    if ($vSku) {
                        $variant = $existingProduct->variants()->where('sku', $vSku)->first();
                    }
                    if (!$variant && $vBarcode) {
                        $variant = $existingProduct->variants()->where('barcode', $vBarcode)->first();
                    }
                    if (!$variant && $vName && $vName !== 'Standard') {
                        $variant = $existingProduct->variants()->where('name', $vName)->first();
                    }
                    if (!$variant && !$isMultiVariant) {
                        $variant = $existingProduct->variants()->first();
                    }

                    if ($variant) {
                        $variant->update([
                            'name'          => $vName,
                            'cost_price'    => $vCostPrice,
                            'selling_price' => $vSellingPrice,
                            'reorder_level' => $vReorder,
                            'is_active'     => $vIsActive,
                            'barcode'       => $vBarcode ?? $variant->barcode,
                        ]);
                    } else {
                        $finalSku = $vSku ?? $this->variantGenerator->generateUniqueSku(Str::slug($name . '-' . $vName));
                        $variant  = ProductVariant::create([
                            'product_id'       => $existingProduct->id,
                            'name'             => $vName,
                            'sku'              => $finalSku,
                            'barcode'          => $vBarcode,
                            'cost_price'       => $vCostPrice,
                            'selling_price'    => $vSellingPrice,
                            'quantity_on_hand' => $vQuantity,
                            'reorder_level'    => $vReorder,
                            'is_active'        => $vIsActive,
                        ]);

                        if ($vQuantity > 0) {
                            StockMovement::create([
                                'product_id'      => $existingProduct->id,
                                'variant_id'      => $variant->id,
                                'movement_type'   => MovementType::RESTOCK->value,
                                'quantity_change' => $vQuantity,
                                'quantity_before' => 0,
                                'quantity_after'  => $vQuantity,
                                'notes'           => 'Opening stock import (variant update)',
                                'user_id'         => $actor->id,
                                'created_by'      => $actor->id,
                                'created_at'      => now(),
                            ]);
                        }
                    }

                    if (!empty($parsedAttrs)) {
                        $this->variantGenerator->attachAttributeValuesToVariant($existingProduct, $variant, $parsedAttrs);
                    }
                }
            });

            $result['updated']++;
            return;
        }

        // Download and store image if URL is provided
        $storedImageUrl = null;
        if ($rawImageUrl) {
            $storedImageUrl = $this->downloadAndStoreImage($rawImageUrl);
        }

        // Create new master product + variants
        DB::transaction(function () use (
            $name, $parentSku, $productBarcode, $purchasePrice, $sellingPrice, $reorderLevel,
            $description, $isActive, $categoryId, $storedImageUrl, $items, $lines, $actor
        ) {
            $product = Product::create([
                'name'                  => $name,
                'sku'                   => $parentSku,
                'barcode'               => $productBarcode,
                'purchase_price'        => $purchasePrice,
                'selling_price'         => $sellingPrice,
                'default_reorder_level' => $reorderLevel,
                'description'           => $description,
                'image_url'             => $storedImageUrl,
                'is_active'             => $isActive,
                'category_id'           => $categoryId,
            ]);

            $isMultiVariant = count($items) > 1;

            foreach ($items as $idx => $row) {
                $vSku          = isset($row['sku']) && $row['sku'] !== '' ? trim((string) $row['sku']) : null;
                $vBarcode      = isset($row['barcode']) && $row['barcode'] !== '' ? trim((string) $row['barcode']) : null;
                $vCostPrice    = (float) ($row['purchase_price'] ?? $row['cost_price'] ?? $purchasePrice);
                $vSellingPrice = (float) ($row['selling_price'] ?? $sellingPrice);
                $vQuantity     = (int) ($row['quantity'] ?? $row['stock'] ?? 0);
                $vReorder      = isset($row['reorder_level']) && $row['reorder_level'] !== '' ? (int) $row['reorder_level'] : $reorderLevel;
                $vIsActive     = isset($row['is_active']) && $row['is_active'] !== '' ? filter_var($row['is_active'], FILTER_VALIDATE_BOOLEAN) : $isActive;

                $attrString  = $row['attributes'] ?? $row['variant_options'] ?? $row['options'] ?? null;
                $parsedAttrs = $this->parseAttributesString($attrString);
                $vName       = $this->resolveVariantName($row, $parsedAttrs, $isMultiVariant, $idx);

                // Variant SKU resolution
                $rawSku   = $vSku ?? (Str::slug($name . '-' . $vName) . '-' . strtoupper(Str::random(4)));
                $finalSku = $this->variantGenerator->generateUniqueSku($rawSku);

                $variant = ProductVariant::create([
                    'product_id'       => $product->id,
                    'name'             => $vName,
                    'sku'              => $finalSku,
                    'barcode'          => $vBarcode ?? ($isMultiVariant ? null : $productBarcode),
                    'cost_price'       => $vCostPrice,
                    'selling_price'    => $vSellingPrice,
                    'quantity_on_hand' => $vQuantity,
                    'reorder_level'    => $vReorder,
                    'is_active'        => $vIsActive,
                ]);

                if (!empty($parsedAttrs)) {
                    $this->variantGenerator->attachAttributeValuesToVariant($product, $variant, $parsedAttrs);
                }

                if ($vQuantity > 0) {
                    StockMovement::create([
                        'product_id'      => $product->id,
                        'variant_id'      => $variant->id,
                        'movement_type'   => MovementType::RESTOCK->value,
                        'quantity_change' => $vQuantity,
                        'quantity_before' => 0,
                        'quantity_after'  => $vQuantity,
                        'notes'           => 'Opening stock import',
                        'user_id'         => $actor->id,
                        'created_by'      => $actor->id,
                        'created_at'      => now(),
                    ]);
                }
            }
        });

        $result['imported']++;
    }

    /**
     * Resolve variant name from row values, parsed attributes, or default index.
     */
    private function resolveVariantName(array $row, array $parsedAttrs, bool $isMultiVariant, int $index = 0): string
    {
        $candidates = ['variant_name', 'variant', 'variable', 'variation'];
        foreach ($candidates as $key) {
            if (!empty($row[$key])) {
                return trim((string) $row[$key]);
            }
        }

        if (!empty($parsedAttrs)) {
            $valNames = array_column($parsedAttrs, 'value_name');
            if (!empty($valNames)) {
                return implode(' / ', $valNames);
            }
        }

        return $isMultiVariant ? ('Variant ' . ($index + 1)) : 'Standard';
    }

    /**
     * Parse attribute string (e.g. "Color: Red | Size: M" or "Color=Red; Size=M") into structured array.
     *
     * @return array<int, array{attribute_name: string, value_name: string}>
     */
    public function parseAttributesString(?string $str): array
    {
        if (empty($str)) {
            return [];
        }

        $pairs = [];
        $normalized = str_replace([';', '|'], "\n", $str);
        $lines = explode("\n", $normalized);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) {
                continue;
            }

            // Split by comma if multiple key-value pairs exist on the same line
            $segments = preg_split('/,\s*(?=[^,]+[:=])/', $line);
            foreach ($segments as $segment) {
                $segment = trim($segment);
                if (empty($segment)) {
                    continue;
                }

                if (str_contains($segment, ':')) {
                    [$key, $val] = explode(':', $segment, 2);
                } elseif (str_contains($segment, '=')) {
                    [$key, $val] = explode('=', $segment, 2);
                } else {
                    continue;
                }

                $key = trim($key);
                $val = trim($val);
                if ($key !== '' && $val !== '') {
                    $pairs[] = [
                        'attribute_name' => $key,
                        'value_name'     => $val,
                    ];
                }
            }
        }

        return $pairs;
    }

    /**
     * Resolve or auto-create a category by name.
     */
    private function resolveCategory(?string $categoryName): ?string
    {
        if (!$categoryName) {
            return null;
        }

        $existing = ProductCategory::where('name', $categoryName)->first();
        if ($existing) {
            return $existing->id;
        }

        $baseCode = Str::slug($categoryName);
        $code     = $baseCode;
        $attempt  = 1;
        while (ProductCategory::where('code', $code)->exists()) {
            $code = $baseCode . '-' . $attempt++;
        }

        $category = ProductCategory::create([
            'name' => $categoryName,
            'code' => $code,
        ]);

        return $category->id;
    }

    // -------------------------------------------------------------------------
    // Sales Import
    // -------------------------------------------------------------------------

    /**
     * Import historical sales orders from an XLSX/CSV file.
     *
     * Rows are grouped by `order_number` (or by order_date + customer_phone).
     * All statuses (PENDING, COMPLETED, CANCELLED, REFUNDED) are imported.
     * Historical sales do NOT decrement stock.
     *
     * @return array{ imported: int, skipped: int, errors: array }
     */
    public function importSales(UploadedFile $file, User $actor): array
    {
        $rows   = $this->readSheet($file);
        $result = ['imported' => 0, 'skipped' => 0, 'errors' => []];

        $required = ['order_date', 'channel_name', 'product_sku', 'quantity', 'unit_price'];

        // Group rows into orders
        $orderGroups = [];
        foreach ($rows as $rowIndex => $row) {
            $lineNum = $rowIndex + 2;

            if (empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) {
                continue;
            }

            $missing = [];
            foreach ($required as $col) {
                if (!isset($row[$col]) || $row[$col] === null || $row[$col] === '') {
                    $missing[] = $col;
                }
            }
            if (!empty($missing)) {
                $result['errors'][] = ['row' => $lineNum, 'message' => 'Missing required columns: ' . implode(', ', $missing)];
                $result['skipped']++;
                continue;
            }

            // Determine group key for multi-item orders
            $orderNumber = isset($row['order_number']) && $row['order_number'] !== ''
                ? trim((string) $row['order_number'])
                : null;

            $groupKey = $orderNumber
                ?? (trim((string) ($row['order_date'] ?? '')) . '|' . trim((string) ($row['customer_phone'] ?? '')) . '|' . trim((string) ($row['channel_name'] ?? '')));

            if (!isset($orderGroups[$groupKey])) {
                $orderGroups[$groupKey] = ['meta' => $row, 'items' => [], 'lines' => []];
            }
            $orderGroups[$groupKey]['items'][] = $row;
            $orderGroups[$groupKey]['lines'][] = $lineNum;
        }

        // Process each grouped order
        foreach ($orderGroups as $groupKey => $group) {
            $firstLine = $group['lines'][0];
            try {
                $this->processOrderGroup($group, $actor, $result);
            } catch (\Throwable $e) {
                $result['errors'][] = ['row' => $firstLine, 'message' => $e->getMessage()];
                $result['skipped']++;
            }
        }

        return $result;
    }

    private function processOrderGroup(array $group, User $actor, array &$result): void
    {
        $meta        = $group['meta'];
        $items       = $group['items'];
        $firstLine   = $group['lines'][0];

        // Resolve Sales Channel
        $channelName = trim((string) ($meta['channel_name'] ?? ''));
        $channel     = SalesChannel::whereRaw('LOWER(name) = ?', [strtolower($channelName)])->first();
        if (!$channel) {
            $result['errors'][] = ['row' => $firstLine, 'message' => "Sales channel not found: \"{$channelName}\". Please create it first."];
            $result['skipped']++;
            return;
        }

        // Parse order date
        $rawDate   = $meta['order_date'] ?? now()->toDateString();
        $orderDate = $this->parseDate($rawDate) ?? now();

        // Upsert customer
        $customer = null;
        $customerPhone = isset($meta['customer_phone']) && $meta['customer_phone'] !== '' ? trim((string) $meta['customer_phone']) : null;
        $customerEmail = isset($meta['customer_email']) && $meta['customer_email'] !== '' ? trim((string) $meta['customer_email']) : null;
        $customerName  = isset($meta['customer_name'])  && $meta['customer_name'] !== ''  ? trim((string) $meta['customer_name'])  : null;

        if ($customerPhone || $customerEmail) {
            $phoneNormalized = $customerPhone ? preg_replace('/\D/', '', $customerPhone) : null;

            $customer = null;
            if ($phoneNormalized) {
                $customer = Customer::where('phone_normalized', $phoneNormalized)->first();
            }
            if (!$customer && $customerEmail) {
                $customer = Customer::where('email', $customerEmail)->first();
            }
            if (!$customer) {
                $customer = Customer::create([
                    'name'  => $customerName ?? ($customerPhone ?? $customerEmail),
                    'phone' => $customerPhone,
                    'email' => $customerEmail,
                ]);
            } elseif ($customerName && !$customer->name) {
                $customer->update(['name' => $customerName]);
            }
        }

        // Build order items, validate variants exist
        $orderItems = [];
        $subtotal   = 0.0;

        foreach ($items as $i => $itemRow) {
            $sku      = trim((string) ($itemRow['product_sku'] ?? ''));
            $qty      = (int) ($itemRow['quantity'] ?? 1);
            $unitPrice = (float) ($itemRow['unit_price'] ?? 0);
            $discount = (float) ($itemRow['discount'] ?? 0);

            // Find variant by SKU or barcode
            $variant = ProductVariant::withTrashed()
                ->where('sku', $sku)
                ->orWhere('barcode', $sku)
                ->first();

            if (!$variant) {
                $lineNum = $group['lines'][$i] ?? $group['lines'][0];
                $result['errors'][] = ['row' => $lineNum, 'message' => "Product SKU/barcode not found: \"{$sku}\". Row skipped."];
                $result['skipped']++;
                continue;
            }

            $itemTotal = ($unitPrice * $qty) - $discount;
            $subtotal += $itemTotal;

            $orderItems[] = [
                'product_id'      => $variant->product_id,
                'variant_id'      => $variant->id,
                'quantity'        => $qty,
                'unit_price'      => $unitPrice,
                'subtotal'        => $unitPrice * $qty,
                'discount_amount' => $discount,
                'final_amount'    => $itemTotal,
                'total_price'     => $itemTotal,
            ];
        }

        if (empty($orderItems)) {
            $result['skipped']++;
            return;
        }

        // Determine status
        $rawStatus  = isset($meta['status']) && $meta['status'] !== '' ? strtoupper(trim((string) $meta['status'])) : 'COMPLETED';
        $status     = in_array($rawStatus, OrderStatus::values()) ? $rawStatus : 'COMPLETED';

        $oldOrderNum = isset($meta['order_number']) && $meta['order_number'] !== '' ? trim((string) $meta['order_number']) : null;
        $notes       = isset($meta['notes']) && $meta['notes'] !== '' ? trim((string) $meta['notes']) : null;
        $noteText    = $oldOrderNum ? "Imported from old system. Original order: {$oldOrderNum}" . ($notes ? ". {$notes}" : '') : $notes;

        DB::transaction(function () use (
            $channel, $customer, $subtotal, $status, $orderDate, $noteText,
            $actor, $orderItems, $meta, $result
        ) {
            $deliveryCost   = (float) ($meta['delivery_cost'] ?? 0);
            $totalDiscount  = array_sum(array_column($orderItems, 'discount_amount'));
            $finalAmount    = $subtotal + $deliveryCost;

            $order = new Order();
            $order->forceFill([
                'order_number'    => 'IMP-' . strtoupper(Str::random(8)),
                'channel_id'      => $channel->id,
                'sales_channel_id'=> $channel->id,
                'customer_id'     => $customer?->id,
                'user_id'         => $actor->id,
                'created_by'      => $actor->id,
                'status'          => $status,
                'payment_status'  => $this->resolvePaymentStatus($meta),
                'subtotal'        => $subtotal,
                'discount_amount' => $totalDiscount,
                'delivery_cost'   => $deliveryCost,
                'total_amount'    => $finalAmount,
                'final_amount'    => $finalAmount,
                'note'            => $noteText,
                'notes'           => $noteText,
                'completed_at'    => $status === 'COMPLETED' ? $orderDate : null,
                'created_at'      => $orderDate,
                'updated_at'      => $orderDate,
            ]);
            $order->save();

            foreach ($orderItems as $item) {
                OrderItem::create(array_merge($item, ['order_id' => $order->id]));
            }

            // Create payment record if paid
            if ($this->resolvePaymentStatus($meta) === 'paid') {
                $paymentMethod = isset($meta['payment_method']) && $meta['payment_method'] !== ''
                    ? strtolower(trim((string) $meta['payment_method']))
                    : 'cash';

                Payment::create([
                    'order_id'       => $order->id,
                    'payment_method' => $paymentMethod,
                    'amount'         => $finalAmount,
                    'status'         => 'completed',
                    'created_at'     => $orderDate,
                    'updated_at'     => $orderDate,
                ]);
            }

            // Update customer stats
            if ($customer && $status === 'COMPLETED') {
                $customer->increment('total_purchased');
                $customer->increment('total_spent', $finalAmount);
                if (!$customer->last_purchase_at || $orderDate > $customer->last_purchase_at) {
                    $customer->update(['last_purchase_at' => $orderDate]);
                }
            }
        });

        $result['imported']++;
    }

    // -------------------------------------------------------------------------
    // Template generation (returns array of [headers, sampleRow])
    // -------------------------------------------------------------------------

    public function getProductsTemplateData(): array
    {
        return [
            'headers' => [
                'name',
                'sku',
                'barcode',
                'category',
                'purchase_price',
                'selling_price',
                'quantity',
                'reorder_level',
                'description',
                'is_active',
                'variant_name',
                'attributes',
                'parent_sku',
                'image_url',
            ],
            'sample'  => [
                [
                    'Wireless Ergonomic Mouse',
                    'WM-001',
                    '8851234567890',
                    'Electronics',
                    '15.00',
                    '29.99',
                    '50',
                    '10',
                    'Ergonomic wireless mouse (Simple product example)',
                    '1',
                    'Standard',
                    '',
                    '',
                    'https://example.com/images/mouse.jpg',
                ],
                [
                    'Premium Cotton T-Shirt',
                    'TSH-RED-M',
                    '8851234567891',
                    'Apparel',
                    '8.00',
                    '19.99',
                    '30',
                    '5',
                    '100% cotton crewneck (Variable product - Red / M)',
                    '1',
                    'Red / M',
                    'Color: Red | Size: M',
                    'TSH-COTTON',
                    'https://example.com/images/tshirt-red.jpg',
                ],
                [
                    'Premium Cotton T-Shirt',
                    'TSH-BLU-L',
                    '8851234567892',
                    'Apparel',
                    '8.00',
                    '19.99',
                    '25',
                    '5',
                    '100% cotton crewneck (Variable product - Blue / L)',
                    '1',
                    'Blue / L',
                    'Color: Blue | Size: L',
                    'TSH-COTTON',
                    'https://example.com/images/tshirt-blue.jpg',
                ],
            ],
        ];
    }

    public function getSalesTemplateData(): array
    {
        return [
            'headers' => ['order_date', 'order_number', 'customer_name', 'customer_phone', 'customer_email', 'channel_name', 'product_sku', 'quantity', 'unit_price', 'discount', 'payment_method', 'payment_status', 'status', 'notes'],
            'sample'  => ['2024-01-15', 'ORD-0001', 'John Doe', '0812345678', 'john@example.com', 'Walk-in', 'SKU-001', '2', '250.00', '0', 'cash', 'paid', 'COMPLETED', 'Imported order'],
        ];
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Resolve image URL or link from row data.
     */
    public function resolveImageUrl(array $row): ?string
    {
        $candidateKeys = [
            'image',
            'image_url',
            'picture',
            'photo',
            'image_link',
            'image link',
            'img',
            'productlist_images',
            'productlist images',
            'product_image',
            'product image',
        ];

        foreach ($candidateKeys as $key) {
            if (!empty($row[$key])) {
                $val = trim((string) $row[$key]);
                if ($val !== '') {
                    // Check if it is an Excel formula =IMAGE("url")
                    if (preg_match('/=IMAGE\(\s*["\']([^"\']+)["\']\s*\)/i', $val, $m)) {
                        return trim($m[1]);
                    }
                    return $val;
                }
            }
        }

        // Also check if any column header contains 'image', 'picture', or 'photo'
        foreach ($row as $k => $v) {
            if ($v && (str_contains($k, 'image') || str_contains($k, 'picture') || str_contains($k, 'photo'))) {
                $val = trim((string) $v);
                if (filter_var($val, FILTER_VALIDATE_URL) || str_starts_with($val, 'http://') || str_starts_with($val, 'https://')) {
                    return $val;
                }
            }
        }

        return null;
    }

    /**
     * Download an image from an external URL (AppSheet, Google Drive, direct URL)
     * and persist it to system media storage.
     */
    public function downloadAndStoreImage(string $url): ?string
    {
        $cleanUrl = trim($url);
        if (!filter_var($cleanUrl, FILTER_VALIDATE_URL) && !str_starts_with($cleanUrl, 'http://') && !str_starts_with($cleanUrl, 'https://')) {
            return null;
        }

        // Convert Google Drive links if necessary
        $downloadUrl = $this->transformGoogleDriveUrl($cleanUrl);

        try {
            // Attempt download with 8s timeout and standard browser headers
            $response = Http::timeout(8)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept'     => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                ])
                ->get($downloadUrl);

            if (!$response->successful()) {
                Log::warning("ImportService: Failed to download product image from {$cleanUrl}. HTTP status: " . $response->status());
                return null;
            }

            $body = $response->body();
            if (empty($body) || strlen($body) < 100) {
                Log::warning("ImportService: Empty or invalid image response from {$cleanUrl}");
                return null;
            }

            // Determine file extension
            $contentType = strtolower($response->header('Content-Type') ?? '');
            $extension = 'jpg';
            if (str_contains($contentType, 'png')) {
                $extension = 'png';
            } elseif (str_contains($contentType, 'webp')) {
                $extension = 'webp';
            } elseif (str_contains($contentType, 'gif')) {
                $extension = 'gif';
            } elseif (str_contains($contentType, 'jpeg') || str_contains($contentType, 'jpg')) {
                $extension = 'jpg';
            } else {
                // Try from original URL
                $path = parse_url($cleanUrl, PHP_URL_PATH) ?? '';
                $urlExt = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                if (in_array($urlExt, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                    $extension = $urlExt === 'jpeg' ? 'jpg' : $urlExt;
                }
            }

            $folder = 'products';
            $filename = Str::uuid() . '.' . $extension;
            $storagePath = $folder . '/' . $filename;

            // Determine target disk (same precedence as MediaController: supabase -> r2 -> public)
            $useSupabase = !empty(config('filesystems.disks.supabase.key'))
                && !empty(config('filesystems.disks.supabase.secret'))
                && !empty(config('filesystems.disks.supabase.bucket'));

            $useR2 = !empty(config('filesystems.disks.r2.key'))
                && !empty(config('filesystems.disks.r2.secret'))
                && !empty(config('filesystems.disks.r2.bucket'));

            if ($useSupabase) {
                try {
                    Storage::disk('supabase')->put($storagePath, $body);
                    $baseUrl = config('filesystems.disks.supabase.url');
                    return $baseUrl ? rtrim($baseUrl, '/') . '/' . ltrim($storagePath, '/') : Storage::disk('supabase')->url($storagePath);
                } catch (\Throwable $e) {
                    Log::warning("ImportService: Supabase upload failed, falling back to public disk: " . $e->getMessage());
                }
            }

            if ($useR2) {
                try {
                    Storage::disk('r2')->put($storagePath, $body);
                    $baseUrl = config('filesystems.disks.r2.url');
                    return $baseUrl ? rtrim($baseUrl, '/') . '/' . ltrim($storagePath, '/') : Storage::disk('r2')->url($storagePath);
                } catch (\Throwable $e) {
                    Log::warning("ImportService: R2 upload failed, falling back to public disk: " . $e->getMessage());
                }
            }

            // Default: local public disk
            Storage::disk('public')->put($storagePath, $body);
            return Storage::disk('public')->url($storagePath);

        } catch (\Throwable $e) {
            Log::warning("ImportService: Exception downloading product image from {$cleanUrl}: " . $e->getMessage());
            return null;
        }
    }

    private function transformGoogleDriveUrl(string $url): string
    {
        // Check for Google Drive file ID
        if (preg_match('/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i', $url, $matches) ||
            preg_match('/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i', $url, $matches) ||
            preg_match('/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/i', $url, $matches) ||
            preg_match('/docs\.google\.com\/.*id=([a-zA-Z0-9_-]+)/i', $url, $matches)) {
            $fileId = $matches[1];
            return "https://lh3.googleusercontent.com/d/{$fileId}";
        }

        return $url;
    }

    /**
     * Read an XLSX/XLS/CSV file and return rows as associative arrays
     * keyed by the lowercase header names from the first row.
     */
    private function readSheet(UploadedFile|string $file): array
    {
        if ($file instanceof UploadedFile) {
            $path      = $file->getRealPath();
            $extension = strtolower($file->getClientOriginalExtension());
        } else {
            $path      = $file;
            $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        }

        if ($extension === 'csv') {
            $reader = IOFactory::createReader('Csv');
            $reader->setDelimiter(',');
            $reader->setEnclosure('"');
        } elseif (in_array($extension, ['xls'])) {
            $reader = IOFactory::createReader('Xls');
        } else {
            $reader = IOFactory::createReader('Xlsx');
        }

        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);
        $sheet       = $spreadsheet->getActiveSheet();
        $data        = $sheet->toArray(null, true, true, false);

        if (empty($data)) {
            return [];
        }

        // First row = headers
        $headers = array_map(fn($h) => strtolower(trim((string) $h)), $data[0]);

        $rows = [];
        for ($i = 1; $i < count($data); $i++) {
            $rowValues = $data[$i];
            $row = [];
            foreach ($headers as $colIdx => $header) {
                $row[$header] = $rowValues[$colIdx] ?? null;
            }
            $rows[] = $row;
        }

        return $rows;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if (!$value) {
            return null;
        }

        // PhpSpreadsheet may give numeric Excel serial date
        if (is_numeric($value)) {
            try {
                return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $value));
            } catch (\Throwable) {}
        }

        $formats = ['Y-m-d', 'd/m/Y', 'm/d/Y', 'd-m-Y', 'Y/m/d'];
        foreach ($formats as $fmt) {
            try {
                return Carbon::createFromFormat($fmt, trim((string) $value));
            } catch (\Throwable) {}
        }

        return null;
    }

    private function resolvePaymentStatus(array $meta): string
    {
        $raw = isset($meta['payment_status']) ? strtolower(trim((string) $meta['payment_status'])) : '';
        return in_array($raw, ['paid', 'unpaid', 'partial']) ? $raw : 'unpaid';
    }
}
