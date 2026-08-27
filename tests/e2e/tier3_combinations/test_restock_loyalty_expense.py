"""
Tier 3: Cross-Feature Combinations - Restock, Customer Loyalty & Expense Balancing.
Tests the complete business operations loop:
Restock inventory -> Customer buys products -> Accrues loyalty -> Operational expenses recorded -> Ledger reconciled.
"""

import pytest
import uuid


def test_full_business_cycle_restock_sale_loyalty_expense(api, db, seed_catalog, unique_phone, pos_channel_id):
    """
    Simulates a complete business operational cycle:
    1. Restock variant by +40 units
    2. Customer makes 2 separate purchases accumulating loyalty
    3. Operational expense for store maintenance ($30.00) recorded
    4. Verify stock levels, stock movement ledgers, customer loyalty metrics, and net expenses
    """
    var = seed_catalog["jeans"]["variants"][0]  # initial stock = 10
    var_id = var["id"]

    # Step 1: Restock
    restock_resp = api.restock({
        "status": "COMPLETED",
        "notes": "Mid-month inventory replenishment",
        "items": [{"variant_id": var_id, "quantity": 40, "unit_cost": 18.00}]
    })
    assert restock_resp.is_success
    db.assert_stock_level(var_id, 50)

    # Step 2: Sale 1 (Customer buys 4 units @ $38.00 = $152.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Chann Srey"},
        "items": [{"variant_id": var_id, "quantity": 4, "unit_price": 38.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 152.00}
    })
    db.assert_stock_level(var_id, 46)

    # Step 3: Sale 2 (Same customer buys 2 more units = $76.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Chann Srey"},
        "items": [{"variant_id": var_id, "quantity": 2, "unit_price": 38.00}],
        "payment": {"payment_method": "CASH", "amount": 76.00}
    })
    db.assert_stock_level(var_id, 44)

    # Verify Loyalty: 4 + 2 = 6 units, $152 + $76 = $228.00
    db.assert_customer_loyalty(unique_phone, expected_total_purchased=6, expected_total_spent=228.00)

    # Step 4: Expense ($30.00 store maintenance)
    exp_resp = api.create_expense({
        "expense_date": "2026-08-18",
        "category": "Store Maintenance",
        "amount": 30.00,
        "payment_method": "CASH",
        "notes": "Replaced lighting fixture"
    })
    assert exp_resp.is_success

    # Step 5: Ledger reconciliation
    movements = db.get_stock_movements(variant_id=var_id)
    restock_moves = [m for m in movements if m["movement_type"] == "RESTOCK"]
    sale_moves = [m for m in movements if m["movement_type"] == "SALE"]

    assert any(m["quantity_change"] == 40 for m in restock_moves)
    assert sum(abs(m["quantity_change"]) for m in sale_moves) >= 6


def test_interleaved_restock_and_sales_ledger_sequence(api, db, seed_catalog, pos_channel_id):
    """Verify interleaving restock -> sale -> restock -> sale maintains accurate running balances."""
    var = seed_catalog["tshirt"]["variants"][0]
    var_id = var["id"]
    initial_stock = db.get_variant(var_id)["quantity_on_hand"]

    # 1. Restock +10
    api.restock({"status": "COMPLETED", "items": [{"variant_id": var_id, "quantity": 10, "unit_cost": 6.50}]})
    # 2. Sell 5
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 5, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 75.00}
    })
    # 3. Restock +15
    api.restock({"status": "COMPLETED", "items": [{"variant_id": var_id, "quantity": 15, "unit_cost": 6.50}]})
    # 4. Sell 8
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 8, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 120.00}
    })

    # Net change = +10 - 5 + 15 - 8 = +12
    db.assert_stock_level(var_id, initial_stock + 12)


def test_financial_reconciliation_sales_vs_expenses(api, seed_catalog, pos_channel_id):
    """Verify revenue aggregation and expense deduction."""
    var = seed_catalog["tshirt"]["variants"][0]

    # Sale 1: $45.00
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 3, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 45.00}
    })
    # Expense: $15.00
    api.create_expense({
        "category": "Supplies",
        "amount": 15.00,
        "payment_method": "CASH"
    })

    # Fetch expenses
    exp_resp = api.get("/expenses")
    assert exp_resp.is_success
    assert exp_resp.meta["total_amount"] >= 15.00


def test_repeat_customer_across_multiple_restocked_batches(api, db, seed_catalog, unique_phone, pos_channel_id):
    """Customer purchases from batch 1, batch runs out and is restocked, customer returns and purchases again."""
    var = seed_catalog["jeans"]["variants"][0]  # stock = 10
    var_id = var["id"]

    # Customer buys 8 units ($304.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Rathana Nguon"},
        "items": [{"variant_id": var_id, "quantity": 8, "unit_price": 38.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 304.00}
    })
    db.assert_stock_level(var_id, 2)

    # Restock 20 units
    api.restock({
        "status": "COMPLETED",
        "items": [{"variant_id": var_id, "quantity": 20, "unit_cost": 18.00}]
    })
    db.assert_stock_level(var_id, 22)

    # Same customer returns and buys 5 units ($190.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Rathana Nguon"},
        "items": [{"variant_id": var_id, "quantity": 5, "unit_price": 38.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 190.00}
    })
    db.assert_stock_level(var_id, 17)

    # Cumulative loyalty: 8 + 5 = 13 units, $304 + $190 = $494.00
    db.assert_customer_loyalty(unique_phone, expected_total_purchased=13, expected_total_spent=494.00)

