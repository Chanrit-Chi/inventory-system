"""
Tier 4: Realistic Omnichannel Application Workloads - Mobile Offline Mutation Queue Sync.
Simulates Mobile POS operating in offline mode:
1. Mobile device generates 5 distinct offline orders with client-generated UUIDv4 mutation keys
2. Network connection restored -> Queue drained and replayed sequentially against POST /orders/checkout
3. Network blip triggers duplicate sync replay -> Backend idempotently deduplicates all 5 mutations with zero duplicate deductions
"""

import pytest
import uuid


def test_workload_offline_mutation_queue_sync_and_replay(api, db, seed_catalog, mobile_channel_id):
    """Execute mobile offline queue sync and verify idempotent replay safety."""
    var = seed_catalog["tshirt"]["variants"][0]  # stock = 20
    var_id = var["id"]
    stock_before = db.get_variant(var_id)["quantity_on_hand"]

    # 1. Prepare offline mutation queue (5 distinct transactions)
    offline_queue = []
    for i in range(5):
        mutation_key = str(uuid.uuid4())
        offline_queue.append({
            "client_mutation_id": mutation_key,
            "channel_id": mobile_channel_id,
            "customer": {"phone": f"+8551277000{i}", "name": f"Offline Customer {i}"},
            "items": [{"variant_id": var_id, "quantity": 1, "unit_price": 15.00}],
            "payment": {"payment_method": "CASH", "amount": 15.00},
            "note": f"Offline transaction #{i+1}"
        })

    # 2. First Sync (Online sync queue replay)
    synced_order_ids = []
    for payload in offline_queue:
        resp = api.checkout(payload)
        assert resp.is_success
        synced_order_ids.append(resp.data["id"])

    assert len(synced_order_ids) == 5
    assert len(set(synced_order_ids)) == 5  # 5 unique orders created

    # Stock should be decremented by exactly 5
    db.assert_stock_level(var_id, stock_before - 5)

    # 3. Duplicate Sync Replay (Simulating network retry where queue is re-sent)
    replayed_order_ids = []
    for payload in offline_queue:
        resp = api.checkout(payload)
        assert resp.is_success
        replayed_order_ids.append(resp.data["id"])

    # Replayed order IDs must exactly match original order IDs
    assert replayed_order_ids == synced_order_ids

    # Invariant: Stock must NOT have decremented further
    db.assert_stock_level(var_id, stock_before - 5)
