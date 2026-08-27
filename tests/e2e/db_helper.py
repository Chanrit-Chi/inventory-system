"""
Database Inspection and Assertion Helper for E2E Tests.
Provides methods to inspect database state, query stock movement ledgers,
verify loyalty points, and assert database invariants.
"""

from typing import Any, Dict, List, Optional
from decimal import Decimal


class DbHelper:
    """Helper for inspecting relational state and asserting invariants."""

    def __init__(self, api_client):
        self.api_client = api_client
        self.engine = api_client.engine

    def reset_state(self):
        """Reset the in-memory engine state."""
        self.engine.reset_all()

    def get_variant(self, variant_id_or_sku: str) -> Optional[Dict[str, Any]]:
        # Check by id
        if variant_id_or_sku in self.engine.product_variants:
            return self.engine.product_variants[variant_id_or_sku]
        # Check by SKU
        for v in self.engine.product_variants.values():
            if v["sku"] == variant_id_or_sku:
                return v
        return None

    def get_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        return self.engine.products.get(product_id)

    def get_stock_movements(self, variant_id: Optional[str] = None, reference_id: Optional[str] = None) -> List[Dict[str, Any]]:
        movements = self.engine.stock_movements
        if variant_id:
            movements = [m for m in movements if m["variant_id"] == variant_id]
        if reference_id:
            movements = [m for m in movements if m["reference_id"] == reference_id]
        return list(movements)

    def get_customer_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        for c in self.engine.customers.values():
            if c.get("deleted_at") is None and c.get("phone") == phone:
                return c
        return None

    def get_order(self, order_id_or_number: str) -> Optional[Dict[str, Any]]:
        if order_id_or_number in self.engine.orders:
            return self.engine.orders[order_id_or_number]
        if order_id_or_number in self.engine.orders_by_number:
            return self.engine.orders[self.engine.orders_by_number[order_id_or_number]]
        return None

    def get_payments_for_order(self, order_id: str) -> List[Dict[str, Any]]:
        return [p for p in self.engine.payments if p["order_id"] == order_id]

    def get_order_items(self, order_id: str) -> List[Dict[str, Any]]:
        return [i for i in self.engine.order_items if i["order_id"] == order_id]

    def get_restock_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self.engine.restock_sessions.get(session_id)

    def get_expenses(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        expenses = self.engine.expenses
        if category:
            expenses = [e for e in expenses if e["category"].lower() == category.lower()]
        return list(expenses)

    # ---------------- Assertion Helpers ----------------

    def assert_stock_level(self, variant_id: str, expected_qoh: int):
        variant = self.get_variant(variant_id)
        assert variant is not None, f"Variant with id {variant_id} does not exist."
        actual_qoh = variant["quantity_on_hand"]
        assert actual_qoh == expected_qoh, (
            f"Stock level mismatch for variant {variant.get('sku', variant_id)}: "
            f"expected {expected_qoh}, got {actual_qoh}"
        )

    def assert_movement_recorded(self, variant_id: str, movement_type: str, quantity_change: int, reference_id: Optional[str] = None):
        movements = self.get_stock_movements(variant_id=variant_id)
        matched = [
            m for m in movements
            if m["movement_type"] == movement_type and m["quantity_change"] == quantity_change
        ]
        if reference_id:
            matched = [m for m in matched if m["reference_id"] == reference_id]

        assert len(matched) > 0, (
            f"Expected stock movement not found for variant {variant_id}: "
            f"type={movement_type}, change={quantity_change}, ref={reference_id}. "
            f"Found movements: {movements}"
        )

    def assert_customer_loyalty(self, phone: str, expected_total_purchased: int, expected_total_spent: float):
        cust = self.get_customer_by_phone(phone)
        assert cust is not None, f"Customer with phone {phone} does not exist."
        assert cust["total_purchased"] == expected_total_purchased, (
            f"Customer total_purchased mismatch for {phone}: "
            f"expected {expected_total_purchased}, got {cust['total_purchased']}"
        )
        actual_spent = float(Decimal(str(cust["total_spent"])))
        expected_spent = float(Decimal(str(expected_total_spent)))
        assert abs(actual_spent - expected_spent) < 0.01, (
            f"Customer total_spent mismatch for {phone}: "
            f"expected {expected_spent}, got {actual_spent}"
        )
