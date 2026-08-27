"""
Tier 2: Boundary & Corner Cases - Inventory Boundaries.
Tests overselling prevention, exact zero drain, negative/zero quantity rejections,
and atomic multi-item rollback when any item has insufficient inventory.
"""

import pytest
import uuid


def test_overselling_exact_qoh_plus_one_rejected(api, db, seed_catalog, unique_mutation_id, pos_channel_id):
    """Attempting to checkout 1 unit more than quantity_on_hand must fail with 422."""
    var = seed_catalog["jeans"]["variants"][0]  # initial stock = 10
    var_id = var["id"]
    current_stock = db.get_variant(var_id)["quantity_on_hand"]

    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [
            {
                "variant_id": var_id,
                "quantity": current_stock + 1,  # 11
                "unit_price": 38.00
            }
        ],
        "payment": {"payment_method": "CASH", "amount": 418.00}
    }

    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False
    assert "items.0.quantity" in resp.errors or "insufficient" in resp.message.lower()

    # Verify inventory was NOT decremented
    db.assert_stock_level(var_id, current_stock)


def test_exact_zero_quantity_checkout_rejected(api, db, seed_catalog, unique_mutation_id, pos_channel_id):
    """Checkout item with quantity=0 is rejected."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 0, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 0.00}
    }
    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False


def test_negative_quantity_checkout_rejected(api, db, seed_catalog, unique_mutation_id, pos_channel_id):
    """Checkout item with negative quantity (e.g. -5) is rejected."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": -5, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": -75.00}
    }
    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False


def test_exact_quantity_drain_to_zero_allowed(api, db, seed_catalog, unique_mutation_id, pos_channel_id):
    """Purchasing exact remaining stock quantity drains inventory to 0 without error."""
    var = seed_catalog["jeans"]["variants"][0]  # stock = 10
    var_id = var["id"]
    current_stock = db.get_variant(var_id)["quantity_on_hand"]

    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": current_stock, "unit_price": 38.00}],
        "payment": {"payment_method": "CASH", "amount": current_stock * 38.00}
    }

    resp = api.checkout(payload)
    assert resp.is_success
    assert resp.status_code == 201

    # Stock must be exactly 0
    db.assert_stock_level(var_id, 0)


def test_zero_stock_subsequent_checkout_rejected(api, db, seed_catalog, pos_channel_id):
    """Once stock reaches 0, any subsequent order for that variant is rejected."""
    var = seed_catalog["jeans"]["variants"][0]
    var_id = var["id"]

    # First drain to 0
    qoh = db.get_variant(var_id)["quantity_on_hand"]
    if qoh > 0:
        api.checkout({
            "client_mutation_id": str(uuid.uuid4()),
            "channel_id": pos_channel_id,
            "items": [{"variant_id": var_id, "quantity": qoh, "unit_price": 38.00}],
            "payment": {"payment_method": "CASH", "amount": qoh * 38.00}
        })
    db.assert_stock_level(var_id, 0)

    # Subsequent attempt to buy 1 unit
    resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 1, "unit_price": 38.00}],
        "payment": {"payment_method": "CASH", "amount": 38.00}
    })
    assert resp.status_code == 422
    assert resp.success is False
    db.assert_stock_level(var_id, 0)


def test_multi_item_order_atomic_rollback_if_one_insufficient(api, db, seed_catalog, pos_channel_id):
    """
    If order has 2 items where item 1 has plenty of stock (20) and item 2 has insufficient stock (e.g. 50 requested vs 15 available),
    the ENTIRE order must be rejected and item 1 stock must remain untouched.
    """
    var1 = seed_catalog["tshirt"]["variants"][0]  # stock = 20
    var2 = seed_catalog["jeans"]["variants"][1]   # stock = 15

    stock1_before = db.get_variant(var1["id"])["quantity_on_hand"]
    stock2_before = db.get_variant(var2["id"])["quantity_on_hand"]

    payload = {
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [
            {"variant_id": var1["id"], "quantity": 5, "unit_price": 15.00},   # valid
            {"variant_id": var2["id"], "quantity": 50, "unit_price": 35.00},  # invalid (50 > 15)
        ],
        "payment": {"payment_method": "CASH", "amount": 1825.00}
    }

    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False

    # Invariant: Neither item was decremented
    db.assert_stock_level(var1["id"], stock1_before)
    db.assert_stock_level(var2["id"], stock2_before)
