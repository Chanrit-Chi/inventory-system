"""
Tier 1: Feature Coverage - Inventory Restock.
Tests restock session lifecycle (DRAFT -> COMPLETED / CANCELLED), stock increments,
and stock_movements ledger recording with movement_type 'RESTOCK'.
"""

import pytest


def test_create_restock_session_draft_does_not_modify_stock(api, db, seed_catalog):
    """Creating restock session in DRAFT status does not immediately change stock."""
    var = seed_catalog["tshirt"]["variants"][0]
    stock_before = db.get_variant(var["id"])["quantity_on_hand"]

    payload = {
        "status": "DRAFT",
        "notes": "Incoming sea freight shipment",
        "items": [
            {
                "variant_id": var["id"],
                "quantity": 50,
                "unit_cost": 6.00
            }
        ]
    }
    resp = api.restock(payload)
    assert resp.is_success
    session = resp.data
    assert session["status"] == "DRAFT"

    # Stock should remain unchanged
    db.assert_stock_level(var["id"], stock_before)


def test_complete_draft_restock_session_increments_inventory(api, db, seed_catalog):
    """Completing a draft restock session applies inventory increments."""
    var = seed_catalog["tshirt"]["variants"][0]
    stock_before = db.get_variant(var["id"])["quantity_on_hand"]

    draft_resp = api.restock({
        "status": "DRAFT",
        "items": [{"variant_id": var["id"], "quantity": 30, "unit_cost": 6.20}]
    })
    session_id = draft_resp.data["id"]

    # Transition to completed
    complete_resp = api.put(f"/inventory/restock-sessions/{session_id}/complete")
    assert complete_resp.is_success
    assert complete_resp.data["status"] == "COMPLETED"

    # Stock should be incremented by 30
    db.assert_stock_level(var["id"], stock_before + 30)

    # Stock movement ledger verified
    db.assert_movement_recorded(var["id"], "RESTOCK", 30, reference_id=session_id)


def test_direct_completed_restock_session(api, db, seed_catalog):
    """Directly creating a COMPLETED restock session increments inventory immediately."""
    var = seed_catalog["tshirt"]["variants"][1]
    stock_before = db.get_variant(var["id"])["quantity_on_hand"]

    payload = {
        "status": "COMPLETED",
        "notes": "Direct supplier drop-off",
        "items": [
            {
                "variant_id": var["id"],
                "quantity": 25,
                "unit_cost": 6.50,
                "scanned_barcode": var.get("barcode")
            }
        ]
    }
    resp = api.restock(payload)
    assert resp.is_success
    assert resp.data["status"] == "COMPLETED"

    db.assert_stock_level(var["id"], stock_before + 25)
    db.assert_movement_recorded(var["id"], "RESTOCK", 25, reference_id=resp.data["id"])


def test_multi_item_batch_restock(api, db, seed_catalog):
    """Restocking multiple distinct variants in a single session."""
    var1 = seed_catalog["tshirt"]["variants"][0]
    var2 = seed_catalog["tshirt"]["variants"][1]
    stock1_before = db.get_variant(var1["id"])["quantity_on_hand"]
    stock2_before = db.get_variant(var2["id"])["quantity_on_hand"]

    payload = {
        "status": "COMPLETED",
        "items": [
            {"variant_id": var1["id"], "quantity": 10, "unit_cost": 6.50},
            {"variant_id": var2["id"], "quantity": 15, "unit_cost": 6.50},
        ]
    }
    resp = api.restock(payload)
    assert resp.is_success
    assert len(resp.data["details"]) == 2

    db.assert_stock_level(var1["id"], stock1_before + 10)
    db.assert_stock_level(var2["id"], stock2_before + 15)


def test_cancel_draft_restock_session(api, db, seed_catalog):
    """Cancelling a draft restock session sets status CANCELLED with no stock changes."""
    var = seed_catalog["tshirt"]["variants"][0]
    stock_before = db.get_variant(var["id"])["quantity_on_hand"]

    draft_resp = api.restock({
        "status": "DRAFT",
        "items": [{"variant_id": var["id"], "quantity": 100, "unit_cost": 5.00}]
    })
    session_id = draft_resp.data["id"]

    cancel_resp = api.put(f"/inventory/restock-sessions/{session_id}/cancel")
    assert cancel_resp.is_success
    assert cancel_resp.data["status"] == "CANCELLED"

    # Stock unaffected
    db.assert_stock_level(var["id"], stock_before)
