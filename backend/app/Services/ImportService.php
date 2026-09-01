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
     * Each row creates one simple product + one default variant.
     * If `quantity` > 0, an opening RESTOCK stock movement is recorded.
     *
     * @return array{ imported: int, updated: int, skipped: int, errors: array }
     */
    public function importProducts(UploadedFile $file, User $actor, bool $updateExisting = false): array
    {
        $rows   = $this->readSheet($file);
        $result = ['imported' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];

        // Expected headers (case-insensitive, trimmed)
        $required = ['name', 'purchase_price', 'selling_price'];

        foreach ($rows as $rowIndex => $row) {
            $lineNum = $rowIndex + 2; // 1-indexed, +1 for header row

            // Skip completely empty rows
            if (empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) {
                continue;
            }

            // Validate required columns
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

            try {
                $this->processProductRow($row, $lineNum, $actor, $updateExisting, $result);
            } catch (\Throwable $e) {
                $result['errors'][] = ['row' => $lineNum, 'message' => $e->getMessage()];
                $result['skipped']++;
            }
        }

        return $result;
    }

    private function processProductRow(array $row, int $lineNum, User $actor, bool $updateExisting, array &$result): void
    {
        $name         = trim((string) $row['name']);
        $sku          = isset($row['sku']) && $row['sku'] !== '' ? trim((string) $row['sku']) : null;
        $barcode      = isset($row['barcode']) && $row['barcode'] !== '' ? trim((string) $row['barcode']) : null;
        $purchasePrice = (float) ($row['purchase_price'] ?? 0);
        $sellingPrice  = (float) ($row['selling_price'] ?? 0);
        $quantity      = (int) ($row['quantity'] ?? 0);
        $reorderLevel  = isset($row['reorder_level']) && $row['reorder_level'] !== '' ? (int) $row['reorder_level'] : 5;
        $description  = isset($row['description']) && $row['description'] !== '' ? trim((string) $row['description']) : null;
        $isActive     = isset($row['is_active']) && $row['is_active'] !== '' ? filter_var($row['is_active'], FILTER_VALIDATE_BOOLEAN) : true;
        $categoryName = isset($row['category']) && $row['category'] !== '' ? trim((string) $row['category']) : null;

        // Resolve or create category — generate a unique slug code to satisfy NOT NULL unique constraint
        $categoryId = null;
        if ($categoryName) {
            $baseCode = Str::slug($categoryName);
            $code     = $baseCode;
            $attempt  = 1;
            while (ProductCategory::where('code', $code)->exists()) {
                // name already exists with a different code — just fetch by name
                $existing = ProductCategory::where('name', $categoryName)->first();
                if ($existing) {
                    $categoryId = $existing->id;
                    break;
                }
                $code = $baseCode . '-' . $attempt++;
            }
            if (!$categoryId) {
                $category   = ProductCategory::firstOrCreate(
                    ['name' => $categoryName],
                    ['code' => $code]
                );
                $categoryId = $category->id;
            }
        }

        // Duplicate detection: match on SKU first, then barcode
        $existingProduct = null;
        if ($sku) {
            $existingVariant = ProductVariant::withTrashed()->where('sku', $sku)->first();
            if ($existingVariant) {
                $existingProduct = $existingVariant->product()->withTrashed()->first();
            }
        }
        if (!$existingProduct && $barcode) {
            $existingProduct = Product::withTrashed()->where('barcode', $barcode)->first();
        }

        if ($existingProduct) {
            if (!$updateExisting) {
                $result['errors'][] = ['row' => $lineNum, 'message' => "Duplicate product (SKU/barcode already exists): \"{$name}\" — skipped."];
                $result['skipped']++;
                return;
            }

            // Update existing product
            DB::transaction(function () use ($existingProduct, $name, $purchasePrice, $sellingPrice, $reorderLevel, $description, $isActive, $categoryId, $quantity, $actor) {
                $existingProduct->update([
                    'name'                  => $name,
                    'purchase_price'        => $purchasePrice,
                    'selling_price'         => $sellingPrice,
                    'default_reorder_level' => $reorderLevel,
                    'description'           => $description,
                    'is_active'             => $isActive,
                    'category_id'           => $categoryId,
                ]);

                // Update first variant prices
                $variant = $existingProduct->variants()->first();
                if ($variant) {
                    $variant->update([
                        'cost_price'    => $purchasePrice,
                        'selling_price' => $sellingPrice,
                        'reorder_level' => $reorderLevel,
                        'is_active'     => $isActive,
                    ]);
                }
            });

            $result['updated']++;
            return;
        }

        // Create new product + variant + opening stock movement
        DB::transaction(function () use (
            $name, $sku, $barcode, $purchasePrice, $sellingPrice, $quantity,
            $reorderLevel, $description, $isActive, $categoryId, $actor
        ) {
            $product = Product::create([
                'name'                  => $name,
                'barcode'               => $barcode,
                'purchase_price'        => $purchasePrice,
                'selling_price'         => $sellingPrice,
                'default_reorder_level' => $reorderLevel,
                'description'           => $description,
                'is_active'             => $isActive,
                'category_id'           => $categoryId,
            ]);

            // Determine variant SKU
            $rawSku = $sku ?? (Str::slug($name) . '-' . strtoupper(Str::random(4)));
            $finalSku = $this->variantGenerator->generateUniqueSku($rawSku);

            $variant = ProductVariant::create([
                'product_id'       => $product->id,
                'name'             => 'Standard',
                'sku'              => $finalSku,
                'barcode'          => $barcode,
                'cost_price'       => $purchasePrice,
                'selling_price'    => $sellingPrice,
                'quantity_on_hand' => $quantity,
                'reorder_level'    => $reorderLevel,
                'is_active'        => $isActive,
            ]);

            // Record opening stock movement
            if ($quantity > 0) {
                StockMovement::create([
                    'product_id'      => $product->id,
                    'variant_id'      => $variant->id,
                    'movement_type'   => MovementType::RESTOCK->value,
                    'quantity_change' => $quantity,
                    'quantity_before' => 0,
                    'quantity_after'  => $quantity,
                    'notes'           => 'Opening stock import',
                    'user_id'         => $actor->id,
                    'created_by'      => $actor->id,
                    'created_at'      => now(),
                ]);
            }
        });

        $result['imported']++;
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
            'headers' => ['name', 'sku', 'barcode', 'category', 'purchase_price', 'selling_price', 'quantity', 'reorder_level', 'description', 'is_active'],
            'sample'  => ['Sample Product', 'SKU-001', '8851234567890', 'Electronics', '150.00', '250.00', '100', '10', 'Sample product description', '1'],
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
     * Read an XLSX/XLS/CSV file and return rows as associative arrays
     * keyed by the lowercase header names from the first row.
     */
    private function readSheet(UploadedFile $file): array
    {
        $path       = $file->getRealPath();
        $extension  = strtolower($file->getClientOriginalExtension());

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
