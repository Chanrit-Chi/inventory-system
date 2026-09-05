<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation #{{ $quotation->quotation_number }}</title>
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
      <div class="font-bold text-sm" style="margin-top: 4px;">{{ $setting->quotation_header ?: 'PRICE QUOTATION / ESTIMATE' }}</div>
    </div>

    <div class="double-divider"></div>

    <!-- Metadata -->
    <div class="row">
      <span class="text-xs font-bold">Quotation #:</span>
      <span class="text-xs font-bold">#{{ $quotation->quotation_number }}</span>
    </div>
    <div class="row">
      <span class="text-xs">Date:</span>
      <span class="text-xs">{{ $quotation->created_at ? $quotation->created_at->format('M d, Y h:i A') : now()->format('M d, Y h:i A') }}</span>
    </div>
    <div class="row">
      <span class="text-xs">Valid Until:</span>
      <span class="text-xs">{{ $quotation->valid_until ? date('M d, Y', strtotime($quotation->valid_until)) : '30 Days From Issue' }}</span>
    </div>
    <div class="row">
      <span class="text-xs">Customer:</span>
      <span class="text-xs font-bold">{{ $quotation->customer_name }}{{ !empty($quotation->customer_phone) ? ' (' . $quotation->customer_phone . ')' : '' }}</span>
    </div>
    @if($quotation->user)
      <div class="row">
        <span class="text-xs">Prepared By:</span>
        <span class="text-xs">{{ $quotation->user->name }}</span>
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
        @foreach($quotation->items as $item)
          @php
            $price = (float) $item->unit_price;
            $lineTotal = (float) ($item->line_total ?? ($item->quantity * $price));
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
      $subtotal = (float) $quotation->subtotal;
      $discount = (float) ($quotation->discount ?? 0);
      $totalAmount = (float) $quotation->total_amount;
      $status = strtoupper($quotation->status);
    @endphp

    <div class="row">
      <span class="text-xs">Subtotal:</span>
      <span class="text-xs">${{ number_format($subtotal, 2) }}</span>
    </div>
    @if($discount > 0)
      <div class="row">
        <span class="text-xs">Discount:</span>
        <span class="text-xs">-${{ number_format($discount, 2) }}</span>
      </div>
    @endif

    <div class="double-divider"></div>

    <div class="row total-row">
      <span>PROPOSED TOTAL:</span>
      <span>${{ number_format($totalAmount, 2) }}</span>
    </div>

    <div class="row">
      <span class="text-xs">Status:</span>
      <span class="text-xs font-bold">{{ $status }}</span>
    </div>

    @if(!empty($quotation->notes))
      <div class="divider"></div>
      <div class="text-xs">
        <span class="font-bold">Notes:</span> {{ $quotation->notes }}
      </div>
    @endif

    <div class="double-divider"></div>

    <!-- Footer -->
    <div class="text-center text-xs" style="margin-top: 6px;">
      <div>{{ $setting->receipt_footer ?: "Prices valid for 30 days.\nThank you for considering our proposal!" }}</div>
      <div style="margin-top: 4px; letter-spacing: 3px;">* * * * *</div>
    </div>

    <!-- Manual actions (hidden when printing) -->
    <div class="btn-actions">
      <button class="btn-print" onclick="window.print()">Print Quotation</button>
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
