"""
Tier 3: Cross-Feature Combinations - Catalog -> Scanner -> Cart -> Checkout -> Ledger Flow.
Tests end-to-end multi-feature sequences connecting variant generation, scanner resolution,
cart payload assembly, atomic checkout, and inventory movement audit ledgering.
"""

import pytest
import uuid


def test_end_to_end_create_scan_cart_checkout_verify_ledger(api, db, pos_channel_id):
    """
    Complete flow:
    1. Create multi-variant Polo Shirt (Size S, M x Color Red, Blue = 4 variants)
    2. Restock variants with initial quantities
    3. Simulate cashier barcode scanner resolving SKU 'POLO-SHIRT-M-BLUE'
    4. Build active cart payload with scanned variant
    5. Execute checkout with ABA QR payment
    6. Verify stock decremented and immutable stock_movements ledger entry recorded
    """
    # 1. Create Product
    prod_resp = api.create_product({
        "name": "Polo Shirt",
        "barcode": "8939900112233",
        "purchase_price": 8.00,
        "selling_price": 22.00,
        "attributes": [
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000001",
                "value_ids": ["b0000000-0000-0000-0000-000000000001", "b0000000-0000-0000-0000-000000000002"] # S, M
            },
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000002",
                "value_ids": ["c0000000-0000-0000-0000-000000000001", "c0000000-0000-0000-0000-000000000002"] # Red, Blue
            }
        ]
    })
    assert prod_resp.is_success
    product = prod_resp.data
    variants = product["variants"]
    assert len(variants) == 4

    # 2. Restock
    restock_items = []
    for idx, v in enumerate(variants):
        barcode = f"89399001122{idx:02d}"
        v["barcode"] = barcode
        api.engine.product_variants[v["id"]]["barcode"] = barcode
        restock_items.append({"variant_id": v["id"], "quantity": 15, "unit_cost": 8.00, "scanned_barcode": barcode})

    api.restock({"status": "COMPLETED", "items": restock_items})

    # 3. Scan SKU directly
    target_sku = "POLO-SHIRT-M-BLUE"
    scan_resp = api.scan_barcode(target_sku)
    assert scan_resp.is_success
    assert scan_resp.data["type"] == "VARIANT"
    scanned_var = scan_resp.data["variant"]
    assert scanned_var["sku"] == target_sku
    assert scanned_var["quantity_on_hand"] == 15

    # 4. Build Cart & Checkout
    mutation_id = str(uuid.uuid4())
    checkout_resp = api.checkout({
        "client_mutation_id": mutation_id,
        "channel_id": pos_channel_id,
        "customer": {"phone": "+85512998877", "name": "Sophea Kem"},
        "items": [{"variant_id": scanned_var["id"], "quantity": 3, "unit_price": scanned_var["selling_price"]}],
        "discount": 0.00,
        "payment": {"payment_method": "ABA_QR", "amount": 66.00, "transaction_ref": "ABA-E2E-7788"}
    })
    assert checkout_resp.is_success
    order = checkout_resp.data
    assert order["total_amount"] == 66.00

    # 5. Verify DB State & Ledger
    db.assert_stock_level(scanned_var["id"], 12)
    db.assert_movement_recorded(scanned_var["id"], "SALE", -3, reference_id=order["order_number"])


def test_master_barcode_scan_to_multi_variant_cart_checkout(api, db, pos_channel_id):
    """
    Flow:
    1. Scan Master product barcode -> Expands to 6 variants
    2. Cashier selects 2 distinct variants from the picker modal
    3. Both variants added to cart and checked out in a single atomic transaction
    4. Verify individual stock movements recorded for both variants
    """
    master_barcode = "8937766554433"
    prod_resp = api.create_product({
        "name": "Athletic Socks",
        "barcode": master_barcode,
        "purchase_price": 1.50,
        "selling_price": 4.50,
        "attributes": [
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000001",  # Size S, M, L
                "value_ids": ["b0000000-0000-0000-0000-000000000001", "b0000000-0000-0000-0000-000000000002", "b0000000-0000-0000-0000-000000000003"]
            }
        ]
    })
    variants = prod_resp.data["variants"]
    # Restock each variant
    api.restock({
        "status": "COMPLETED",
        "items": [{"variant_id": v["id"], "quantity": 20, "unit_cost": 1.50} for v in variants]
    })

    # Step 1: Scan master barcode
    scan_resp = api.scan_barcode(master_barcode)
    assert scan_resp.is_success
    assert scan_resp.data["type"] == "PRODUCT"
    resolved_variants = scan_resp.data["product"]["variants"]
    assert len(resolved_variants) == 3

    # Step 2: Pick 2 variants
    v1 = resolved_variants[0]
    v2 = resolved_variants[1]

    # Step 3: Checkout
    mutation_id = str(uuid.uuid4())
    order_resp = api.checkout({
        "client_mutation_id": mutation_id,
        "channel_id": pos_channel_id,
        "items": [
            {"variant_id": v1["id"], "quantity": 4, "unit_price": 4.50},
            {"variant_id": v2["id"], "quantity": 2, "unit_price": 4.50},
        ],
        "payment": {"payment_method": "CASH", "amount": 27.00}
    })
    assert order_resp.is_success
    order_num = order_resp.data["order_number"]

    # Step 4: Verify stock decrements & movements
    db.assert_stock_level(v1["id"], 16)
    db.assert_stock_level(v2["id"], 18)
    db.assert_movement_recorded(v1["id"], "SALE", -4, reference_id=order_num)
    db.assert_movement_recorded(v2["id"], "SALE", -2, reference_id=order_num)


def test_override_pricing_in_scanner_and_checkout(api, pos_channel_id):
    """Variant pricing override is reflected in scan response and honored in order calculation."""
    prod_resp = api.create_product({
        "name": "Leather Wallet",
        "purchase_price": 10.00,
        "selling_price": 25.00,
        "variants": [
            {"sku": "WALLET-STD", "selling_price_override": None, "quantity_on_hand": 5},
            {"sku": "WALLET-ENGRAVED", "selling_price_override": 35.00, "quantity_on_hand": 5}
        ]
    })
    engraved_var = next(v for v in prod_resp.data["variants"] if v["sku"] == "WALLET-ENGRAVED")

    # Scan
    scan_resp = api.scan_barcode("WALLET-ENGRAVED")
    assert scan_resp.is_success
    assert scan_resp.data["variant"]["selling_price"] == 35.00

    # Checkout using automatic price lookup
    order_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": engraved_var["id"], "quantity": 2}],
        "payment": {"payment_method": "CASH", "amount": 70.00}
    })
    assert order_resp.is_success
    assert order_resp.data["subtotal"] == 70.00
    assert order_resp.data["total_amount"] == 70.00


def test_catalog_creation_with_immediate_restock_and_checkout(api, db, pos_channel_id):
    """Verify newly created product can be immediately restocked and sold."""
    prod_resp = api.create_product({
        "name": "Quick Sell Mug",
        "purchase_price": 2.00,
        "selling_price": 6.00,
        "variants": [{"sku": "MUG-WHITE", "quantity_on_hand": 0}]
    })
    var_id = prod_resp.data["variants"][0]["id"]
    db.assert_stock_level(var_id, 0)

    # Restock 50 units
    api.restock({
        "status": "COMPLETED",
        "items": [{"variant_id": var_id, "quantity": 50, "unit_cost": 2.00}]
    })
    db.assert_stock_level(var_id, 50)

    # Sell 10 units
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 10, "unit_price": 6.00}],
        "payment": {"payment_method": "CASH", "amount": 60.00}
    })
    db.assert_stock_level(var_id, 40)
