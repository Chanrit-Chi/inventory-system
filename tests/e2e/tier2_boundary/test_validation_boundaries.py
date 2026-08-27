"""
Tier 2: Boundary & Corner Cases - Validation Boundaries.
Tests uniqueness constraints (duplicate SKU/barcode), malformed UUIDs,
invalid phone formats, empty payload arrays, and string length boundaries.
"""

import pytest
import uuid


def test_duplicate_product_barcode_rejected(api):
    """Creating a product with an already existing product barcode must fail with 422."""
    barcode = "8939988776655"
    api.create_product({
        "name": "Original Product",
        "barcode": barcode,
        "purchase_price": 5.00,
        "selling_price": 10.00
    })

    # Duplicate attempt
    resp = api.create_product({
        "name": "Clash Product",
        "barcode": barcode,
        "purchase_price": 7.00,
        "selling_price": 14.00
    })
    assert resp.status_code == 422
    assert resp.success is False
    assert "barcode" in resp.errors


def test_duplicate_variant_sku_rejected(api):
    """Creating products with custom variants containing duplicate SKUs must fail."""
    sku = "CUSTOM-UNIQUE-SKU-99"
    api.create_product({
        "name": "Product Alpha",
        "purchase_price": 5.00,
        "selling_price": 10.00,
        "variants": [{"sku": sku, "quantity_on_hand": 1}]
    })

    resp = api.create_product({
        "name": "Product Beta",
        "purchase_price": 5.00,
        "selling_price": 10.00,
        "variants": [{"sku": sku, "quantity_on_hand": 1}]
    })
    assert resp.status_code == 422
    assert resp.success is False


def test_malformed_uuid_in_checkout_rejected(api, pos_channel_id):
    """Providing a malformed string instead of a UUID for client_mutation_id or variant_id fails."""
    resp = api.checkout({
        "client_mutation_id": "not-a-valid-uuid-12345",
        "channel_id": pos_channel_id,
        "items": [{"variant_id": "also-not-a-uuid", "quantity": 1, "unit_price": 10.00}],
        "payment": {"payment_method": "CASH", "amount": 10.00}
    })
    assert resp.status_code == 422
    assert resp.success is False
    assert "client_mutation_id" in resp.errors


def test_invalid_phone_number_format_rejected(api, seed_catalog, unique_mutation_id, pos_channel_id):
    """Providing invalid phone string (e.g. random letters or invalid format) fails."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "customer": {"phone": "abc-invalid-phone", "name": "Invalid Customer"},
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 15.00}
    }
    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False
    assert "customer.phone" in resp.errors


def test_empty_items_array_in_checkout_rejected(api, unique_mutation_id, pos_channel_id):
    """Empty items array [] in checkout request fails with 422."""
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [],
        "payment": {"payment_method": "CASH", "amount": 0.00}
    }
    resp = api.checkout(payload)
    assert resp.status_code == 422
    assert resp.success is False
    assert "items" in resp.errors


def test_excessively_long_product_name_rejected(api):
    """Product name exceeding 255 characters is rejected with 422."""
    long_name = "A" * 300
    resp = api.create_product({
        "name": long_name,
        "purchase_price": 5.00,
        "selling_price": 10.00
    })
    assert resp.status_code == 422
    assert resp.success is False
    assert "name" in resp.errors
