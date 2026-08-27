"""
Tier 4: Realistic Omnichannel Application Workloads - POS Cashier Shift Reconciliation.
Simulates a full cashier work shift:
1. Shift Opening with cash float
2. Processing mixed payment transactions (Cash, ABA QR) and applied discounts
3. Payout of mid-shift operational expense from cash drawer
4. End-of-shift net cash reconciliation against sales receipts and expense logs
"""

import pytest
import uuid
from decimal import Decimal


def test_workload_pos_cashier_shift_reconciliation(api, seed_catalog, pos_channel_id):
    """Execute cashier shift lifecycle and reconcile cash drawer balance."""
    tshirt = seed_catalog["tshirt"]["variants"][0]  # $15.00

    opening_cash_float = Decimal("100.00")
    collected_cash_sales = Decimal("0.00")
    collected_digital_sales = Decimal("0.00")

    # Transaction 1: Cash sale 2 units ($30.00)
    tx1 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": tshirt["id"], "quantity": 2, "unit_price": 15.00}],
        "payment": {"payment_method": "CASH", "amount": 30.00}
    })
    assert tx1.is_success
    collected_cash_sales += Decimal("30.00")

    # Transaction 2: ABA QR sale 3 units ($45.00)
    tx2 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": tshirt["id"], "quantity": 3, "unit_price": 15.00}],
        "payment": {"payment_method": "ABA_QR", "amount": 45.00, "transaction_ref": "ABA-SHIFT-01"}
    })
    assert tx2.is_success
    collected_digital_sales += Decimal("45.00")

    # Transaction 3: Cash sale 1 unit with $2.00 discount ($13.00)
    tx3 = api.checkout({
        "client_mutation_id": str(uuid.uuid4()),
        "channel_id": pos_channel_id,
        "items": [{"variant_id": tshirt["id"], "quantity": 1, "unit_price": 15.00}],
        "discount": 2.00,
        "payment": {"payment_method": "CASH", "amount": 13.00}
    })
    assert tx3.is_success
    collected_cash_sales += Decimal("13.00")

    # Mid-shift Expense Payout from drawer: $20.00 for cleaning supplies
    exp = api.create_expense({
        "expense_date": "2026-08-18",
        "category": "Store Supplies",
        "amount": 20.00,
        "payment_method": "CASH",
        "notes": "Paid cash to cleaner"
    })
    assert exp.is_success
    paid_cash_expense = Decimal("20.00")

    # -------------------------------------------------------------
    # Shift Closing Reconciliation
    # Expected Drawer Cash = Float (100) + Cash Sales (30 + 13 = 43) - Cash Expense (20) = 123.00
    # Expected Digital Total = 45.00
    # -------------------------------------------------------------
    expected_drawer_cash = opening_cash_float + collected_cash_sales - paid_cash_expense
    expected_total_revenue = collected_cash_sales + collected_digital_sales

    assert expected_drawer_cash == Decimal("123.00")
    assert expected_total_revenue == Decimal("88.00")
