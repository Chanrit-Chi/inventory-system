"""
Tier 1: Feature Coverage - Order Checkout.
Tests atomic checkout, line item calculation, discount, delivery_cost, total_amount,
payment recording, stock decrement, and stock_movements ledger recording.
"""

import pytest


def test_single_item_checkout_success(api, db, seed_catalog, unique_mutation_id, pos_channel_id):
    """Verify single-item atomic checkout decrements stock and returns order summary."""
    tshirt = seed_catalog["tshirt"]
    var = tshirt["variants"][0]
    var_id = var["id"]
    initial_stock = db.get_variant(var_id)["quantity_on_hand"]

    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [
            {
                "variant_id": var_id,
                "quantity": 2,
                "unit_price": 15.00
            }
        ],
        "discount": 0.00,
        "delivery_cost": 0.00,
        "payment": {
            "payment_method": "CASH",
            "amount": 30.00
        }
    }

    resp = api.checkout(payload)
    assert resp.is_success
    assert resp.status_code == 201
    order = resp.data
    assert order["client_mutation_id"] == unique_mutation_id
    assert order["subtotal"] == 30.00
    assert order["total_amount"] == 30.00
    assert order["status"] == "COMPLETED"
    assert len(order["items"]) == 1
    assert len(order["payments"]) == 1
    assert order["payments"][0]["payment_method"] == "CASH"

    # Verify inventory was decremented
    db.assert_stock_level(var_id, initial_stock - 2)

    # Verify stock movement ledger
    db.assert_movement_recorded(var_id, "SALE", -2, reference_id=order["order_number"])


def test_multi_item_checkout_with_discount_and_delivery(api, db, seed_catalog, unique_mutation_id, web_channel_id):
    """Verify multi-item checkout with discount and delivery cost."""
    tshirt = seed_catalog["tshirt"]
    jeans = seed_catalog["jeans"]
    var1 = tshirt["variants"][0]  # $15.00
    var2 = jeans["variants"][0]   # $38.00 override

    stock1_before = db.get_variant(var1["id"])["quantity_on_hand"]
    stock2_before = db.get_variant(var2["id"])["quantity_on_hand"]

    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": web_channel_id,
        "items": [
            {"variant_id": var1["id"], "quantity": 3, "unit_price": 15.00},  # 45.00
            {"variant_id": var2["id"], "quantity": 1, "unit_price": 38.00},  # 38.00
        ],
        "discount": 5.00,
        "delivery_cost": 2.50,
        "delivery_address": "Building 4, St 123, Phnom Penh",
        "region": "Phnom Penh",
        "payment": {
            "payment_method": "CARD",
            "amount": 80.50,
            "transaction_ref": "VISA-889900"
        }
    }

    # subtotal = 45.00 + 38.00 = 83.00
    # total = 83.00 - 5.00 + 2.50 = 80.50
    resp = api.checkout(payload)
    assert resp.is_success
    order = resp.data
    assert order["subtotal"] == 83.00
    assert order["discount"] == 5.00
    assert order["delivery_cost"] == 2.50
    assert order["total_amount"] == 80.50
    assert order["delivery_address"] == "Building 4, St 123, Phnom Penh"

    # Check stocks
    db.assert_stock_level(var1["id"], stock1_before - 3)
    db.assert_stock_level(var2["id"], stock2_before - 1)


def test_order_number_generation_format(api, seed_catalog, unique_mutation_id, pos_channel_id):
    """Verify order_number follows ORD-YYYYMMDD-XXXX convention."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    }
    resp = api.checkout(payload)
    assert resp.is_success
    order_num = resp.data["order_number"]
    assert order_num.startswith("ORD-")
    parts = order_num.split("-")
    assert len(parts) == 3
    assert len(parts[1]) == 8  # YYYYMMDD
    assert len(parts[2]) == 4  # Sequence


def test_get_order_by_id_and_order_number(api, seed_catalog, unique_mutation_id, pos_channel_id):
    """Verify order can be retrieved by its UUID and by its order_number."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    }
    create_resp = api.checkout(payload)
    order_id = create_resp.data["id"]
    order_num = create_resp.data["order_number"]

    # Fetch by ID
    get_id_resp = api.get(f"/orders/{order_id}")
    assert get_id_resp.is_success
    assert get_id_resp.data["id"] == order_id

    # Fetch by order_number
    get_num_resp = api.get(f"/orders/{order_num}")
    assert get_num_resp.is_success
    assert get_num_resp.data["id"] == order_id


def test_list_orders_filtering(api, seed_catalog, pos_channel_id, web_channel_id):
    """Verify GET /api/v1/orders returns list and supports channel filtering."""
    var = seed_catalog["tshirt"]["variants"][0]
    import uuid

    # POS order
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    })
    # Web order
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CARD", "amount": 15.00}
    })

    # List all
    all_resp = api.get("/orders")
    assert all_resp.is_success
    assert len(all_resp.data) >= 2

    # Filter by POS channel
    pos_resp = api.get("/orders", params={"channel_id": pos_channel_id})
    assert pos_resp.is_success
    for ord_item in pos_resp.data:
        assert ord_item["channel_id"] == pos_channel_id
