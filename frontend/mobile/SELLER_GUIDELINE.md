# Mobile POS Operating Manual & User Guideline: Seller Role

---

## 1. Overview & Role Responsibilities

The **Seller** role in the Mobile POS system is designed for sales associates, front-desk retail staff, and cashiers. The interface provides a focused, distraction-free environment that prioritizes rapid order entry, accurate customer lookup, barcode scanning, thermal printing, and personal sales reconciliation.

### Access Permissions Matrix

Your user account operates under strict permission boundaries. The table below outlines what your role can access and what is restricted to Management or Administration.

| Module / Functionality | Access Status | Operational Scope / Restriction Details |
| :--- | :--- | :--- |
| **POS Register (`pos:checkout`)** | **Full Access** | Product lookup, variant selection, barcode scanning, cart management, discounts, delivery setups, and order completion. |
| **Barcode Scanner (`inventory:scan`)** | **Full Access** | Continuous and single-shot scanning via camera viewfinder with auditory/haptic feedback. |
| **Order History (`transactions:view`)** | **Full Access** | Search, filter, view details, reprint receipts, share digital receipts, and settle pending payments. |
| **Quotations (`quotations:create`)** | **Full Access** | Create quotes, convert/reload quotes directly into the active POS cart. |
| **Invoices (`invoices:view`, `invoices:record-payment`)** | **Read / Pay Only** | View historical billing records and record payments against open invoices. Creating standalone invoices requires Manager/Admin. |
| **Customer Lookup (`customers:view`)** | **View & Create at POS** | Search profiles, view loyalty tier/spend, and auto-create new members during POS checkout. Creating or editing profiles in the standalone Customers screen requires `customers:manage`. |
| **Delivery Setup (`delivery:view`)** | **Read Only** | Select delivery couriers and calculate zone pricing during checkout. Managing couriers or rate tables is restricted. |
| **Shift Sign-Off & Daily Settlement** | **Self-Service Only** | Reconcile and sign off on your own personal sales and earned commissions. Viewing team-wide settlements requires Manager/Admin. |
| **Order Void / Cancellation** | **Restricted** | The backend strictly restricts order cancellation to Manager/Admin (`orders:cancel`). Standard sellers cannot cancel completed orders. |
| **Product Catalog Management** | **Hidden** | The `Products` navigation tab is hidden. Creating, editing, or deleting items requires `products:read` and `products:*`. |
| **Inventory Adjustments / Stock-In** | **Hidden** | Stock receiving, damage write-offs, and cycle audits require `inventory:adjust` or `inventory:restock`. |
| **Financial KPIs & Reports** | **Hidden** | Overall store revenue, store-wide profit, daily targets, and accounting analytics require `reports:view`. |
| **Expenses & Bank Accounts** | **Hidden** | Creating petty cash payouts or managing bank QR setups requires Admin/Manager permissions. |

---

### Navigation Architecture

The mobile interface adapts dynamically when you sign in as a Seller:

1. **Bottom Tab Bar**:
   - **Home**: Access your personal shift summary, daily commissions, quick operations, and recent transactions.
   - **Sales**: The primary POS register for scanning, searching products, and processing checkouts.
   - **Transactions**: Complete transaction history, digital receipts, reprinting, and order settlements.
   - **More (Hub)**: Directory providing access to Quotations, Invoices, Customer CRM, Delivery info, and Account Settings.
   *(Note: The `Products` tab visible to managers is intentionally omitted from your tab bar).*

2. **Management Hub (`HubScreen`)**:
   - **Sales & POS**: Sales Register, Quotations, Invoices & Billing, Order History.
   - **CRM & Delivery**: Customer CRM, Delivery Companies, Delivery Zones.
   - **Account Settings**: Profile management, thermal printer configuration, and sign out.
   *(Administrative, Expense, Payroll, and Inventory sections are hidden).*

---

## 2. Getting Started & Profile Management

### 2.1 Logging In

1. Open the mobile app on your terminal or handheld device.
2. In the **Sign In** screen, enter your registered **Email Address** and **Password**.
3. Tap **Sign In**.
4. The system automatically registers your device identifier (`device_name`) and retrieves your active session token.

### 2.2 Mandatory First-Time Password Change

If an administrator created your account with a temporary password, the app displays the **Change Password Required** modal immediately after authentication:

1. In the **Temporary / Current Password** field, enter the password provided by your manager.
2. In the **New Password** field, enter a secure password containing at least **8 characters**.
3. Re-enter the identical password in the **Confirm New Password** field.
4. Tap **Update Password**. The modal dismisses and unlocks the application.

### 2.3 Profile & Password Management

To review your account information:
1. Tap the **More** tab on the bottom navigation bar.
2. Tap your user profile card at the top of the Hub screen.
3. The **Account & Profile** modal opens with two tabs:
   - **Edit Profile**:
     - **Full Name**: Locked. A notice will indicate: *"Full name is linked to salary, payroll, and official records. Only administrators can change it."* Contact a manager if your legal name is misspelled.
     - **Email Address & Role**: Read-only. Displays your login identifier and `SELLER` role badge.
     - **Phone Number**: Editable. Enter your active contact number and tap **Save Profile Changes**.
   - **Change Password**:
     - Enter your **Current Password**, type your **New Password** (minimum 8 characters), confirm it, and tap **Save New Password**.

### 2.4 Session Security & Automatic Expiry

- **Single Device Policy**: If your account is logged into from another phone or tablet, your existing session is invalidated immediately.
- **Session Expiration**: If your session token expires or is rejected (HTTP 401), the application triggers an alert:
  > *"Session Expired: You have been signed out because your account was logged into from another device or your session expired."*
- When dismissed, all local secure tokens and cached data are wiped, and you are returned to the **Sign In** screen.

### 2.5 Understanding Shifts & Starting Operations

- **No Software Clock-In**: The system does not require a digital "Clock-In" or "Open Shift" button. From the moment you log in, all orders ring up under your authenticated user ID.
- **Starting Cash Float (Important Operational Rule)**: The POS software does not track an opening cash drawer balance (float). Your store will maintain a physical float (e.g., $100.00 in small bills). Verify your physical cash drawer at the start of your shift according to your store's standard manual procedures.

---

## 3. POS & Sales Operations

Tap the **Sales** tab to open the main POS register screen (`PosScreen`).

---

### 3.1 Finding Products & Navigating Categories

The top header provides fast product discovery tools:

1. **Search Bar**:
   - Tap the search field displaying `"Search product, category, SKU, barcode..."`.
   - Enter product titles, SKU codes, barcodes, or variant attributes (e.g., `"Black XL"`).
   - Results update automatically as you type (using a 250ms debounce).
   - Tap the `[X]` icon on the right side of the input to instantly clear search terms.
2. **Category Carousel**:
   - Horizontally scrollable pill buttons are located directly below the search bar.
   - Tap `"All"` to view the complete catalog.
   - Tap any category name (e.g., `"Beverages"`, `"Apparel"`, `"Electronics"`) to isolate that specific department.
3. **Collapsible Header**:
   - As you scroll down the product grid, the search and category header automatically collapses upward to maximize screen space for products. Scroll up slightly to reveal it again.

---

### 3.2 Product Filtering and Sorting

Tap the **Filter** button next to the search input to open the **Filter & Sort Options** modal:

1. **Sort Order**:
   - `Default / Newest`
   - `Name (A -> Z)` or `Name (Z -> A)`
   - `Price (Low -> High)` or `Price (High -> Low)`
   - `Stock (Low -> High)` or `Stock (High -> Low)`
2. **Stock Level Filter**:
   - `All Products`: Shows the full inventory catalog.
   - `In Stock Only`: Hides all items with 0 stock.
   - `Low Stock Alert`: Displays only items with stock between 1 and 5 units (or reorder threshold).
   - `Out of Stock`: Isolates zero-quantity items.
3. **Product Type**:
   - `All Types`
   - `Simple (Direct Add)`: Single-SKU products without variations.
   - `With Variants`: Products containing multiple sizes, colors, or specifications.
4. **Status**:
   - `Active Only` (default)
   - `Inactive / Deactivated`
5. **Applying / Resetting**:
   - Tap **Reset All** to restore standard catalog settings.
   - Tap **Apply Filters** to update the catalog grid. An active badge shows the number of active filters.

---

### 3.3 Understanding Product Cards & Stock Badges

Products are displayed in a two-column grid. Each card displays key inventory indicators:

- **Type Badge**: Displayed at the bottom-left of the thumbnail:
  - `Single`: Fixed specification item.
  - `Variable`: Product contains multiple options.
- **In-Cart Indicator**: A checkmark badge appears at the top-right of the image if the product is already in your current cart.
- **Stock Dot Indicator**:
  - **Green Dot (`24`)**: Healthy stock level.
  - **Amber Dot (`5 low`)**: Low stock alert (at or below reorder threshold). Prompt the customer that stock is limited.
  - **Red Dot (`0 Stock`)**: Depleted inventory.
  - **Gray Dot (`Inactive`)**: Item deactivated by management.
- **Adding Items**:
  - Tapping any product card opens the **Variant Picker Modal**.
  - If a simple product is already in the cart, an inline stepper pill (`-`, quantity, `+`) allows direct adjustments from the catalog grid.

---

### 3.4 Variant Selection Workflow

When tapping a product card, the **Variant Picker Modal** opens:

1. Review the product title, SKU, barcode, and total available variants.
2. In the variant list:
   - Identify the exact variation using attribute tags (e.g., `Color: Navy`, `Size: Large`).
   - Check the stock status: `"In Stock: 12 units"`, `"Low Stock: 2 left"`, or `"0 Stock"`.
   - Verify the variant unit price.
3. To add a variant:
   - Tap **+ Add** on the desired row.
   - Adjust quantity using `-` or `+`, or tap the numeric box to type an exact number directly.
   - The `+` button automatically disables when the quantity matches the maximum available stock.
4. You can select multiple different variants simultaneously within this single modal.
5. Tap the primary bottom button: **Add X Units ($YY.YY)** to insert all chosen variants into your active cart.

---

### 3.5 High-Speed Barcode Scanning

Tap the **Scan** button in the top header to launch the integrated camera scanner (`CameraScannerModal`):

1. **Scanner Controls**:
   - **Mode Toggle**:
     - **Continuous Mode**: Allows rapid scanning of multiple items in succession. Includes a 2.5-second anti-duplicate debounce so the same item is not accidentally rung up twice during a single pass.
     - **Single Mode**: Automatically closes the camera viewfinder immediately after one successful barcode capture.
   - **Flash / Torch**: Tap the flashlight icon to toggle the camera LED for dimly lit stockrooms or shelves.
   - **Close (`X`)**: Exits the scanner and returns to the catalog.
2. **Scanning Actions & Viewfinder HUD**:
   - Align the laser reticle with the barcode or QR code on the physical item.
   - The reticle flashes green, emits an auditory beep, and vibrates upon successful recognition.
   - **HUD Banners**:
     - *Success*: Displays `"Added: [Product Name] ([SKU])"` with `"Qty in cart: X • Y in stock"`.
     - *Stock Reached*: Displays `"Max Stock Reached: [Product Name]"`.
     - *Out of Stock*: Displays `"Out of Stock: [Product Name]"`.
     - *Parent Item Scanned*: If the barcode belongs to a master product with multiple child variants, the scanner announces `"Found: [Product Name]"`, closes the camera, and opens the **Variant Picker Modal** automatically.
3. **Reviewing Scanned Items In-Camera**:
   - Tap **Scanned (X) - $YY.YY** at the bottom left to expand the bottom review sheet.
   - Adjust quantities, review line totals, or tap the trash icon to remove an incorrectly scanned item.
   - Tap **Keep Scanning** to continue or tap **Go to Register** to proceed to checkout.

---

### 3.6 Cart Review & Adjustments (Step 1)

Whenever items are added to the cart, the floating bottom bar (**PosCartBottomBar**) appears, showing the item count and subtotal. Tap **Review & Pay** to open the multi-step checkout sheet:

#### Step 1: Current Sale
1. **Inspecting Cart Items**:
   - Each row displays the product thumbnail, variant attributes, SKU badge, unit price, and line subtotal.
2. **Modifying Quantities**:
   - Tap `+` to increase.
   - Tap `-` to decrease. Decreasing quantity to `0` triggers a confirmation prompt: *"Remove Item: Are you sure you want to remove this item from the cart?"*.
   - Tap the numeric input directly to type bulk quantities (e.g., `50`).
3. **Stock Violations**:
   - If an item in your cart exceeds current store inventory, a warning banner appears: `"Exceeds stock (available: X)"`.
   - The checkout CTA is disabled and reads: **Resolve Stock Warnings to Proceed**. You must reduce the quantity before you can continue.
4. **Clearing the Entire Cart**:
   - Tap **Clear Cart** at the top right.
   - Confirm by tapping **Clear All** on the alert dialog.
5. **Proceeding**:
   - When all items and stock levels are valid, tap **Next: Checkout Details**.

---

### 3.7 Parking Orders & Quotations

If a customer needs to pause their order (e.g., to continue shopping or step away):

#### Parking via Quotation
1. Navigate to the **More** tab -> **Quotations** (or tap **New Quote** from the Home screen).
2. Tap **+ Create Quotation**.
3. Add the customer's items, enter their name/phone, apply any negotiated discounts, and tap **Save Quotation**.
4. The quotation is assigned a code (e.g., `#QT-00124`) with status `DRAFT`.
5. Return to the POS register and tap **Clear Cart** to assist the next customer in line.

#### Restoring a Parked Order / Quote to the POS Register
1. Open **Quotations** from the **More** tab.
2. Tap the quotation card to open the **Quotation Detail Modal**.
3. Tap **Convert Quotation to Sale** (or **Reload Quote**).
4. **Cart Replacement Warning**:
   - If your POS register already contains active items, the system displays:
     > *"Replace Active Register Cart? The register already contains X item(s) in checkout. Loading quotation #QT-XXXXX will replace your current cart and clear unsaved items. Do you want to proceed?"*
   - Tap **Replace Cart & Load**.
5. The POS register opens with all quotation line items, discounts, customer information, and delivery notes fully pre-filled.

---

## 4. Customer Handling & Loyalty

Managing customer relationships and loyalty points is integrated directly into the checkout workflow.

---

### 4.1 Looking Up Existing Customers

In **Step 2: Checkout Details** of the checkout sheet:

1. Scroll to the **Customer & Loyalty** section.
2. In the **Phone Number** or **Customer Name** input fields, begin typing the customer's phone number or name.
3. The system initiates an automated search (after a 300ms pause) against the customer database.
4. A suggestion dropdown appears, displaying:
   - Full Customer Name.
   - Loyalty Tier Badge (`Bronze`, `Silver`, `Gold`, `Platinum`).
   - Phone Number and Delivery Address on file.
   - Lifetime Purchase Metric (e.g., `"Spent $450.00 • 12 orders"`).
5. Tap **Select** on the matching profile:
   - Customer details lock into the sale.
   - If the customer has a delivery address and preferred courier on file, the fulfillment fields are automatically populated.
   - To unlink, tap **Change** or **Clear**.

---

### 4.2 Adding New Customers

- **Automatic Registration at POS**:
  - You do not need to leave the POS register to register a new customer.
  - Type the customer's mobile number into the **Phone Number** field.
  - If no match exists, the field displays a **+ New Member** badge.
  - Type their name into the **Customer Name** field.
  - Complete the sale normally. When checkout is confirmed, the backend automatically creates a new customer profile and links the transaction.
- **Why Can't I Add Customers from the Customers Screen?**:
  - In the standalone **Customers** screen (`CustomersScreen`), the manual `+ Add Customer` and `Edit Profile` buttons are restricted to users with `customers:manage` permissions.
  - As a Seller, your role has `customers:view`. You can view customer order histories and tap **Start Sale** on an existing profile, but all customer creation for Sellers is handled seamlessly through the POS checkout form.

---

### 4.3 Loyalty Points, Tiers & Spend Tracking

When a customer profile is linked to an order, their loyalty summary card displays:
`[Star] X POINTS • $YY.YY LIFETIME SPENT • Z ORDERS`

- **Points Formula**: Customers earn 1 point for every $1.00 spent (`Math.floor(totalSpent)`).
- **Loyalty Tier Thresholds**:
  - **Bronze**: Default starting tier.
  - **Silver**: Lifetime spend >= $200.00 OR completed orders >= 3.
  - **Gold**: Lifetime spend >= $500.00 OR completed orders >= 10.
  - **Platinum**: Lifetime spend >= $1,000.00 OR completed orders >= 20.
- Acknowledge VIP, Gold, and Platinum members during checkout to deliver personalized customer service.

---

### 4.4 Customer Credit & Debt Management

- **Store Credit Ledger**: The system does **not** maintain a digital customer wallet balance or store credit ledger. Customers cannot pay by deducting from a pre-loaded store balance.
- **Customer Debt / Unpaid Orders**:
  - Store debt is tracked exclusively through unpaid order transactions (`status: 'pending'`).
  - To check if a customer owes money:
    1. Open the **More** tab -> **Customer CRM**.
    2. Tap the customer's name to open their profile.
    3. Review the **Order History & Products** list.
    4. Any unpaid balances are marked with an amber badge: `Pending Payment`.
    5. To settle the debt, open the order and tap **Settle** (see Section 7.4).

---

## 5. Checkout & Processing Payments

Checkout is a structured 3-step process accessed via the floating cart bar.

---

### 5.1 Step 2: Fulfillment & Checkout Details

After reviewing the cart in Step 1 and tapping **Next: Checkout Details**, configure the order parameters:

1. **Sales Channel**:
   - Tap the channel dropdown.
   - Select the platform where the sale originated (e.g., `In-Store POS`, `Facebook Page`, `Telegram`, `TikTok Shop`).
2. **Sales Rep (Incentive Credit)**:
   - Defaults to your authenticated user account (`Logged-In Staff (Me)`).
   - If assisting a colleague or ringing up an assisted sale on their behalf, tap the dropdown and select their name from the **Seller Picker Modal**.
   - Tap **Reset to Me** at any time to re-attribute credit to yourself.
3. **Fulfillment Selection**:
   - Tap **In-Store** for standard counter walk-in sales.
   - Tap **Delivery** for courier dispatches:
     - **Delivery Service**: Select the courier company (e.g., J&T Express, Virak Buntham, Kerry Express).
     - **Customer Delivery Address**: Enter the full destination (Street, Sangkat, Khan, Province).
     - **Delivery Zone / Cost**: Select the applicable fixed rate zone or select `Custom / Negotiated Fee`.
     - *If Custom*: Type the negotiated shipping cost into `Custom Delivery Fee ($)`.
4. **Global Discount**:
   - Select **Flat ($)** or **Percent (%)**.
   - Enter the approved discount amount or percentage rate.
5. **Tax**:
   - Select **Flat ($)** or **Percent (%)**.
   - Enter the tax surcharge if applicable (or leave at 0.00).
6. **Payment Method**:
   - Select **Cash** or **Bank Transfer**.
   - *If Bank Transfer*: Tap **Select Bank** to choose the designated business account (e.g., ABA Bank, ACLEDA, Wing Bank).
7. Tap **Review Summary** to validate fields and advance to Step 3.

---

### 5.2 Step 3: Order Summary & Status Selection

Step 3 provides an itemized summary before finalizing the transaction:

1. **Review Breakdown**: Verify item variants, quantities, unit prices, subtotal, delivery fee, discounts, tax, and the final **Grand Total**.
2. **Select Order Status (Critical Step)**:
   - **Paid (Complete)**: Green badge. Select this when payment has been physically received (cash handed over or bank transfer verified).
   - **Pending (Pay Later)**: Amber badge. Select this for pay-on-delivery, deferred payment, or credit sales. Inventory will be deducted immediately, but the sale is logged as unpaid debt.
3. **Final Submission**:
   - If status is Paid, tap **Confirm (Paid)**.
   - If status is Pending, tap **Confirm (Pending)**.
   - The app processes the transaction, clears the active cart, and displays the **Order Receipt Modal**.

---

### 5.3 Handling Cash Sales & Change Calculation

> **Important Operational Note: Manual Change Calculation Required**  
> The mobile app does **not** include an "Amount Tendered" or "Cash Received" field, and does not automatically calculate change due. The system records the exact order total as the cash payment amount (`payment_amount: finalTotal`).

#### Cash Handling Procedure:
1. State the Grand Total clearly to the customer (e.g., *"Your total is $18.50"*).
2. Accept the customer's cash and count it in their presence (e.g., Customer hands you a $20.00 bill).
3. Calculate the change manually or using a physical counter calculator:  
   $$\text{Change Due} = \text{Cash Received} - \text{Grand Total}$$  
   *Example: $\$20.00 - \$18.50 = \$1.50\text{ change due}$.*
4. Count the change out of your cash drawer and hand it to the customer along with their receipt.
5. In Step 3 of checkout, ensure **Paid (Complete)** is selected, then tap **Confirm (Paid)**.

---

### 5.4 Handling KHQR / Bank Transfers

When the customer chooses to pay via mobile banking or KHQR:

1. In Step 2, select **Bank Transfer** under Payment Method.
2. Tap **Select Bank** and select the designated bank account (e.g., `ABA Bank (KHQR)`).
3. If using a counter QR display or the in-app QR code:
   - Ensure the customer scans and completes the transfer on their mobile banking app.
   - **Verify the Transaction**: Visually inspect the customer's confirmation screen or check your store's notification device. Verify the exact timestamp, account name, and amount transferred.
4. Advance to Step 3, confirm the payment status is set to **Paid (Complete)**, and tap **Confirm (Paid)**.

---

### 5.5 Handling Deferred Payments / Pay Later

For wholesale clients, delivery COD orders, or trusted customers paying later:

1. Configure customer details and delivery requirements in Step 2.
2. In Step 3, switch the **Order Status** toggle to **Pending (Pay Later)**.
3. Tap **Confirm (Pending)**.
4. The system:
   - Immediately reserves and decrements the physical stock from inventory.
   - Records the transaction under your sales attribution.
   - Flags the receipt and transaction record with an amber `Pending • $YY.YY` badge.

---

### 5.6 Split Payment Limitations

- **Single Tender Only at POS Checkout**: The POS checkout engine supports only **one** payment method per transaction. You cannot split a single sale at checkout (e.g., paying $10.00 in Cash and $15.00 via ABA KHQR).
- If a customer insists on splitting tender across multiple methods, process the transaction as two separate sales or consult your manager.
- *(Note: Invoices support multiple installment payments recorded over time, but POS sales require a single tender selection).*

---

## 6. Receipts & Thermal Printing

Immediately after confirming an order, the **Order Receipt Modal** (`OrderReceiptModal`) appears. This screen displays the digital receipt and hardware controls.

---

### 6.1 Digital Receipt Overview

The digital receipt renders a standard receipt layout:
- Store header, branding logo, phone number, and physical store address.
- Cashier name, credited sales representative, sales channel, date, and exact timestamp.
- Order sequence number (e.g., `#ORD-2026-00482`).
- Customer name, phone number, and delivery address (if applicable).
- Itemized product list: item title, variant attributes, SKU, quantity x unit price, and line totals.
- Subtotal, discounts, shipping fee, tax, and Grand Total.
- Payment status badge (`PAID IN FULL` or `PENDING PAYMENT`).
- Footer policy text (e.g., *"Thank you for shopping with us! Items sold are not returnable."*).

---

### 6.2 Thermal Printer Setup & Hardware Support

The application includes an ESC/POS thermal printing engine (`thermalPrinter.ts`):

- **Supported Paper Widths**:
  - `58mm` (standard mini mobile printer, 32 characters per line).
  - `80mm` (standard counter printer, 48 characters per line).
- **Supported Connection Protocols**:
  1. **Wi-Fi / Network TCP (Port 9100)**: Direct socket connection to network printers.
  2. **Bluetooth**: Direct wireless connection to paired mobile belt printers (e.g., MPT-II, RPP02N, XP-58, PT-210).
  3. **AirPrint / System Print**: Standard mobile OS print sheet via `expo-print`.
- **Text Sanitization**: The printing engine automatically strips non-standard Unicode characters, zero-width spaces, and directional marks to prevent character distortion on thermal printouts.

---

### 6.3 Printing Receipts

1. From the **Order Receipt Modal**, tap **Print**.
2. **Single Station Setup**: If only one printer is configured, the print job transmits immediately.
3. **Multiple Stations Setup**: If your store uses multiple printers, the **Printer Station Picker** (`PrinterPickerModal`) opens:
   - Tap your preferred printer device card (displays name, interface badge e.g. `Wi-Fi` or `Bluetooth`, role `Customer Receipt`, and paper size).
   - Or tap **Print to All Stations** to trigger all configured printers simultaneously (e.g., counter receipt and packing station).
4. After printing finishes, tap **New Sale** to clear the screen for the next transaction, or tap **Close Receipt** to stay on the register.

---

### 6.4 Sharing Receipts Digitally

For remote customers, delivery orders, or paperless transactions:

1. In the **Order Receipt Modal**, tap **Share**.
2. The button updates to show an activity indicator: `Preparing...`.
3. The system captures an off-screen, full-length copy of the receipt (preventing scroll clipping) and rasterizes it into a high-resolution PNG image.
4. The native device sharing sheet opens.
5. Select **Telegram**, **WhatsApp**, **Messenger**, **Email**, or **Save to Gallery** to deliver the digital receipt image directly to the customer.

---

## 7. Order History & Post-Sale Actions

Past sales, pending orders, and transaction audits are managed through the **Transactions** screen (`TransactionsScreen`), accessible via the bottom navigation bar or the Hub.

---

### 7.1 Finding & Filtering Orders

The transaction feed supports real-time filtering:
1. **Search Input**: Type the customer name, phone number, order number (`#ORD-...`), or item SKU.
2. **Date Presets**: Tap the filter chips: `All`, `Today`, `7 Days`, `30 Days`, `This Month`, or select a custom date range.
3. **Status Filter**: Tap to filter by `Completed` (Paid), `Pending` (Unpaid), or `Cancelled` (Voided).
4. **Payment Method Filter**: Filter by `Cash`, `Bank`, or `ABA KHQR`.
5. **Channel Filter**: Isolate orders originating from `In-Store POS`, `Telegram`, `Facebook`, etc.

---

### 7.2 Inspecting Orders & Reprinting Receipts

1. Locate and tap any order card in the transaction list.
2. The full **Order Receipt Modal** opens.
3. Tap **Print** to send a duplicate copy to your thermal printer.
4. Tap **Share** to re-export and send the digital receipt image.

---

### 7.3 Editing Order Details Post-Sale

If customer delivery information, remarks, or staff attribution needs correction:
1. Open the order in the **Order Receipt Modal**.
2. Tap the **Edit** button on the status card to open the **Edit Order Info** modal.
3. You can modify:
   - **Order Notes / Remarks**: Enter delivery instructions, tracking numbers, or transaction notes.
   - **Delivery Address / Location**: Update shipping addresses for dispatches.
   - **Sales Representative (Credited Seller)**: Reassign sales credit if an assisted sale was attributed to the wrong employee.
4. Tap **Save Changes**.

---

### 7.4 Settling Pending (Unpaid) Orders

When a customer pays for an order previously marked as `Pending (Pay Later)`:

1. Open the **Transactions** screen and locate the pending order (marked with an amber badge).
2. Tap the order to open the **Order Receipt Modal**.
3. Tap the **Settle** button on the status card.
4. The **Settle Payment** modal opens, displaying the outstanding balance.
5. Select the payment method received:
   - `ABA / KHQR`
   - `Cash`
   - `ACLEDA`
   - `Wing Bank`
   - `Card / POS`
6. Tap **Confirm & Settle**.
7. The order status updates immediately to `Completed` (Paid in Full), customer spend totals reflect the completed payment, and your daily settlement records update.

---

### 7.5 Order Cancellation / Void Policy & Permissions

> **Crucial Policy: Sellers Cannot Void Orders Directly**

- **The Void Button**: You will notice a **Void** button inside the **Order Receipt Modal**.
- **Permission Restriction**: The backend API strictly guards the cancellation endpoint. Only users with `SUPER_ADMIN`, `ADMIN`, `MANAGER`, or an explicit `orders:cancel` permission override are authorized to cancel orders.
- **What Happens If a Seller Taps Void?**:
  - Tapping Void displays a confirmation prompt: *"Are you sure you want to cancel Order #...? This will restore all items back to stock."*
  - If you tap **Yes, Cancel Order**, the server rejects the request with **HTTP 403 Forbidden**.
  - The mobile app displays an error toast:
    > *"Failed to cancel order: Unauthorized to cancel orders. Manager or orders:cancel permission required."*
- **Required Procedure**: If an order was entered by mistake or a customer cancels:
  1. Note the Order Number (e.g., `#ORD-2026-00192`).
  2. Inform your store Manager or Admin immediately.
  3. The Manager will sign into their terminal, locate the order, and execute the cancellation.

---

### 7.6 Refunds & Stock Reversals

- **No Standalone Refund Screen**: There is no separate "Refund" button or partial item return module in the mobile app.
- **How Returns/Refunds are Handled**:
  - Refunds are processed exclusively via order **Cancellation / Void** by a Manager.
  - When an authorized manager voids the transaction, the database automatically:
    1. Reverses the customer's recorded lifetime spend and loyalty points.
    2. Generates an automated inventory movement record: `movement_type = 'CANCELLATION_REVERSAL'`.
    3. Returns all item quantities back to available stock.

---

## 8. Shift Closing & End-of-Day Reconciliation

At the conclusion of your shift, you must complete your daily sales reconciliation and sign-off. This locks your sales records, verifies order attribution, and calculates your sales incentive commission.

---

### 8.1 Personal Shift Card Overview

On the **Home** screen, your hero card is the **Personal Shift Card**:
- **Greeting**: `"Hello, [Your Name]"`
- **Subtitle**: `"Today's Shift • Sales, Orders & Commission"`
- **Metrics**:
  - **MY SALES**: Total dollar volume of sales attributed to you today.
  - **ORDERS**: Total number of orders credited to your account.
  - **MY COMMISSION**: Estimated commission incentive earned based on confirmed rules.
- **Sign Off Sales**: On today's shift, tap the **Sign Off Sales** button (or tap the reconciliation icon in the POS header) to open the **Daily Sales Sign-Off Modal** (`SellerDailySummaryModal`).

---

### 8.2 Reviewing Credited Orders & Attribution

Inside the **Daily Sales Sign-Off Modal**:

1. **Date Navigation**: Confirm the active date is set to **Today**. (You can tap `Prev` to review past closed shifts).
2. **Status Banner**:
   - **Pending Daily Confirmation**: Displayed in amber. Your shift is currently open.
   - **Confirmed & Signed Off**: Displayed in green. Proof is locked.
   - **Orders Revised - Re-confirmation Needed**: Displayed if an order was modified or reassigned after an earlier sign-off.
3. **KPI Summary Cards**:
   - `TOTAL SALES`: Total value of all credited transactions.
   - `EST. INCENTIVE`: Total earned commission.
4. **Attribution Split**:
   - **Direct Orders**: Transactions you created and rung up directly.
   - **Assisted Orders**: Transactions rung up by a colleague where you were credited as the sales representative.
   - Use the filter tabs (`All`, `Direct`, `Assisted`) to inspect individual orders, customer names, line totals, and earned commission per ticket.

---

### 8.3 Reconciling Cash & Counting the Register

Before submitting your digital sign-off, reconcile your physical cash drawer:

1. Filter your transactions for the day by payment method: **Cash**.
2. Note the system's total cash sales figure.
3. Count all physical cash bills and coins in your cash drawer.
4. Deduct your store's static starting cash float (e.g., $100.00).
5. Compare the remaining counted cash against the system cash total:  
   $$\text{Cash Variance} = (\text{Total Counted Cash} - \text{Starting Float}) - \text{System Total Cash Sales}$$
6. **Reconciliation Outcomes**:
   - **Balanced ($0.00 Variance)**: Physical cash matches system records exactly.
   - **Overage (Positive Variance)**: More physical cash than recorded.
   - **Shortage (Negative Variance)**: Less physical cash than recorded.
7. **Documenting Variances**: In the **Optional note for manager / settlement audit...** field within the sign-off modal, enter any variance explanations (e.g., *"Cash balanced. Over by $0.50 due to customer leaving small change"* or *"Short $2.00 on cash drawer"*).

---

### 8.4 Submitting Official Sign-Off

1. Once all transactions are verified and your note is typed, tap **Confirm & Sign Off Today's Sales**.
2. A confirmation dialog appears:
   > *"Confirm Today's Sales & Incentive: Are you sure you want to sign off on today's sales? This will record your official settlement proof."*
3. Tap **Confirm & Sign Off**.
4. The system:
   - Calls `POST /api/v1/seller-settlements/confirm`.
   - Generates an immutable `SellerDailySettlement` record.
   - Locks the list of order IDs, timestamp, and your digital signature.
   - Updates the status banner to green: **Confirmed & Signed Off**.

---

### 8.5 Printing the Daily Thermal Reconciliation Slip

After signing off, print a physical copy of your daily reconciliation slip for your manager or shift deposit envelope:

1. Tap **Print Daily Slip** at the top of the sign-off modal.
2. Your thermal printer prints the **Daily Sales Reconciliation Slip**:
   - Header: `*** DAILY SALES RECONCILIATION ***`
   - Date and Seller Name.
   - Status: `CONFIRMED` with exact signature timestamp.
   - Total Orders and Total Sales volume.
   - Total Commission Incentive earned.
   - Direct vs. Assisted order counts.
   - Detailed breakdown of all assisted orders and assisting staff.
3. Place the printed slip inside your daily cash deposit envelope alongside your physical cash.

---

## 9. Offline Mode & Sync Guidelines

The mobile app includes an offline contingency engine (`useOfflineQueue`) to ensure you can continue ringing up sales if the store internet connection drops.

---

### 9.1 Local Storage Architecture

- **No SQLite Requirement**: The app utilizes `@react-native-async-storage/async-storage` for local persistence.
- **Cached Catalog**: The product catalog, pricing, categories, and active channels are cached locally via TanStack Query for up to 24 hours.
- **Offline Mutation Queue**: When offline, completed sales are placed in a persistent queue (`@kc_inventory_offline_queue`) on your device.

---

### 9.2 Ringing Up Sales While Disconnected

1. Add items to the cart and navigate through checkout steps normally.
2. In Step 3, tap **Confirm (Paid)** or **Confirm (Pending)**.
3. The app detects that the server cannot be reached (`isNetworkError: true`).
4. The order is automatically assigned a unique client mutation UUID (`client_mutation_id`) and stored in the offline queue.
5. The app displays an alert:
   > *"Saved Offline: Network connection unavailable. Order has been saved to offline queue and will sync automatically."*
6. Tap **OK**. The cart clears, and the POS register is ready for the next customer.

---

### 9.3 Offline Indicators & Monitoring

Pay close attention to these on-screen indicators during network outages:

1. **Network Status Banner (`NetworkStatusBanner`)**:
   - Appears directly beneath the top header.
   - **Device Offline (Red Banner)**: *"No Internet Connection. You are offline. Transactions will be saved locally."*
   - **Server Unreachable (Amber Banner)**: *"Server Unreachable. Cannot reach backend server. Tap to retry."* Includes a manual retry button.
2. **Global Header Sync Button**:
   - An amber sync button appears in the top header displaying the number of pending unsynced sales (e.g., `Sync (3)`).
   - Tapping this button triggers an immediate manual sync attempt.
3. **Bottom Tab Bar Badge**:
   - The **Transactions** tab displays a numeric badge showing the number of offline orders waiting to sync.

---

### 9.4 Synchronization Process

- **Automatic Sync**: As soon as your device reconnects to Wi-Fi or cellular data, the app detects the connection and initiates queue processing in the background.
- **Idempotent Safety**: Every offline order contains a unique client mutation UUID. The backend checks `client_mutation_id` before saving. If an order was already received, the server returns the existing record without duplicating charges or stock deductions.
- **Retry Policy**: The queue attempts synchronization using exponential backoff. If an order fails to upload, it retries up to **3 times** before stopping.

---

### 9.5 Critical Offline Limitations & Risks

1. **No Real-Time Stock Validation**:
   - The app can only check against cached stock levels on your phone.
   - If another terminal or online store sold the last unit of an item while you were offline, a **Stock Conflict** occurs when syncing: the server rejects the order with `Insufficient stock for [SKU]` (HTTP 422).
   - **Rule**: Avoid selling items marked as "Low Stock" when your terminal is offline.
2. **Thermal Receipts Skipped During Offline Checkouts**:
   - Because offline sales have not yet reached the server, an official sequence number (`#ORD-2026-XXXXX`) cannot be generated.
   - The app skips the **Order Receipt Modal** when saving offline. You cannot print an official server receipt until the transaction syncs. Provide the customer with a manual receipt if required.
3. **Customer Search is Disabled**:
   - The customer autocomplete search requires active server communication. Offline customer lookups will not return results unless the profile was queried earlier in your active session.
   - For new customers, type their phone number and name manually. The record will be created when the terminal syncs.

---

## 10. Best Practices & Troubleshooting Guide

---

### 10.1 Thermal Printer Issues

#### Problem: Printer does not print or print button does nothing
- **Check Bluetooth**: Ensure Bluetooth is turned on in your mobile device's system settings. Verify that the printer is paired with your phone (PIN is usually `0000` or `1234`).
- **Check Wi-Fi / LAN IP**: If using a network printer, ensure your phone is connected to the store's local Wi-Fi network and not cellular data. Network printers communicate over port 9100.
- **Printer Station Configuration**:
  1. Go to the **More** tab -> tap **App Settings** (or access Printer Settings from the printer picker).
  2. Check the **Printer Stations** list. Ensure a station exists with the role set to **Customer Receipt**.
  3. Tap **Test Print**. If the test page fails, tap **Edit**, verify the IP address or Bluetooth device name, and save.
- **Paper Roll Orientation**: Thermal paper only prints on one side. If the printer feeds blank paper, open the cover and flip the paper roll over.

#### Problem: Printout text displays unreadable characters or garbage symbols
- This occurs when non-standard text encoding is sent to an ESC/POS printer. The app contains an automatic text sanitizer (`sanitizeThermalText()`). If garbage characters persist, verify that the paper width setting in Printer Settings matches your physical hardware (`58mm` vs `80mm`).

---

### 10.2 Barcode Scanner Issues

#### Problem: Camera scanner does not open or shows a black screen
- **Check Camera Permissions**: Go to your device's operating system settings -> Apps -> KC Inventory -> Permissions -> **Camera** -> Select **Allow while using the app**.
- **Close Competing Apps**: Force-close any background apps that may be using the camera hardware.

#### Problem: Scanner fails to recognize barcodes
- **Lighting**: Tap the flashlight/torch icon in the top header to illuminate poorly lit items.
- **Distance & Focus**: Hold the phone 15 to 20 cm away from the barcode. Avoid glare from plastic wrapping or glossy labels.
- **Damaged Labels**: If a barcode is smudged or torn, use the manual search bar to type the alphanumeric SKU or product title instead.

#### Problem: Barcode scans an item but does not add it to the cart
- **Check Viewfinder HUD Banner**:
  - If the banner reads `"Out of Stock"`, the item cannot be added because available inventory is zero.
  - If the banner reads `"Found: [Product Name]"`, the item is a master product with multiple options. The camera will close and open the **Variant Picker Modal** so you can pick the exact variant.
  - If the banner reads `"Product Deactivated"`, inform your manager that the SKU has been disabled in the master catalog.

---

### 10.3 Offline Sync Conflicts & Errors

#### Problem: The header displays "Sync (X)" and orders are not uploading
1. Check the **Network Status Banner**. If it reads `"Server Unreachable"`, tap the banner to run a health check against `/api/v1/health`.
2. Toggle your device's Airplane Mode on, wait 5 seconds, and toggle it off to re-establish network routing.
3. Tap the amber **Sync** button in the global header to manually re-trigger the upload queue.
4. If an order repeatedly fails after 3 attempts, review your connection speed. Do not log out or clear the app storage, as doing so will erase the queued orders.

#### Problem: Sync fails with "Insufficient Stock"
- Another terminal sold the item while your device was offline. Note the customer phone number and item SKU from the error message, set the physical item aside, and notify your store manager to perform an inventory adjustment or contact the customer.

---

### 10.4 Common Alert Messages & Resolutions

| Alert / Error Message | Root Cause | Correct Resolution |
| :--- | :--- | :--- |
| `"Access Restricted: You do not have permission to access this module."` | Tapped a restricted tab (e.g. Products, Expenses, Reports, or Admin). | As a Seller, your access is focused on Sales, Transactions, Quotations, and Customers. Contact your manager if your responsibilities have changed. |
| `"Failed to cancel order: Unauthorized to cancel orders. Manager or orders:cancel permission required."` | Attempted to void/cancel an order via the receipt modal. | Sellers cannot void completed sales. Note the order number and ask an Admin or Manager to cancel it. |
| `"Resolve Stock Warnings to Proceed"` | A cart item exceeds available warehouse or shelf inventory. | Reduce the item quantity in Step 1 of checkout until it is within stock limits. |
| `"Replace Active Register Cart?"` | Attempting to convert a quotation while items are already in the active register cart. | Tap `Replace Cart & Load` to overwrite the register, or tap `Cancel` to complete the active sale first. |
| `"Session Expired"` | Account logged into from another phone, or token expired. | Tap OK and sign in again with your email and password. |

---

### 10.5 Daily Operating Checklist for Sellers

1. **Shift Start**:
   - Sign in using your individual credentials.
   - Verify your physical cash drawer float with your manager according to store policy.
   - Power on the thermal printer, verify paper roll supply, and run a **Test Print** from Settings.
2. **During Shift**:
   - Keep the POS screen on the active **Sales** register tab.
   - Use **Continuous Mode** scanning for multi-item customer baskets.
   - Look up customer phone numbers to award loyalty points.
   - Calculate cash change carefully.
   - Mark orders as **Paid (Complete)** only after cash is in hand or digital bank transfer is confirmed on-screen.
3. **Shift End**:
   - Navigate to **Home** -> tap **Sign Off Sales**.
   - Reconcile physical cash against the system's cash total.
   - Add notes explaining any cash drawer variance.
   - Tap **Confirm & Sign Off Today's Sales** to lock in your sales proof and commissions.
   - Tap **Print Daily Slip** and attach the receipt to your cash deposit envelope.
   - Sign out of the mobile app if using a shared store terminal.