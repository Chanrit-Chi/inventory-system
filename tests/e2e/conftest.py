"""
Pytest configuration and fixtures for Omnichannel POS and Inventory Management System E2E tests.
"""

import uuid
import random
import pytest
from tests.e2e.api_client import ApiClient
from tests.e2e.db_helper import DbHelper


@pytest.fixture(scope="function")
def api():
    """Provides a fresh ApiClient instance per test."""
    client = ApiClient()
    return client


@pytest.fixture(scope="function")
def db(api):
    """Provides a DbHelper instance connected to the test api client."""
    return DbHelper(api)


@pytest.fixture
def unique_mutation_id():
    """Generates a fresh UUIDv4 string for client_mutation_id."""
    return str(uuid.uuid4())


@pytest.fixture
def unique_phone():
    """Generates a unique Cambodian-formatted phone number (+855...)."""
    random_digits = "".join([str(random.randint(0, 9)) for _ in range(7)])
    return f"+85512{random_digits}"


@pytest.fixture
def pos_channel_id():
    """Returns default POS sales channel UUID."""
    return "9e1189c4-0a32-47d5-8664-88404a11f26e"


@pytest.fixture
def web_channel_id():
    """Returns default Web Store sales channel UUID."""
    return "9e1189c4-0a32-47d5-8664-88404a11f26f"


@pytest.fixture
def mobile_channel_id():
    """Returns default Mobile POS sales channel UUID."""
    return "9e1189c4-0a32-47d5-8664-88404a11f270"


@pytest.fixture(scope="function")
def seed_catalog(api):
    """
    Creates standard products with variants and restocked inventory
    ready for immediate checkout and testing.
    """
    # 1. Product: Cotton T-Shirt with Size (S, M, L) and Color (Red, Blue)
    tshirt_payload = {
        "name": "Cotton T-Shirt",
        "barcode": "8934567890000",
        "purchase_price": 6.50,
        "selling_price": 15.00,
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
                    "c0000000-0000-0000-0000-000000000001",  # Red
                    "c0000000-0000-0000-0000-000000000002",  # Blue
                ]
            }
        ]
    }
    tshirt_resp = api.create_product(tshirt_payload)
    assert tshirt_resp.is_success, f"Failed to seed tshirt: {tshirt_resp.message}"
    tshirt = tshirt_resp.data

    # Restock initial inventory for variants
    restock_items = []
    for var in tshirt["variants"]:
        # Assign explicit barcodes for testing scanner
        var_barcode = f"893000000{var['sku'].replace('-', '')[:6]}"
        var["barcode"] = var_barcode
        api.engine.product_variants[var["id"]]["barcode"] = var_barcode
        restock_items.append({
            "variant_id": var["id"],
            "quantity": 20,
            "unit_cost": 6.50,
            "scanned_barcode": var_barcode
        })

    api.restock({"status": "COMPLETED", "items": restock_items, "notes": "Initial Catalog Seed"})

    # 2. Product: Denim Jeans with direct variant pricing override
    jeans_payload = {
        "name": "Denim Jeans",
        "barcode": "8934567891000",
        "purchase_price": 18.00,
        "selling_price": 35.00,
        "default_reorder_level": 3,
        "variants": [
            {
                "sku": "DENIM-JEANS-30-BLUE",
                "barcode": "8934567891001",
                "quantity_on_hand": 10,
                "cost_price_override": 18.00,
                "selling_price_override": 38.00,  # override
                "reorder_level": 3,
            },
            {
                "sku": "DENIM-JEANS-32-BLUE",
                "barcode": "8934567891002",
                "quantity_on_hand": 15,
                "cost_price_override": None,
                "selling_price_override": None,  # inherit base 35.00
                "reorder_level": 3,
            }
        ]
    }
    jeans_resp = api.create_product(jeans_payload)
    assert jeans_resp.is_success, f"Failed to seed jeans: {jeans_resp.message}"
    jeans = jeans_resp.data

    return {
        "tshirt": tshirt,
        "jeans": jeans,
    }
