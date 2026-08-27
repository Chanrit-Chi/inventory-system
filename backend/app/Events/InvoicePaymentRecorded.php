<?php

namespace App\Events;

use App\Models\Invoice;
use App\Models\InvoicePayment;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InvoicePaymentRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public InvoicePayment $payment
    ) {}
}
