"""
Tier 1: Feature Coverage - Uniform Error Envelopes.
Tests uniform API error structure { success: false, message: str, errors: dict }
across validation failures, missing resources, and malformed inputs.
"""

import pytest


def test_error_envelope_422_validation_failure(api):
    """Verify 422 Unprocessable Entity response conforms to uniform error envelope."""
    # Attempt product creation with missing name and negative prices
    resp = api.create_product({
        "purchase_price": -5.00,
        "selling_price": -10.00
    })
    assert resp.status_code == 422
    assert resp.success is False
    assert isinstance(resp.message, str)
    assert len(resp.message) > 0
    assert isinstance(resp.errors, dict)
    assert "name" in resp.errors
    assert "purchase_price" in resp.errors
    assert "selling_price" in resp.errors


def test_error_envelope_404_resource_not_found(api):
    """Verify 404 Not Found returns uniform error envelope."""
    resp = api.get("/products/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
    assert resp.success is False
    assert "not found" in resp.message.lower()
    assert isinstance(resp.errors, dict)


def test_error_envelope_unknown_route(api):
    """Verify requesting an undefined route returns 404 with standard envelope."""
    resp = api.get("/nonexistent/unknown-endpoint")
    assert resp.status_code == 404
    assert resp.success is False
    assert isinstance(resp.errors, dict)


def test_error_envelope_checkout_missing_fields(api):
    """Verify checkout validation failure produces field-specific error arrays."""
    resp = api.checkout({})
    assert resp.status_code == 422
    assert resp.success is False
    assert "client_mutation_id" in resp.errors
    assert "channel_id" in resp.errors
    assert "items" in resp.errors
    assert "payment" in resp.errors


def test_success_envelope_standard_structure(api):
    """Verify successful requests follow { success: true, data: ... } standard structure."""
    resp = api.get("/sales-channels")
    assert resp.status_code == 200
    assert resp.success is True
    assert isinstance(resp.data, list)
    assert len(resp.data) >= 1
