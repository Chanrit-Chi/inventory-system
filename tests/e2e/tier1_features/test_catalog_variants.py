"""
Tier 1: Feature Coverage - Catalog and Variant Matrix Generation.
Tests Cartesian product matrix calculation, deterministic SKU format, price overrides,
and relational attribute attachments.
"""

import pytest


def test_cartesian_product_matrix_generation_2x2(api):
    """Verify 2x2 attribute matrix generates exactly 4 variants."""
    payload = {
        "name": "Summer Shorts",
        "barcode": "8931111111111",
        "purchase_price": 5.00,
        "selling_price": 12.00,
        "default_reorder_level": 4,
        "attributes": [
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000001",  # Size
                "value_ids": [
                    "b0000000-0000-0000-0000-000000000001",  # S
                    "b0000000-0000-0000-0000-000000000002",  # M
                ]
            },
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000002",  # Color
                "value_ids": [
                    "c0000000-0000-0000-0000-000000000001",  # Red
                    "c0000000-0000-0000-0000-000000000002",  # Blue
                ]
            }
        ]
    }
    resp = api.create_product(payload)
    assert resp.is_success
    assert resp.status_code == 201
    product = resp.data
    assert product["name"] == "Summer Shorts"
    assert len(product["variants"]) == 4


def test_cartesian_product_matrix_generation_3x2(api):
    """Verify 3x2 attribute matrix generates exactly 6 variants."""
    payload = {
        "name": "Classic Hoodie",
        "barcode": "8932222222222",
        "purchase_price": 12.00,
        "selling_price": 28.00,
        "default_reorder_level": 5,
        "attributes": [
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000001",  # Size
                "value_ids": [
                    "b0000000-0000-0000-0000-000000000001",  # S
                    "b0000000-0000-0000-0000-000000000002",  # M
                    "b0000000-0000-0000-0000-000000000003",  # L
                ]
            },
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000002",  # Color
                "value_ids": [
                    "c0000000-0000-0000-0000-000000000003",  # Black
                    "c0000000-0000-0000-0000-000000000004",  # White
                ]
            }
        ]
    }
    resp = api.create_product(payload)
    assert resp.is_success
    product = resp.data
    assert len(product["variants"]) == 6


def test_deterministic_sku_format(api):
    """Verify deterministic SKU formatting: [PRODUCT-NAME]-[ATTR1]-[ATTR2]."""
    payload = {
        "name": "Graphic Tank",
        "purchase_price": 4.00,
        "selling_price": 10.00,
        "attributes": [
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000001",
                "value_ids": ["b0000000-0000-0000-0000-000000000001"]  # S
            },
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000002",
                "value_ids": ["c0000000-0000-0000-0000-000000000001"]  # Red
            }
        ]
    }
    resp = api.create_product(payload)
    assert resp.is_success
    variants = resp.data["variants"]
    assert len(variants) == 1
    assert variants[0]["sku"] == "GRAPHIC-TANK-S-RED"


def test_price_overrides_precedence(api):
    """Verify variant selling_price_override takes precedence over parent base selling_price."""
    payload = {
        "name": "Premium Jacket",
        "purchase_price": 50.00,
        "selling_price": 100.00,
        "variants": [
            {
                "sku": "JACKET-STANDARD",
                "selling_price_override": None,  # should inherit 100.00
                "cost_price_override": None,
                "quantity_on_hand": 5,
            },
            {
                "sku": "JACKET-LEATHER-EDITION",
                "selling_price_override": 149.99,  # override
                "cost_price_override": 75.00,
                "quantity_on_hand": 2,
            }
        ]
    }
    resp = api.create_product(payload)
    assert resp.is_success
    variants = resp.data["variants"]

    std_var = next(v for v in variants if v["sku"] == "JACKET-STANDARD")
    leather_var = next(v for v in variants if v["sku"] == "JACKET-LEATHER-EDITION")

    assert std_var["selling_price_override"] is None
    assert leather_var["selling_price_override"] == 149.99
    assert leather_var["cost_price_override"] == 75.00


def test_single_attribute_dimension(api):
    """Verify single attribute produces exact 1D list of variants."""
    payload = {
        "name": "Plain Cap",
        "purchase_price": 3.00,
        "selling_price": 8.00,
        "attributes": [
            {
                "attribute_id": "a0000000-0000-0000-0000-000000000002",  # Color
                "value_ids": [
                    "c0000000-0000-0000-0000-000000000001",  # Red
                    "c0000000-0000-0000-0000-000000000002",  # Blue
                    "c0000000-0000-0000-0000-000000000003",  # Black
                ]
            }
        ]
    }
    resp = api.create_product(payload)
    assert resp.is_success
    variants = resp.data["variants"]
    assert len(variants) == 3
    skus = [v["sku"] for v in variants]
    assert "PLAIN-CAP-RED" in skus
    assert "PLAIN-CAP-BLUE" in skus
    assert "PLAIN-CAP-BLACK" in skus


def test_get_product_by_id_includes_variants(api):
    """Verify GET /api/v1/products/{id} returns parent details and all child variants."""
    create_resp = api.create_product({
        "name": "Silk Scarf",
        "purchase_price": 10.00,
        "selling_price": 25.00,
        "barcode": "8933333333333"
    })
    assert create_resp.is_success
    prod_id = create_resp.data["id"]

    get_resp = api.get(f"/products/{prod_id}")
    assert get_resp.is_success
    assert get_resp.data["id"] == prod_id
    assert len(get_resp.data["variants"]) == 1
    assert get_resp.data["variants"][0]["sku"] == "SILK-SCARF"
