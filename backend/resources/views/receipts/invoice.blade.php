<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #{{ $invoice->invoice_number }}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
      line-height: 1.35;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .receipt-container {
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .text-lg { font-size: 15px; }
    .text-xl { font-size: 17px; }
    .text-sm { font-size: 11px; }
    .text-xs { font-size: 10px; }
    .text-muted { color: #555; }
    
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    .items-table th {
      border-bottom: 1px dashed #000;
      padding: 4px 0;
      font-size: 11px;
    }
    .items-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    
    .total-row {
      font-size: 14px;
      font-weight: bold;
      margin: 4px 0;
    }
    
    .btn-actions {
      margin-top: 20px;
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #111827;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-close {
      background: #e5e7eb;
      color: #374151;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }

    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      .receipt-container {
        max-width: 100%;
        width: 100%;
      }
      .btn-actions {
        display: none !important;
      }
      @page {
        margin: 0;
        size: auto;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="text-center">
      @if(!empty($setting->logo_url))
        <img src="{{ $setting->logo_url }}" alt="Logo" style="max-height: 48px; max-width: 160px; margin-bottom: 6px; object-fit: contain;">
      @endif
      <div class="font-bold text-xl">{{ $setting->store_name ?: 'KC Shop' }}</div>
      @if(!empty($setting->tagline))
        <div class="text-sm text-muted">{{ $setting->tagline }}</div>
      @endif
      @if(!empty($setting->store_address))
        <div class="text-xs">{{ $setting->store_address }}</div>
      @endif
      @if(!empty($setting->store_phone))
        <div class="text-xs">Tel: {{ $setting->store_phone }}</div>
      @endif
      <div class="font-bold text-sm" style="margin-top: 4px;">{{ $setting->invoice_header ?: 'COMMERCIAL INVOICE' }}</div>
    </div>

    <div class="double-divider"></div>

    <!-- Metadata -->
    <div class="row">
      <span class="text-xs font-bold">Invoice #:</span>
      <span class="text-xs font-bold">#{{ $invoice->invoice_number }}</span>
    </div>
    @if(!empty($invoice->order_number))
      <div class="row">
        <span class="text-xs">Order Ref:</span>
        <span class="text-xs">#{{ $invoice->order_number }}</span>
      </div>
    @endif
    <div class="row">
      <span class="text-xs">Date:</span>
      <span class="text-xs">{{ $invoice->created_at ? $invoice->created_at->format('M d, Y h:i A') : now()->format('M d, Y h:i A') }}</span>
    </div>
    <div class="row">
      <span class="text-xs">Due Date:</span>
      <span class="text-xs font-bold">{{ $invoice->due_date ? date('M d, Y', strtotime($invoice->due_date)) : 'Due Upon Receipt' }}</span>
    </div>
    <div class="row">
      <span class="text-xs">Customer:</span>
      <span class="text-xs font-bold">{{ $invoice->customer_name }}{{ !empty($invoice->customer_phone) ? ' (' . $invoice->customer_phone . ')' : '' }}</span>
    </div>
    @if($invoice->user)
      <div class="row">
        <span class="text-xs">Issued By:</span>
        <span class="text-xs">{{ $invoice->user->name }}</span>
      </div>
    @endif

    <div class="divider"></div>

    <!-- Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="text-left">ITEM</th>
          <th class="text-center" style="width: 40px;">QTY</th>
          <th class="text-right" style="width: 55px;">PRICE</th>
          <th class="text-right" style="width: 60px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        @foreach($invoice->items as $item)
          @php
            $price = (float) $item->unit_price;
            $lineTotal = (float) ($item->total_price ?? $item->line_total ?? ($item->quantity * $price));
          @endphp
          <tr>
            <td class="text-left">
              <div class="font-bold">{{ $item->product_name }}</div>
              @if(!empty($item->sku))
                <div class="text-xs text-muted">{{ $item->sku }}</div>
              @endif
            </td>
            <td class="text-center">{{ $item->quantity }}</td>
            <td class="text-right">${{ number_format($price, 2) }}</td>
            <td class="text-right font-bold">${{ number_format($lineTotal, 2) }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>

    <div class="divider"></div>

    <!-- Totals -->
    @php
      $totalAmount = (float) $invoice->total_amount;
      $amountPaid = (float) $invoice->amount_paid;
      $balanceDue = max(0, $totalAmount - $amountPaid);
      $status = strtoupper($invoice->status);
    @endphp

    <div class="row">
      <span class="text-xs">Total Amount:</span>
      <span class="text-xs font-bold">${{ number_format($totalAmount, 2) }}</span>
    </div>
    <div class="row">
      <span class="text-xs">Amount Paid:</span>
      <span class="text-xs">${{ number_format($amountPaid, 2) }}</span>
    </div>

    <div class="double-divider"></div>

    <div class="row total-row">
      <span>BALANCE DUE:</span>
      <span>${{ number_format($balanceDue, 2) }}</span>
    </div>

    <div class="row">
      <span class="text-xs">Status:</span>
      <span class="text-xs font-bold">{{ $status }}</span>
    </div>

    @if($invoice->payments && $invoice->payments->count() > 0)
      <div class="divider"></div>
      <div class="text-xs font-bold" style="margin-bottom: 2px;">Payments Recorded:</div>
      @foreach($invoice->payments as $pmt)
        <div class="row text-xs text-muted">
          <span>{{ $pmt->payment_method }} ({{ $pmt->created_at ? $pmt->created_at->format('M d') : '' }}):</span>
          <span>${{ number_format((float)$pmt->amount, 2) }}</span>
        </div>
      @endforeach
    @endif

    <div class="double-divider"></div>

    <!-- Footer -->
    <div class="text-center text-xs" style="margin-top: 6px;">
      <div>{{ $setting->receipt_footer ?: "Thank you for your business!\nPlease remit payment by the due date." }}</div>
      <div style="margin-top: 4px; letter-spacing: 3px;">* * * * *</div>
    </div>

    <!-- Manual actions (hidden when printing) -->
    <div class="btn-actions">
      <button class="btn-print" onclick="window.print()">Print Invoice</button>
      <button class="btn-close" onclick="window.close()">Close Window</button>
    </div>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>
