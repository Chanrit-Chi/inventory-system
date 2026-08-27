"""
Tier 2: Boundary & Corner Cases - State Machine & Lifecycle Boundaries.
Tests restock session state transitions (cannot re-complete COMPLETED, cannot complete CANCELLED),
and soft-delete exclusion across catalog, scanner, and checkout.
"""

import pytest
import uuid


def test_cannot_complete_already_completed_session(api, seed_catalog):
    """Attempting to complete a session that is already COMPLETED is rejected."""
    var = seed_catalog["tshirt"]["variants"][0]
    resp = api.restock({
        "status": "COMPLETED",
        "items": [{"variant_id": var["id"], "quantity": 10, "unit_cost": 5.00}]
    })
    session_id = resp.data["id"]

    # Second completion attempt
    retry_resp = api.put(f"/inventory/restock-sessions/{session_id}/complete")
    assert retry_resp.status_code == 422
    assert retry_resp.success is False
    assert "already completed" in retry_resp.message.lower()


def test_cannot_complete_cancelled_session(api, seed_catalog):
    """Attempting to complete a CANCELLED restock session is rejected."""
    var = seed_catalog["tshirt"]["variants"][0]
    draft_resp = api.restock({
        "status": "DRAFT",
        "items": [{"variant_id": var["id"], "quantity": 10, "unit_cost": 5.00}]
    })
    session_id = draft_resp.data["id"]

    # Cancel session
    api.put(f"/inventory/restock-sessions/{session_id}/cancel")

    # Try to complete
    comp_resp = api.put(f"/inventory/restock-sessions/{session_id}/complete")
    assert comp_resp.status_code == 422
    assert comp_resp.success is False
    assert "cancelled" in comp_resp.message.lower()


def test_cannot_cancel_completed_session(api, seed_catalog):
    """Attempting to cancel an already completed session is rejected."""
    var = seed_catalog["tshirt"]["variants"][0]
    resp = api.restock({
        "status": "COMPLETED",
        "items": [{"variant_id": var["id"], "quantity": 5, "unit_cost": 5.00}]
    })
    session_id = resp.data["id"]

    cancel_resp = api.put(f"/inventory/restock-sessions/{session_id}/cancel")
    assert cancel_resp.status_code == 422
    assert cancel_resp.success is False


def test_soft_deleted_product_excluded_from_catalog(api):
    """Soft-deleting a product excludes it and its variants from GET /products."""
    create_resp = api.create_product({
        "name": "Discontinued Jacket",
        "purchase_price": 20.00,
        "selling_price": 45.00,
        "barcode": "8935555555555"
    })
    prod_id = create_resp.data["id"]

    # Soft-delete product
    del_resp = api.delete(f"/products/{prod_id}")
    assert del_resp.is_success

    # Check listing
    list_resp = api.get("/products")
    prods = list_resp.data
    assert not any(p["id"] == prod_id for p in prods)

    # Check direct GET by ID returns 404
    get_resp = api.get(f"/products/{prod_id}")
    assert get_resp.status_code == 404


def test_soft_deleted_variant_excluded_from_scanner_and_checkout(api, pos_channel_id):
    """Soft-deleted variant cannot be scanned or purchased."""
    create_resp = api.create_product({
        "name": "Limited Edition Sneaker",
        "purchase_price": 50.00,
        "selling_price": 120.00,
        "variants": [{"sku": "SNEAKER-GOLD-42", "barcode": "8937777777777", "quantity_on_hand": 5}]
    })
    var_id = create_resp.data["variants"][0]["id"]
    barcode = "8937777777777"

    # Soft delete the variant
    del_resp = api.delete(f"/variants/{var_id}")
    assert del_resp.is_success

    # Scanner lookup must return 404
    scan_resp = api.scan_barcode(barcode)
    assert scan_resp.status_code == 404

    # Checkout must fail with 422
    checkout_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 1, "unit_price": 120.00}],
        "payment": {"payment_method": "CASH", "amount": 120.00}
    })
    assert checkout_resp.status_code == 422
