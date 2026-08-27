"""
Tier 4: Realistic Omnichannel Application Workloads - Long-Term Customer Loyalty Lifecycle.
Simulates long-term multi-tier customer loyalty progression across different sales channels:
1. Stage 1 (Bronze): Initial POS purchase of $30.00 (2 units)
2. Stage 2 (Silver): Web Store delivery order of $120.00 (4 units) -> Cumulative $150.00 (6 units)
3. Stage 3 (Gold): Mobile POS bulk order of $250.00 (10 units) -> Cumulative $400.00 (16 units)
4. Verify total_purchased, total_spent, last_purchase_at, and customer record integrity
"""

import pytest
import uuid


def test_workload_long_term_customer_loyalty_progression(api, db, seed_catalog, pos_channel_id, web_channel_id, mobile_channel_id):
    """Execute customer loyalty progression across Bronze, Silver, and Gold cumulative tiers."""
    tshirt = seed_catalog["tshirt"]["variants"][0]  # $15.00
    jeans = seed_catalog["jeans"]["variants"][0]    # $38.00 override
    cust_phone = "+85512999888"
    cust_name = "Somaly Heng"

    # -------------------------------------------------------------
    # Stage 1 (Bronze Tier): In-Store Walk-in Purchase
    # 2x T-Shirts = $30.00
    # -------------------------------------------------------------
    order1 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": cust_phone, "name": cust_name, "address": "St 51, BKK1, Phnom Penh"},
        "items": [{"variant_id": tshirt["id"], "quantity": 2, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 30.00}
    })
    assert order1.is_success
    db.assert_customer_loyalty(cust_phone, expected_total_purchased=2, expected_total_spent=30.00)

    # -------------------------------------------------------------
    # Stage 2 (Silver Tier): Web Store Ecommerce Order
    # 2x T-Shirts ($30.00) + 2x Jeans ($76.00) + Delivery ($2.00) - Discount ($5.00) = $103.00
    # Total units = 4 units
    # Cumulative spent = $30.00 + $103.00 = $133.00
    # Cumulative units = 2 + 4 = 6 units
    # -------------------------------------------------------------
    order2 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "customer": {"phone": cust_phone, "name": cust_name},
        "items": [
            {"variant_id": tshirt["id"], "quantity": 2, "unit_price": 15.00},
            {"variant_id": jeans["id"], "quantity": 2, "unit_price": 38.00},
        ],
        "discount": 5.00,
        "delivery_cost": 2.00,
        "delivery_address": "St 51, BKK1, Phnom Penh",
        "payment": {"payment_method": "CARD", "amount": 103.00}
    })
    assert order2.is_success
    db.assert_customer_loyalty(cust_phone, expected_total_purchased=6, expected_total_spent=133.00)

    # -------------------------------------------------------------
    # Stage 3 (Gold Tier): Mobile POS Bulk Purchase
    # 10x T-Shirts ($150.00)
    # Cumulative spent = $133.00 + $150.00 = $283.00
    # Cumulative units = 6 + 10 = 16 units
    # -------------------------------------------------------------
    order3 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": mobile_channel_id,
        "customer": {"phone": cust_phone, "name": cust_name},
        "items": [{"variant_id": tshirt["id"], "quantity": 10, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 150.00, "transaction_ref": "ABA-LOYAL-99"}
    })
    assert order3.is_success
    db.assert_customer_loyalty(cust_phone, expected_total_purchased=16, expected_total_spent=283.00)

    # Verify Customer List API reflects Gold status metrics
    list_resp = api.get("/customers")
    assert list_resp.is_success
    customer_record = next(c for c in list_resp.data if c["phone"] == cust_phone)
    assert customer_record["total_purchased"] == 16
    assert customer_record["total_spent"] == 283.00
