"""
Tier 1: Feature Coverage - Payments & Sales Channels.
Tests payment methods (Cash, ABA QR, Card), transaction references, proof images,
and sales channel attribution (POS, Web, Mobile).
"""

import pytest


def test_payment_method_cash(api, seed_catalog, unique_mutation_id, pos_channel_id):
    """Verify CASH payment method recording."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {
            "payment_method": "CASH",
            "amount": 15.00
        }
    }
    resp = api.checkout(payload)
    assert resp.is_success
    pmts = resp.data["payments"]
    assert len(pmts) == 1
    assert pmts[0]["payment_method"] == "CASH"
    assert pmts[0]["amount"] == 15.00


def test_payment_method_aba_qr_with_transaction_ref(api, seed_catalog, unique_mutation_id, pos_channel_id):
    """Verify ABA_QR payment method with transaction_ref is stored properly."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 2, "unit_price": 15.00}],
        "payment": {
            "payment_method": "ABA_QR",
            "amount": 30.00,
            "transaction_ref": "ABA-REF-99881122"
        }
    }
    resp = api.checkout(payload)
    assert resp.is_success
    pmts = resp.data["payments"]
    assert pmts[0]["payment_method"] == "ABA_QR"
    assert pmts[0]["transaction_ref"] == "ABA-REF-99881122"


def test_payment_method_card_with_proof_image(api, seed_catalog, unique_mutation_id, web_channel_id):
    """Verify CARD payment method with proof_image_url is saved."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": web_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {
            "payment_method": "CARD",
            "amount": 15.00,
            "transaction_ref": "TX-CARD-443322",
            "proof_image_url": "https://storage.cdn.com/proofs/tx-443322.png"
        }
    }
    resp = api.checkout(payload)
    assert resp.is_success
    pmts = resp.data["payments"]
    assert pmts[0]["payment_method"] == "CARD"
    assert pmts[0]["proof_image_url"] == "https://storage.cdn.com/proofs/tx-443322.png"


def test_sales_channel_attribution(api, seed_catalog, unique_mutation_id, mobile_channel_id):
    """Verify orders are linked to correct sales channel (e.g. Mobile POS)."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": mobile_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 15.00}
    }
    resp = api.checkout(payload)
    assert resp.is_success
    assert resp.data["channel_id"] == mobile_channel_id


def test_omnichannel_delivery_region_and_address(api, seed_catalog, unique_mutation_id, web_channel_id):
    """Verify regional delivery details and note are stored with the order."""
    var = seed_catalog["tshirt"]["variants"][0]
    payload = {
        "client_mutation_id": unique_mutation_id,
        "channel_id": web_channel_id,
        "items": [{"variant_id": var["id"], "quantity": 1, "unit_price": 15.00}],
        "delivery_cost": 3.00,
        "delivery_address": "House 12, Street 315, Toul Kork",
        "region": "Phnom Penh - Toul Kork",
        "note": "Leave package with front desk guard",
        "payment": {"payment_method": "ABA_QR", "amount": 18.00}
    }
    resp = api.checkout(payload)
    assert resp.is_success
    data = resp.data
    assert data["delivery_cost"] == 3.00
    assert data["delivery_address"] == "House 12, Street 315, Toul Kork"
    assert data["region"] == "Phnom Penh - Toul Kork"
    assert data["note"] == "Leave package with front desk guard"
