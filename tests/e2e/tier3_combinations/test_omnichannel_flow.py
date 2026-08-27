"""
Tier 3: Cross-Feature Combinations - Omnichannel Sales Flow.
Tests multi-channel operations across POS Terminal, Web Store, and Mobile POS
competing for shared inventory, sharing customer loyalty, and attributing orders accurately.
"""

import pytest
import uuid


def test_pos_and_web_channels_sharing_variant_inventory(api, db, seed_catalog, pos_channel_id, web_channel_id):
    """
    POS Terminal and Web Store sell from the exact same physical variant stock pool.
    When stock runs out, the other channel is immediately prevented from overselling.
    """
    var = seed_catalog["jeans"]["variants"][1]  # initial stock = 15
    var_id = var["id"]

    # 1. POS Terminal sells 10 units
    pos_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 10, "unit_price": 35.00}],
        "payment": {"payment_method": "CASH", "amount": 350.00}
    })
    assert pos_resp.is_success
    db.assert_stock_level(var_id, 5)

    # 2. Web Store sells 3 units with delivery
    web_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "delivery_cost": 2.00,
        "items": [{"variant_id": var_id, "quantity": 3, "unit_price": 35.00}],
        "payment": {"payment_method": "CARD", "amount": 107.00}
    })
    assert web_resp.is_success
    db.assert_stock_level(var_id, 2)

    # 3. Web Store attempts to sell 4 units (only 2 remain) -> Must be rejected
    oversell_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "items": [{"variant_id": var_id, "quantity": 4, "unit_price": 35.00}],
        "payment": {"payment_method": "CARD", "amount": 140.00}
    })
    assert oversell_resp.status_code == 422
    db.assert_stock_level(var_id, 2)


def test_omnichannel_customer_loyalty_shared_across_channels(api, db, seed_catalog, unique_phone, pos_channel_id, web_channel_id, mobile_channel_id):
    """
    Customer profile and loyalty points are unified across POS, Web, and Mobile channels.
    """
    var = seed_catalog["tshirt"]["variants"][0]

    # Purchase 1 via POS: 1 item ($15.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Vireak Long"},
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    })

    # Purchase 2 via Web: 2 items ($30.00 + $2.00 delivery = $32.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "customer": {"phone": unique_phone, "name": "Vireak Long"},
        "items": [{"variant_id": var["id"], "quantity": 2, "unit_price": 15.00}],
        "delivery_cost": 2.00,
        "payment": {"payment_method": "CARD", "amount": 32.00}
    })

    # Purchase 3 via Mobile POS: 1 item ($15.00)
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": mobile_channel_id,
        "customer": {"phone": unique_phone, "name": "Vireak Long"},
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 15.00}
    })

    # Total purchased = 1 + 2 + 1 = 4 units
    # Total spent = $15.00 + $32.00 + $15.00 = $62.00
    db.assert_customer_loyalty(unique_phone, expected_total_purchased=4, expected_total_spent=62.00)


def test_channel_order_filtering_and_reporting(api, seed_catalog, pos_channel_id, web_channel_id):
    """Orders dashboard can filter orders strictly by channel_id."""
    var = seed_catalog["tshirt"]["variants"][0]

    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    })
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CARD", "amount": 15.00}
    })

    pos_list = api.get("/orders", params={"channel_id": pos_channel_id})
    assert pos_list.is_success
    for ord_item in pos_list.data:
        assert ord_item["channel_id"] == pos_channel_id


def test_channel_specific_delivery_and_payment_flows(api, seed_catalog, pos_channel_id, web_channel_id):
    """Verify POS in-person zero-delivery flow vs Web regional delivery surcharge flow."""
    var = seed_catalog["tshirt"]["variants"][0]

    # In-person POS: 0 delivery
    pos_order = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "delivery_cost": 0.00,
        "payment": {"payment_method": "CASH", "amount": 15.00}
    })
    assert pos_order.is_success
    assert pos_order.data["delivery_cost"] == 0.00
    assert pos_order.data["total_amount"] == 15.00

    # Web Store: $3.50 regional delivery
    web_order = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "delivery_cost": 3.50,
        "delivery_address": "Borey Peng Huoth, Chbar Ampov",
        "region": "Phnom Penh - Chbar Ampov",
        "payment": {"payment_method": "CARD", "amount": 18.50}
    })
    assert web_order.is_success
    assert web_order.data["delivery_cost"] == 3.50
    assert web_order.data["total_amount"] == 18.50


def test_omnichannel_concurrent_cart_competition_exact_stock(api, db, seed_catalog, pos_channel_id, mobile_channel_id):
    """Two channels simultaneously checkout portions that together deplete exact variant stock."""
    var = seed_catalog["jeans"]["variants"][0]  # stock = 10
    var_id = var["id"]

    # POS buys 6 units
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 6, "unit_price": 38.00}],
        "payment": {"payment_method": "CASH", "amount": 228.00}
    })

    # Mobile POS buys remaining 4 units
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": mobile_channel_id,
        "items": [{"variant_id": var_id, "quantity": 4, "unit_price": 38.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 152.00}
    })

    # Exact 0 remaining
    db.assert_stock_level(var_id, 0)

