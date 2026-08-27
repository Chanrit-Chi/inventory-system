"""
Tier 4: Realistic Omnichannel Application Workloads - Flash Sale Inventory Depletion.
Simulates a high-velocity flash sale:
1. Limited-edition variant initialized with 10 units and reorder_level = 3
2. Wave 1: Rapid succession of customer checkouts depleting stock down to low-stock threshold (2 units remaining)
3. Wave 2: Checkout draining remaining 2 units to exact zero
4. Wave 3: Subsequent customer attempt rejected cleanly with 422 Insufficient Stock
5. Verify zero stock invariant and exact ledger count
"""

import pytest
import uuid


def test_workload_flash_sale_inventory_drain(api, db, pos_channel_id):
    """Execute high-velocity flash sale depletion and low stock threshold verification."""
    # 1. Create limited flash sale item
    prod_resp = api.create_product({
        "name": "Flash Sale Smart Watch",
        "purchase_price": 40.00,
        "selling_price": 89.99,
        "default_reorder_level": 3,
        "variants": [
            {
                "sku": "WATCH-FLASH-BLACK",
                "barcode": "8939988110022",
                "quantity_on_hand": 10,
                "reorder_level": 3,
            }
        ]
    })
    assert prod_resp.is_success
    var = prod_resp.data["variants"][0]
    var_id = var["id"]

    # Wave 1: 4 distinct customer orders of 2 units each (Total 8 units sold)
    for i in range(4):
        order_resp = api.checkout({
            "client_mutation_id": str(uuid.uuid4()),
            "channel_id": pos_channel_id,
            "customer": {"phone": f"+8551290000{i}", "name": f"Flash Customer {i}"},
            "items": [{"variant_id": var_id, "quantity": 2, "unit_price": 89.99}],
            "payment": {"payment_method": "ABA_QR", "amount": 179.98}
        })
        assert order_resp.is_success

    # Stock should now be 10 - 8 = 2 units (which is <= reorder_level 3: Low Stock Warning)
    var_state = db.get_variant(var_id)
    assert var_state["quantity_on_hand"] == 2
    assert var_state["quantity_on_hand"] <= var_state["reorder_level"]  # Low stock state

    # Wave 2: Final customer buys exact remaining 2 units
    drain_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "customer": {"phone": "+85512900009", "name": "Lucky Final Customer"},
        "items": [{"variant_id": var_id, "quantity": 2, "unit_price": 89.99}],
        "payment": {"payment_method": "CASH", "amount": 179.98}
    })
    assert drain_resp.is_success
    db.assert_stock_level(var_id, 0)

    # Wave 3: Subsequent customer attempt to buy 1 unit fails cleanly
    rejected_resp = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": var_id, "quantity": 1, "unit_price": 89.99}],
        "payment": {"payment_method": "CASH", "amount": 89.99}
    })
    assert rejected_resp.status_code == 422
    assert rejected_resp.success is False
    db.assert_stock_level(var_id, 0)

    # Verify stock movement ledger entries: 1 INITIAL + 5 SALE movements = 6 entries
    movements = db.get_stock_movements(variant_id=var_id)
    sale_movements = [m for m in movements if m["movement_type"] == "SALE"]
    assert len(sale_movements) == 5
    assert sum(abs(m["quantity_change"]) for m in sale_movements) == 10
