<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InvoiceAndQuotationReceiptTest extends TestCase
{
    use DatabaseMigrations;

    private User $user;
    private Invoice $invoice;
    private Quotation $quotation;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->user = User::create([
            'name'      => 'Finance Officer',
            'email'     => 'finance@test.com',
            'password'  => Hash::make('password123'),
            'role'      => 'ADMIN',
            'is_active' => true,
        ]);

        $this->invoice = Invoice::create([
            'invoice_number' => 'INV-2026-00001',
            'order_number'   => 'ORD-2026-00001',
            'customer_name'  => 'Wayne Enterprises',
            'customer_phone' => '+1-555-0100',
            'status'         => 'SENT',
            'total_amount'   => 150.00,
            'amount_paid'    => 50.00,
            'due_date'       => '2026-10-01',
            'user_id'        => $this->user->id,
        ]);

        InvoiceItem::create([
            'invoice_id'   => $this->invoice->id,
            'product_name' => 'Consulting Services',
            'sku'          => 'SVC-001',
            'quantity'     => 1,
            'unit_price'   => 150.00,
            'total_price'  => 150.00,
        ]);

        $this->quotation = Quotation::create([
            'quotation_number' => 'QT-2026-00001',
            'customer_name'    => 'Acme Corp',
            'customer_phone'   => '+1-555-0200',
            'status'           => 'SENT',
            'subtotal'         => 200.00,
            'discount'         => 20.00,
            'total_amount'     => 180.00,
            'notes'            => 'Valid for 30 days',
            'user_id'          => $this->user->id,
        ]);

        QuotationItem::create([
            'quotation_id' => $this->quotation->id,
            'product_name' => 'Enterprise Hardware',
            'sku'          => 'HW-900',
            'quantity'     => 2,
            'unit_price'   => 100.00,
            'line_total'   => 200.00,
        ]);

        $setting = StoreSetting::current();
        $setting->update([
            'store_name'       => 'OmniPOS HQ',
            'invoice_header'   => 'TAX INVOICE',
            'quotation_header' => 'FORMAL ESTIMATE',
        ]);
    }

    public function test_invoice_receipt_renders_html(): void
    {
        $response = $this->get("/api/v1/invoices/{$this->invoice->id}/receipt", ['Accept' => 'text/html']);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/html; charset=UTF-8');
        
        $content = $response->getContent();
        $this->assertStringContainsString('INV-2026-00001', $content);
        $this->assertStringContainsString('Wayne Enterprises', $content);
        $this->assertStringContainsString('Consulting Services', $content);
        $this->assertStringContainsString('BALANCE DUE', $content);
        $this->assertStringContainsString('$100.00', $content);
        $this->assertStringContainsString('window.print()', $content);
    }

    public function test_invoice_receipt_returns_json(): void
    {
        $response = $this->getJson("/api/v1/invoices/{$this->invoice->id}/receipt");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'id'             => $this->invoice->id,
                'invoice_number' => 'INV-2026-00001',
            ],
        ]);
    }

    public function test_quotation_receipt_renders_html(): void
    {
        $response = $this->get("/api/v1/quotations/{$this->quotation->id}/receipt", ['Accept' => 'text/html']);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/html; charset=UTF-8');

        $content = $response->getContent();
        $this->assertStringContainsString('QT-2026-00001', $content);
        $this->assertStringContainsString('Acme Corp', $content);
        $this->assertStringContainsString('Enterprise Hardware', $content);
        $this->assertStringContainsString('PROPOSED TOTAL', $content);
        $this->assertStringContainsString('$180.00', $content);
        $this->assertStringContainsString('window.print()', $content);
    }

    public function test_quotation_receipt_returns_json(): void
    {
        $response = $this->getJson("/api/v1/quotations/{$this->quotation->id}/receipt");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'id'               => $this->quotation->id,
                'quotation_number' => 'QT-2026-00001',
            ],
        ]);
    }
}
