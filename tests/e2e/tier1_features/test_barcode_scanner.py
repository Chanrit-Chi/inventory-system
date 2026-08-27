"""
Tier 1: Feature Coverage - Barcode Scanner Resolution.
Tests two-tier scanner resolution:
1. Direct variant resolution (by barcode and SKU)
2. Master product expansion with child variants
3. 404 error envelope when barcode is unknown
"""

import pytest


def test_scan_direct_variant_by_barcode(api, seed_catalog):
    """Scanning variant-level barcode directly resolves type: VARIANT."""
    tshirt = seed_catalog["tshirt"]
    var = tshirt["variants"][0]
    barcode = var["barcode"]

    resp = api.scan_barcode(barcode)
    assert resp.is_success
    assert resp.status_code == 200
    data = resp.data
    assert data["type"] == "VARIANT"
    assert data["variant"]["id"] == var["id"]
    assert data["variant"]["sku"] == var["sku"]
    assert data["variant"]["selling_price"] == 15.00
    assert data["variant"]["quantity_on_hand"] >= 20


def test_scan_direct_variant_by_sku(api, seed_catalog):
    """Scanning or searching variant SKU resolves direct variant match."""
    jeans = seed_catalog["jeans"]
    var = jeans["variants"][0]  # DENIM-JEANS-30-BLUE
    sku = var["sku"]

    resp = api.scan_barcode(sku)
    assert resp.is_success
    data = resp.data
    assert data["type"] == "VARIANT"
    assert data["variant"]["sku"] == sku
    assert data["variant"]["selling_price"] == 38.00  # overridden price


def test_scan_master_product_barcode_expansion(api, seed_catalog):
    """Scanning master product barcode resolves type: PRODUCT with all variants."""
    tshirt = seed_catalog["tshirt"]
    master_bc = tshirt["barcode"]  # 8934567890000

    resp = api.scan_barcode(master_bc)
    assert resp.is_success
    assert resp.status_code == 200
    data = resp.data
    assert data["type"] == "PRODUCT"
    product = data["product"]
    assert product["name"] == "Cotton T-Shirt"
    assert len(product["variants"]) == 6


def test_scan_nonexistent_barcode_returns_404_envelope(api):
    """Scanning unknown barcode returns 404 with uniform error envelope."""
    resp = api.scan_barcode("9999999999999")
    assert resp.status_code == 404
    assert resp.success is False
    assert "not recognized" in resp.message.lower() or "not found" in resp.message.lower()
    assert "code" in resp.errors


def test_scan_empty_barcode_parameter_returns_422(api):
    """Calling scan endpoint without code param returns 422 error envelope."""
    resp = api.get("/inventory/scan")
    assert resp.status_code == 422
    assert resp.success is False
    assert "code" in resp.errors


def test_scan_case_insensitive_sku_resolution(api, seed_catalog):
    """Scanning SKU in lowercase correctly resolves to the upper-cased variant."""
    jeans = seed_catalog["jeans"]
    var = jeans["variants"][1]  # DENIM-JEANS-32-BLUE
    lower_sku = var["sku"].lower()

    resp = api.scan_barcode(lower_sku)
    assert resp.is_success
    assert resp.data["type"] == "VARIANT"
    assert resp.data["variant"]["id"] == var["id"]
