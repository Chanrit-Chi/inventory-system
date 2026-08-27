"""
Tier 1: Feature Coverage - Customer Loyalty.
Tests customer auto-upsert by phone, total_purchased quantity accumulation,
total_spent monetary accumulation, and last_purchase_at timestamp updates.
"""

import pytest
import uuid


def test_customer_auto_upsert_on_first_checkout(api, db, seed_catalog, unique_phone, pos_channel_id):
    """First checkout with new phone creates customer record and sets initial loyalty metrics."""
    var = seed_catalog["tshirt"]["variants"][0]
    mutation_id = str(uuid.uuid4())

    payload = {
        "client_mutation_id": mutation_id,
        "channel_id": pos_channel_id,
        "customer": {
            "phone": unique_phone,
            "name": "Bopha Rath",
            "address": "Street 2004, Sen Sok, Phnom Penh"
        },
        "items": [
            {"variant_id": var["id"], "quantity": 2, "unit_price": 15.00}
        ],
        "payment": {"payment_method": "ABA_QR", "amount": 30.00}
    }

    resp = api.checkout(payload)
    assert resp.is_success
    order = resp.data
    cust_data = order["customer"]
    assert cust_data is not None
    assert cust_data["phone"] == unique_phone
    assert cust_data["name"] == "Bopha Rath"
    assert cust_data["total_purchased"] == 2
    assert cust_data["total_spent"] == 30.00
    assert cust_data["last_purchase_at"] is not None

    # Verify db state
    db.assert_customer_loyalty(unique_phone, expected_total_purchased=2, expected_total_spent=30.00)


def test_customer_loyalty_accumulation_multiple_orders(api, db, seed_catalog, unique_phone, pos_channel_id):
    """Subsequent orders with same phone accumulate total_purchased and total_spent."""
    var = seed_catalog["tshirt"]["variants"][0]

    # Order 1: 2 items = $30.00
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Vannak Touch"},
        "items": [{"variant_id": var["id"], "quantity": 2, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 30.00}
    })

    # Order 2: 3 items = $45.00
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Vannak Touch"},
        "items": [{"variant_id": var["id"], "quantity": 3, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 45.00}
    })

    # Total purchased = 2 + 3 = 5, Total spent = 30 + 45 = 75.00
    db.assert_customer_loyalty(unique_phone, expected_total_purchased=5, expected_total_spent=75.00)


def test_customer_profile_name_and_address_update(api, seed_catalog, unique_phone, pos_channel_id, web_channel_id):
    """Subsequent order can update customer's address or name."""
    var = seed_catalog["tshirt"]["variants"][0]

    # Order 1
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Initial Name", "address": "Old Address"},
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    })

    # Order 2 with updated profile
    resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": web_channel_id,
        "customer": {"phone": unique_phone, "name": "Updated Name", "address": "New Villa 44, BKK1"},
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CARD", "amount": 15.00}
    })

    cust = resp.data["customer"]
    assert cust["name"] == "Updated Name"
    assert cust["address"] == "New Villa 44, BKK1"
    assert cust["total_purchased"] == 2


def test_checkout_without_customer_anonymous(api, seed_catalog, pos_channel_id):
    """Anonymous checkout without customer object succeeds with null customer_id."""
    var = seed_catalog["tshirt"]["variants"][0]
    resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": None,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    })
    assert resp.is_success
    assert resp.data["customer"] is None
    assert resp.data["customer_id"] is None


def test_customer_list_and_loyalty_metrics(api, seed_catalog, unique_phone, pos_channel_id):
    """GET /api/v1/customers lists customers with accurate aggregated totals."""
    var = seed_catalog["tshirt"]["variants"][0]
    api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": unique_phone, "name": "Dara Lim"},
        "items": [{"variant_id": var["id"], "quantity": 4, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 60.00}
    })

    list_resp = api.get("/customers")
    assert list_resp.is_success
    customers = list_resp.data
    matched = next((c for c in customers if c["phone"] == unique_phone), None)
    assert matched is not None
    assert matched["name"] == "Dara Lim"
    assert matched["total_purchased"] == 4
    assert matched["total_spent"] == 60.00
