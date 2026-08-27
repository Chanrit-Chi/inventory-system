"""
Tier 1: Feature Coverage - Expenses Management.
Tests recording operational expenses, expense categories, payment methods,
and date-range filtering.
"""

import pytest


def test_create_operational_expense(api, db):
    """Verify recording an operational expense."""
    payload = {
        "expense_date": "2026-08-18",
        "category": "Store Supplies",
        "amount": 45.50,
        "payment_method": "CASH",
        "notes": "Thermal receipt rolls and cleaning supplies"
    }
    resp = api.create_expense(payload)
    assert resp.is_success
    assert resp.status_code == 201
    expense = resp.data
    assert expense["category"] == "Store Supplies"
    assert expense["amount"] == 45.50
    assert expense["payment_method"] == "CASH"

    # Verify db state
    expenses = db.get_expenses(category="Store Supplies")
    assert len(expenses) > 0


def test_expense_categories_support(api):
    """Verify various operational expense categories."""
    categories = ["Utilities", "Staff Salary", "Store Maintenance", "Marketing"]
    for cat in categories:
        resp = api.create_expense({
            "expense_date": "2026-08-18",
            "category": cat,
            "amount": 100.00,
            "payment_method": "ABA_TRANSFER",
            "notes": f"Operational expense for {cat}"
        })
        assert resp.is_success
        assert resp.data["category"] == cat


def test_expense_date_filtering(api):
    """Verify GET /api/v1/expenses date range filtering."""
    api.create_expense({"expense_date": "2026-08-01", "category": "Rent", "amount": 500.00, "payment_method": "BANK_TRANSFER"})
    api.create_expense({"expense_date": "2026-08-15", "category": "Electricity", "amount": 120.00, "payment_method": "ABA_QR"})
    api.create_expense({"expense_date": "2026-08-20", "category": "Water", "amount": 35.00, "payment_method": "CASH"})

    # Filter between 2026-08-10 and 2026-08-18
    resp = api.get("/expenses", params={"from_date": "2026-08-10", "to_date": "2026-08-18"})
    assert resp.is_success
    records = resp.data
    assert len(records) >= 1
    for rec in records:
        assert "2026-08-10" <= rec["expense_date"] <= "2026-08-18"


def test_expense_category_filtering(api):
    """Verify filtering expenses by category."""
    api.create_expense({"expense_date": "2026-08-18", "category": "Logistics", "amount": 25.00, "payment_method": "CASH"})
    api.create_expense({"expense_date": "2026-08-18", "category": "Logistics", "amount": 35.00, "payment_method": "CASH"})

    resp = api.get("/expenses", params={"category": "Logistics"})
    assert resp.is_success
    assert len(resp.data) >= 2
    for item in resp.data:
        assert item["category"].lower() == "logistics"


def test_expense_validation_missing_fields_rejected(api):
    """Verify validation failure when required expense fields are missing."""
    resp = api.create_expense({})
    assert resp.status_code == 422
    assert resp.success is False
    assert "category" in resp.errors
    assert "amount" in resp.errors
    assert "payment_method" in resp.errors
