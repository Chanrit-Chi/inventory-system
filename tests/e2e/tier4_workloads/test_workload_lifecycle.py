"""
Tier 4: Realistic Omnichannel Application Workloads - Full Retail Day Lifecycle.
Simulates an entire operating day of a modern retail boutique:
- 08:00 AM: Morning stock arrival & batch restock session
- 10:30 AM: Walk-in customers purchasing via Mobile POS & Cashier POS
- 01:00 PM: Midday operational expense payouts (staff meal, packaging supplies)
- 03:00 PM: Web store ecommerce orders with delivery dispatching
- 06:00 PM: Evening restock replenishment
- 08:00 PM: End-of-day ledger reconciliation and order audit verification
"""

import pytest
import uuid


def test_workload_retail_day_omnichannel_lifecycle(api, db, seed_catalog, pos_channel_id, web_channel_id, mobile_channel_id):
    """Execute complete full-day retail omnichannel sales lifecycle scenario."""
    tshirt_red_s = seed_catalog["tshirt"]["variants"][0]  # initial stock = 20
    tshirt_red_m = seed_catalog["tshirt"]["variants"][1]  # initial stock = 20
    jeans_30 = seed_catalog["jeans"]["variants"][0]       # initial stock = 10

    # -------------------------------------------------------------
    # 08:00 AM: Morning Batch Restock
    # -------------------------------------------------------------
    morning_restock = api.restock({
        "status": "COMPLETED",
        "notes": "Morning supplier delivery - Batch #441",
        "items": [
            {"variant_id": tshirt_red_s["id"], "quantity": 30, "unit_cost": 6.50},  # stock: 20 + 30 = 50
            {"variant_id": tshirt_red_m["id"], "quantity": 30, "unit_cost": 6.50},  # stock: 20 + 30 = 50
            {"variant_id": jeans_30["id"], "quantity": 20, "unit_cost": 18.00},     # stock: 10 + 20 = 30
        ]
    })
    assert morning_restock.is_success
    db.assert_stock_level(tshirt_red_s["id"], 50)
    db.assert_stock_level(tshirt_red_m["id"], 50)
    db.assert_stock_level(jeans_30["id"], 30)

    # -------------------------------------------------------------
    # 10:30 AM: In-Store Walk-in Sales (POS & Mobile)
    # -------------------------------------------------------------
    # Customer 1 buys 2x Red T-Shirt S using Cash at POS
    order1 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": "+85512800001", "name": "Monirath Sok"},
        "items": [{"variant_id": tshirt_red_s["id"], "quantity": 2, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 30.00}
    })
    assert order1.is_success

    # Customer 2 buys 1x Red T-Shirt M + 1x Jeans 30 using ABA QR via Mobile POS
    order2 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": mobile_channel_id,
        "customer": {"phone": "+85512800002", "name": "Vannak Meas"},
        "items": [
            {"variant_id": tshirt_red_m["id"], "quantity": 1, "unit_price": 15.00},
            {"variant_id": jeans_30["id"], "quantity": 1, "unit_price": 38.00},
        ],
        "payment": {"payment_method": "ABA_QR", "amount": 53.00, "transaction_ref": "ABA-EOD-002"}
    })
    assert order2.is_success

    # -------------------------------------------------------------
    # 01:00 PM: Midday Operational Expenses
    # -------------------------------------------------------------
    exp1 = api.create_expense({
        "expense_date": "2026-08-18",
        "category": "Store Supplies",
        "amount": 25.00,
        "payment_method": "CASH",
        "notes": "Packaging bags & thermal printer paper"
    })
    assert exp1.is_success

    exp2 = api.create_expense({
        "expense_date": "2026-08-18",
        "category": "Staff Refreshments",
        "amount": 12.50,
        "payment_method": "ABA_TRANSFER",
        "notes": "Team lunch drinks"
    })
    assert exp2.is_success

    # -------------------------------------------------------------
    # 03:00 PM: Web Store E-Commerce Orders
    # -------------------------------------------------------------
    # Customer 3 buys 5x Red T-Shirt S with delivery
    order3 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "customer": {"phone": "+85512800003", "name": "Kalyan Tep"},
        "items": [{"variant_id": tshirt_red_s["id"], "quantity": 5, "unit_price": 15.00}],
        "delivery_cost": 2.50,
        "delivery_address": "Street 271, Boeng Tumpun, Phnom Penh",
        "region": "Phnom Penh",
        "payment": {"payment_method": "CARD", "amount": 77.50}
    })
    assert order3.is_success

    # -------------------------------------------------------------
    # 08:00 PM: End-of-Day Ledger Verification
    # -------------------------------------------------------------
    # Stock verification:
    # tshirt_red_s: 50 - 2 (order1) - 5 (order3) = 43
    # tshirt_red_m: 50 - 1 (order2) = 49
    # jeans_30: 30 - 1 (order2) = 29
    db.assert_stock_level(tshirt_red_s["id"], 43)
    db.assert_stock_level(tshirt_red_m["id"], 49)
    db.assert_stock_level(jeans_30["id"], 29)

    # Verify orders list count
    orders_resp = api.get("/orders")
    assert orders_resp.is_success
    assert len(orders_resp.data) >= 3

    # Verify customer loyalty
    db.assert_customer_loyalty("+85512800001", expected_total_purchased=2, expected_total_spent=30.00)
    db.assert_customer_loyalty("+85512800002", expected_total_purchased=2, expected_total_spent=53.00)
    db.assert_customer_loyalty("+85512800003", expected_total_purchased=5, expected_total_spent=77.50)
