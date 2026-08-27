"""
Tier 3: Cross-Feature Combinations - Idempotency and Concurrency Safety.
Tests client_mutation_id deduplication, ensuring repeated requests return the original
order idempotently without double-deducting stock or duplicating payment/ledger entries.
"""

import pytest
import uuid


def test_idempotent_order_checkout_replay(api, db, seed_catalog, pos_channel_id):
    """
    Submitting an order twice with the same client_mutation_id must return the existing
    order idempotently without deducting stock a second time.
    """
    var = seed_catalog["tshirt"]["variants"][0]
    var_id = var["id"]
    stock_initial = db.get_variant(var_id)["quantity_on_hand"]

    mutation_id = str(uuid.uuid4())
    payload = {
        "client_mutation_id": mutation_id,
        "channel_id": pos_channel_id,
        "customer": {"phone": "+85512112233", "name": "Dara Roth"},
        "items": [{"variant_id": var_id, "quantity": 2, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 30.00}
    }

    # First Submission
    resp1 = api.checkout(payload)
    assert resp1.is_success
    assert resp1.status_code in (200, 201)
    order1 = resp1.data
    order_id1 = order1["id"]
    order_num1 = order1["order_number"]

    # Stock decremented by 2
    db.assert_stock_level(var_id, stock_initial - 2)

    # Second Submission (Replay with same mutation ID)
    resp2 = api.checkout(payload)
    assert resp2.is_success
    assert resp2.status_code in (200, 201)
    order2 = resp2.data

    # Must return exact same order
    assert order2["id"] == order_id1
    assert order2["order_number"] == order_num1
    assert order2["client_mutation_id"] == mutation_id

    # Invariant: Stock must NOT have decremented again
    db.assert_stock_level(var_id, stock_initial - 2)

    # Invariant: Only 1 SALE stock movement should exist for this order
    movements = db.get_stock_movements(variant_id=var_id, reference_id=order_num1)
    assert len(movements) == 1
    assert movements[0]["quantity_change"] == -2


def test_multiple_replays_no_stock_drift(api, db, seed_catalog, pos_channel_id):
    """Sending the exact same mutation payload 5 times causes zero stock drift."""
    var = seed_catalog["tshirt"]["variants"][1]
    var_id = var["id"]
    stock_initial = db.get_variant(var_id)["quantity_on_hand"]
    mutation_id = str(uuid.uuid4())

    payload = {
        "client_mutation_id": mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    }

    for _ in range(5):
        resp = api.checkout(payload)
        assert resp.is_success

    # Stock decremented exactly once
    db.assert_stock_level(var_id, stock_initial - 1)


def test_unique_mutations_create_independent_orders(api, db, seed_catalog, pos_channel_id):
    """Submitting 3 unique mutation IDs creates 3 distinct orders and decrements stock 3 times."""
    var = seed_catalog["tshirt"]["variants"][2]
    var_id = var["id"]
    stock_initial = db.get_variant(var_id)["quantity_on_hand"]

    order_ids = set()
    for _ in range(3):
        resp = api.checkout({
            "client_mutation_id": str(uuid.uuid4()),
            "channel_id": pos_channel_id,
            "items": [{"variant_id": var_id, "quantity": 2, "unit_price": 15.00}],
            "payment": {"payment_method": "CASH", "amount": 30.00}
        })
        assert resp.is_success
        order_ids.add(resp.data["id"])

    assert len(order_ids) == 3
    db.assert_stock_level(var_id, stock_initial - 6)


def test_idempotent_customer_loyalty_no_double_counting(api, db, seed_catalog, unique_phone, pos_channel_id):
    """Replaying an order does not double-count customer total_purchased or total_spent."""
    var = seed_catalog["tshirt"]["variants"][0]
    mutation_id = str(uuid.uuid4())

    payload = {
        "client_mutation_id": mutation_id,
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Kosal Chea"},
        "items": [{"variant_id": var["id"], "quantity": 3, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 45.00}
    }

    # Send 3 times
    api.checkout(payload)
    api.checkout(payload)
    api.checkout(payload)

    # Customer loyalty must reflect only 1 purchase (3 units, $45.00)
    db.assert_customer_loyalty(unique_phone, expected_total_purchased=3, expected_total_spent=45.00)
