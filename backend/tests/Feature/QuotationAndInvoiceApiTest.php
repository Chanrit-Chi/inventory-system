<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Quotation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuotationAndInvoiceApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_list_quotations_and_invoices_when_authenticated(): void
    {
        $user = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($user);

        $qRes = $this->getJson('/api/v1/quotations');
        $qRes->assertStatus(200)
             ->assertJsonStructure([
                 'success',
                 'data',
                 'meta' => ['current_page', 'total'],
             ]);

        $iRes = $this->getJson('/api/v1/invoices');
        $iRes->assertStatus(200)
             ->assertJsonStructure([
                 'success',
                 'data',
                 'meta' => ['current_page', 'total'],
             ]);
    }

    public function test_can_create_quotation_and_convert(): void
    {
        $user = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($user);

        $payload = [
            'customer_name'  => 'Enterprise Client Inc',
            'customer_phone' => '+855 23 888 999',
            'discount'       => 50.00,
            'notes'          => 'Corporate bulk rate valid for 30 days',
            'items'          => [
                [
                    'product_name' => 'Custom Executive Desk Pack',
                    'sku'          => 'EXEC-DSK-001',
                    'quantity'     => 2,
                    'unit_price'   => 400.00,
                ],
                [
                    'product_name' => 'Ergonomic Mesh Chair',
                    'sku'          => 'CHR-MSH-002',
                    'quantity'     => 4,
                    'unit_price'   => 150.00,
                ],
            ],
        ];

        $res = $this->postJson('/api/v1/quotations', $payload);
        $res->assertStatus(201)
            ->assertJsonPath('data.customer_name', 'Enterprise Client Inc')
            ->assertJsonPath('data.subtotal', '1400.00')
            ->assertJsonPath('data.discount', '50.00')
            ->assertJsonPath('data.total_amount', '1350.00')
            ->assertJsonPath('data.status', 'DRAFT');

        $quoteId = $res->json('data.id');

        // Status update to ACCEPTED
        $statusRes = $this->patchJson("/api/v1/quotations/{$quoteId}/status", [
            'status' => 'ACCEPTED',
        ]);
        $statusRes->assertStatus(200)
                  ->assertJsonPath('data.status', 'ACCEPTED');

        // Convert quote
        $convertRes = $this->postJson("/api/v1/quotations/{$quoteId}/convert");
        $convertRes->assertStatus(200)
                   ->assertJsonPath('data.quotation.status', 'CONVERTED');
    }

    public function test_can_create_invoice_and_record_payments_with_balance_calculation(): void
    {
        $user = User::where('role', 'SUPER_ADMIN')->first();
        Sanctum::actingAs($user);

        $payload = [
            'customer_name'  => 'Tech Solutions Asia',
            'customer_phone' => '+855 10 777 666',
            'due_date'       => now()->addDays(14)->toDateString(),
            'notes'          => 'Quarterly hardware renewal',
            'items'          => [
                [
                    'product_name' => 'Server Unit 1U',
                    'sku'          => 'SRV-1U-STD',
                    'quantity'     => 1,
                    'unit_price'   => 800.00,
                ],
                [
                    'product_name' => 'Switch Gigabit 24-Port',
                    'sku'          => 'NET-SW-24P',
                    'quantity'     => 1,
                    'unit_price'   => 200.00,
                ],
            ],
        ];

        $res = $this->postJson('/api/v1/invoices', $payload);
        $res->assertStatus(201)
            ->assertJsonPath('data.total_amount', '1000.00')
            ->assertJsonPath('data.amount_paid', '0.00')
            ->assertJsonPath('data.balance_due', '1000.00')
            ->assertJsonPath('data.status', 'SENT');

        $invoiceId = $res->json('data.id');

        // Partial payment 400$
        $pay1 = $this->postJson("/api/v1/invoices/{$invoiceId}/payments", [
            'amount'          => 400.00,
            'payment_method'  => 'ABA QR',
            'transaction_ref' => 'ABA-TXN-10101',
        ]);
        $pay1->assertStatus(201)
             ->assertJsonPath('data.invoice.amount_paid', '400.00')
             ->assertJsonPath('data.invoice.balance_due', '600.00')
             ->assertJsonPath('data.invoice.status', 'PARTIAL');

        // Final payment 600$ settling invoice in full
        $pay2 = $this->postJson("/api/v1/invoices/{$invoiceId}/payments", [
            'amount'          => 600.00,
            'payment_method'  => 'Cash',
        ]);
        $pay2->assertStatus(201)
             ->assertJsonPath('data.invoice.amount_paid', '1000.00')
             ->assertJsonPath('data.invoice.balance_due', '0.00')
             ->assertJsonPath('data.invoice.status', 'PAID');
    }
}
