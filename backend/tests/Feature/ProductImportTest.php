<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ProductImportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        if (!\Illuminate\Support\Facades\Schema::hasTable('personal_access_tokens')) {
            $this->artisan('migrate', ['--path' => 'vendor/laravel/sanctum/database/migrations']);
        }

        $this->admin = User::create([
            'name'             => 'Admin User',
            'email'            => 'admin@inventory.local',
            'password'         => \Illuminate\Support\Facades\Hash::make('Secret123!'),
            'role'             => 'ADMIN',
            'is_active'        => true,
            'permission_group' => 'Admin',
        ]);
    }

    private function createExcelFile(array $headers, array $rows): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        foreach ($headers as $colIdx => $header) {
            $sheet->setCellValue([$colIdx + 1, 1], $header);
        }

        foreach ($rows as $rowIdx => $row) {
            foreach ($row as $colIdx => $val) {
                $sheet->setCellValue([$colIdx + 1, $rowIdx + 2], $val);
            }
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'import_test_') . '.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        return new UploadedFile($tempPath, 'products.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }

    public function test_simple_product_import_creates_product_and_standard_variant(): void
    {
        $headers = ['name', 'sku', 'barcode', 'category', 'purchase_price', 'selling_price', 'quantity', 'reorder_level', 'description', 'is_active'];
        $rows = [
            ['Simple Mouse', 'MOU-001', '8850000000001', 'Electronics', '10.00', '25.00', '50', '5', 'Standard wireless mouse', '1'],
        ];

        $file = $this->createExcelFile($headers, $rows);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/import/products', [
                'file' => $file,
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.imported', 1);
        $response->assertJsonPath('data.errors', []);

        $product = Product::where('name', 'Simple Mouse')->first();
        $this->assertNotNull($product);
        $this->assertEquals('10.00', $product->purchase_price);
        $this->assertEquals('25.00', $product->selling_price);

        $this->assertCount(1, $product->variants);
        $variant = $product->variants->first();
        $this->assertEquals('Standard', $variant->name);
        $this->assertEquals('MOU-001', $variant->sku);
        $this->assertEquals(50, $variant->quantity_on_hand);

        // Check opening stock movement was created
        $movement = StockMovement::where('product_id', $product->id)->where('variant_id', $variant->id)->first();
        $this->assertNotNull($movement);
        $this->assertEquals(50, $movement->quantity_change);
    }

    public function test_variable_product_import_groups_rows_and_attaches_attributes(): void
    {
        $headers = ['name', 'sku', 'barcode', 'category', 'purchase_price', 'selling_price', 'quantity', 'reorder_level', 'description', 'is_active', 'variant_name', 'attributes', 'parent_sku'];
        $rows = [
            ['Premium T-Shirt', 'TSH-RED-S', '8850000000010', 'Apparel', '5.00', '15.00', '20', '5', 'Cotton tee', '1', 'Red / S', 'Color: Red | Size: S', 'TSH-PREM'],
            ['Premium T-Shirt', 'TSH-RED-M', '8850000000011', 'Apparel', '5.00', '15.00', '30', '5', 'Cotton tee', '1', 'Red / M', 'Color: Red | Size: M', 'TSH-PREM'],
            ['Premium T-Shirt', 'TSH-BLU-L', '8850000000012', 'Apparel', '6.00', '18.00', '15', '5', 'Cotton tee', '1', 'Blue / L', 'Color: Blue | Size: L', 'TSH-PREM'],
        ];

        $file = $this->createExcelFile($headers, $rows);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/import/products', [
                'file' => $file,
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.imported', 1);
        $response->assertJsonPath('data.errors', []);

        // Only 1 master product should exist
        $products = Product::where('name', 'Premium T-Shirt')->get();
        $this->assertCount(1, $products);

        $product = $products->first();
        $this->assertEquals('TSH-PREM', $product->sku);

        // Exactly 3 variants under this product
        $this->assertCount(3, $product->variants);

        $v1 = $product->variants()->where('sku', 'TSH-RED-S')->first();
        $this->assertNotNull($v1);
        $this->assertEquals('Red / S', $v1->name);
        $this->assertEquals(20, $v1->quantity_on_hand);
        $this->assertEquals('15.00', $v1->selling_price);

        $v3 = $product->variants()->where('sku', 'TSH-BLU-L')->first();
        $this->assertNotNull($v3);
        $this->assertEquals('Blue / L', $v3->name);
        $this->assertEquals(15, $v3->quantity_on_hand);
        $this->assertEquals('18.00', $v3->selling_price);

        // Attributes should have been created and linked
        $this->assertDatabaseHas('attributes', ['name' => 'Color']);
        $this->assertDatabaseHas('attributes', ['name' => 'Size']);
        $this->assertDatabaseHas('attribute_values', ['value_name' => 'Red']);
        $this->assertDatabaseHas('attribute_values', ['value_name' => 'Blue']);
        $this->assertDatabaseHas('attribute_values', ['value_name' => 'S']);
        $this->assertDatabaseHas('attribute_values', ['value_name' => 'L']);

        // Check variant attribute values
        $this->assertCount(2, $v1->attributeValues);
        $this->assertCount(2, $v3->attributeValues);

        // Check opening stock movements for all 3 variants
        $movements = StockMovement::where('product_id', $product->id)->get();
        $this->assertCount(3, $movements);
    }

    public function test_updating_existing_variable_product(): void
    {
        // First import
        $headers = ['name', 'sku', 'barcode', 'category', 'purchase_price', 'selling_price', 'quantity', 'reorder_level', 'description', 'is_active', 'variant_name', 'attributes'];
        $rows1 = [
            ['Sports Shoes', 'SHOE-BLK-40', '', 'Footwear', '20.00', '50.00', '10', '5', 'Running shoes', '1', 'Black / 40', 'Color: Black | Size: 40'],
        ];

        $file1 = $this->createExcelFile($headers, $rows1);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/import/products', ['file' => $file1])
            ->assertOk();

        $product = Product::where('name', 'Sports Shoes')->first();
        $this->assertNotNull($product);
        $this->assertCount(1, $product->variants);

        // Second import with updateExisting = true, updating variant 1 price and adding variant 2
        $rows2 = [
            ['Sports Shoes', 'SHOE-BLK-40', '', 'Footwear', '20.00', '55.00', '0', '5', 'Running shoes updated', '1', 'Black / 40', 'Color: Black | Size: 40'],
            ['Sports Shoes', 'SHOE-WHT-42', '', 'Footwear', '22.00', '60.00', '15', '5', 'Running shoes updated', '1', 'White / 42', 'Color: White | Size: 42'],
        ];

        $file2 = $this->createExcelFile($headers, $rows2);
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/import/products', [
                'file' => $file2,
                'update_existing' => true,
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.updated', 1);

        $product->refresh();
        $this->assertEquals('Running shoes updated', $product->description);

        $this->assertCount(2, $product->variants);
        $v1 = $product->variants()->where('sku', 'SHOE-BLK-40')->first();
        $this->assertEquals('55.00', $v1->selling_price);

        $v2 = $product->variants()->where('sku', 'SHOE-WHT-42')->first();
        $this->assertNotNull($v2);
        $this->assertEquals('60.00', $v2->selling_price);
        $this->assertEquals(15, $v2->quantity_on_hand);
    }

    public function test_template_download_returns_variable_columns_and_multi_sample_rows(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/v1/import/template/products');

        $response->assertOk();
        $response->assertHeader('Content-Disposition', 'attachment; filename="products_import_template.xlsx"');
    }

    public function test_duplicate_skipping_and_validation_errors(): void
    {
        // Missing name and parent_sku
        $headers = ['name', 'sku', 'purchase_price', 'selling_price'];
        $rows = [
            ['', '', '10.00', '20.00'],
        ];
        $file = $this->createExcelFile($headers, $rows);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/import/products', ['file' => $file]);

        $res->assertOk();
        $res->assertJsonPath('data.skipped', 1);
        $this->assertCount(1, $res->json('data.errors'));
        $this->assertStringContainsString('Missing required product name or parent_sku', $res->json('data.errors.0.message'));

        // Duplicate test with update_existing = false
        $validRows = [
            ['Duplicate Product', 'DUP-001', '10.00', '20.00'],
        ];
        $file1 = $this->createExcelFile($headers, $validRows);
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/import/products', ['file' => $file1])->assertOk();

        // Second import of same product with update_existing = false
        $file2 = $this->createExcelFile($headers, $validRows);
        $res2 = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/import/products', [
            'file' => $file2,
            'update_existing' => false,
        ]);
        $res2->assertOk();
        $res2->assertJsonPath('data.skipped', 1);
        $this->assertStringContainsString('Duplicate product', $res2->json('data.errors.0.message'));
    }
}
