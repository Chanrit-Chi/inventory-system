"""
Tier 2: Boundary & Corner Cases - Financial Boundaries.
Tests decimal rounding precision (2 decimals), zero/negative financial inputs,
discounts exceeding subtotal, and large financial order values.
"""

import pytest
import uuid


def test_two_decimal_rounding_precision(api, seed_catalog, pos_channel_id):
    """Verify precision calculations: $19.99 * 3 = $59.97, discount $5.50 -> $54.47."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [
            {"variant_id": var["id"], "quantity": 3, "unit_price": 19.99}
        ],
        "discount": 5.50,
        "delivery_cost": 2.25,
        "payment": {"payment_method": "ABA_QR", "amount": 56.72}
    }
    # 59.97 - 5.50 = 54.47 + 2.25 = 56.72
    resp = api.checkout(payload)
    assert resp.is_success
    data = resp.data
    assert data["subtotal"] == 59.97
    assert data["discount"] == 5.50
    assert data["delivery_cost"] == 2.25
    assert data["total_amount"] == 56.72


def test_discount_exceeding_subtotal_handling(api, seed_catalog, pos_channel_id):
    """Discount greater than subtotal clamps net goods to 0.00 + delivery fee."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "discount": 50.00,  # exceeds $15.00
        "delivery_cost": 3.00,
        "payment": {"payment_method": "CASH", "amount": 3.00}
    }
    resp = api.checkout(payload)
    assert resp.is_success
    # Total = max(0, 15 - 50) + 3.00 = 3.00
    assert resp.data["total_amount"] == 3.00


def test_negative_discount_rejected(api, seed_catalog, pos_channel_id):
    """Negative discount value is rejected with 422."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "discount": -10.00,
        "payment": {"payment_method": "CASH", "amount": 25.00}
    }
    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False
    assert "discount" in resp.errors


def test_negative_delivery_cost_rejected(api, seed_catalog, pos_channel_id):
    """Negative delivery_cost is rejected with 422."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "delivery_cost": -5.00,
        "payment": {"payment_method": "CASH", "amount": 10.00}
    }
    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False
    assert "delivery_cost" in resp.errors


def test_zero_dollar_boundary_checkout(api, seed_catalog, pos_channel_id):
    """100% promo coupon resulting in $0.00 total amount succeeds."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "discount": 15.00,
        "delivery_cost": 0.00,
        "payment": {"payment_method": "PROMO", "amount": 0.00}
    }
    resp = api.checkout(payload)
    assert resp.is_success
    assert resp.data["total_amount"] == 0.00
