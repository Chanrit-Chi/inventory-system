"""
E2E API Client for Omnichannel POS and Inventory Management System.
Supports connecting to a live Laravel backend API or running against a
high-fidelity, self-contained simulated engine that enforces all business
invariants, schema constraints, and uniform response envelopes.
"""

import os
import json
import uuid
import re
import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Union
import itertools


class ApiResponse:
    """Standardized API Response wrapper conforming to the uniform JSON envelope."""

    def __init__(self, status_code: int, data: Optional[Dict[str, Any]] = None, text: str = ""):
        self.status_code = status_code
        self._raw_text = text
        self._json_data = data or {}

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300 and self._json_data.get("success", True) is True

    @property
    def is_error(self) -> bool:
        return not self.is_success

    @property
    def success(self) -> bool:
        return bool(self._json_data.get("success", self.is_success))

    @property
    def message(self) -> str:
        return self._json_data.get("message", "")

    @property
    def errors(self) -> Dict[str, Any]:
        return self._json_data.get("errors", {})

    @property
    def data(self) -> Any:
        return self._json_data.get("data")

    @property
    def meta(self) -> Dict[str, Any]:
        return self._json_data.get("meta", {})

    def json(self) -> Dict[str, Any]:
        return self._json_data

    def __repr__(self) -> str:
        return f"<ApiResponse [{self.status_code}] success={self.success}>"


class SimulatedApiEngine:
    """
    In-memory stateful relational API engine implementing the exact domain specifications:
    - 15 relational tables with UUID PKs & CHECK (quantity_on_hand >= 0)
    - Cartesian Product Variant Generator with deterministic SKU format
    - Two-Tier Barcode Scanner Resolution
    - Atomic Checkout with Idempotency (client_mutation_id) & Stock Movement Ledgering
    - Customer Loyalty Auto-Upsert & Metric Accrual
    - Restock Session State Machine & Expenses Management
    - Uniform JSON Envelopes for Success and Error responses
    """

    def __init__(self):
        self.reset_all()

    def reset_all(self):
        # 15 Relational Tables
        self.attributes: Dict[str, Dict[str, Any]] = {}
        self.attribute_values: Dict[str, Dict[str, Any]] = {}
        self.products: Dict[str, Dict[str, Any]] = {}
        self.product_attributes: Dict[str, Dict[str, Any]] = {}
        self.product_variants: Dict[str, Dict[str, Any]] = {}
        self.variant_attribute_values: Dict[str, Dict[str, Any]] = {}
        self.stock_movements: List[Dict[str, Any]] = []
        self.customers: Dict[str, Dict[str, Any]] = {}
        self.sales_channels: Dict[str, Dict[str, Any]] = {}
        self.orders: Dict[str, Dict[str, Any]] = {}
        self.order_items: List[Dict[str, Any]] = []
        self.payments: List[Dict[str, Any]] = []
        self.restock_sessions: Dict[str, Dict[str, Any]] = {}
        self.restock_details: List[Dict[str, Any]] = []
        self.expenses: List[Dict[str, Any]] = []
        self.users: Dict[str, Dict[str, Any]] = {}
        self.tokens: Dict[str, Dict[str, Any]] = {}  # token_string -> user_dict

        # Unique indexes
        self.orders_by_mutation: Dict[str, str] = {}  # mutation_id -> order_id
        self.orders_by_number: Dict[str, str] = {}    # order_number -> order_id
        self.order_sequence = 1
        self.seed_defaults()

    def seed_defaults(self):
        """Seed default attributes, attribute values, sales channels, and users."""
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Seed default users
        default_users = [
            {
                "id": "u0000000-0000-0000-0000-000000000001",
                "name": "System Administrator",
                "email": "admin@inventory.local",
                "password": "password",
                "phone": "+85512000001",
                "role": "SUPER_ADMIN",
                "is_active": True,
                "permission_group": "System Owners",
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            },
            {
                "id": "u0000000-0000-0000-0000-000000000002",
                "name": "Branch Admin",
                "email": "branch@inventory.local",
                "password": "password",
                "phone": "+85512000002",
                "role": "ADMIN",
                "is_active": True,
                "permission_group": "Branch Admins",
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            },
            {
                "id": "u0000000-0000-0000-0000-000000000003",
                "name": "Store Manager",
                "email": "manager@inventory.local",
                "password": "password",
                "phone": "+85512000003",
                "role": "MANAGER",
                "is_active": True,
                "permission_group": "Store Managers",
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            },
            {
                "id": "u0000000-0000-0000-0000-000000000004",
                "name": "Main POS Cashier",
                "email": "cashier1@inventory.local",
                "password": "password",
                "phone": "+85512000004",
                "role": "SELLER",
                "is_active": True,
                "permission_group": "Cashiers / Sellers",
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            },
            {
                "id": "u0000000-0000-0000-0000-000000000005",
                "name": "Secondary Cashier",
                "email": "cashier2@inventory.local",
                "password": "password",
                "phone": "+85512000005",
                "role": "SELLER",
                "is_active": True,
                "permission_group": "Cashiers / Sellers",
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            },
        ]
        for u in default_users:
            self.users[u["id"]] = u

        # Attributes: Size, Color, Material
        size_attr_id = "a0000000-0000-0000-0000-000000000001"
        self.attributes[size_attr_id] = {
            "id": size_attr_id,
            "name": "Size",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        for val_id, val_name in [
            ("b0000000-0000-0000-0000-000000000001", "S"),
            ("b0000000-0000-0000-0000-000000000002", "M"),
            ("b0000000-0000-0000-0000-000000000003", "L"),
            ("b0000000-0000-0000-0000-000000000004", "XL"),
        ]:
            self.attribute_values[val_id] = {
                "id": val_id,
                "attribute_id": size_attr_id,
                "value_name": val_name,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }

        color_attr_id = "a0000000-0000-0000-0000-000000000002"
        self.attributes[color_attr_id] = {
            "id": color_attr_id,
            "name": "Color",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        for val_id, val_name in [
            ("c0000000-0000-0000-0000-000000000001", "Red"),
            ("c0000000-0000-0000-0000-000000000002", "Blue"),
            ("c0000000-0000-0000-0000-000000000003", "Black"),
            ("c0000000-0000-0000-0000-000000000004", "White"),
        ]:
            self.attribute_values[val_id] = {
                "id": val_id,
                "attribute_id": color_attr_id,
                "value_name": val_name,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }

        # Sales Channels: POS, Web, Mobile
        pos_channel_id = "9e1189c4-0a32-47d5-8664-88404a11f26e"
        self.sales_channels[pos_channel_id] = {
            "id": pos_channel_id,
            "name": "POS Terminal",
            "image_url": "https://cdn.store.com/pos.png",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        web_channel_id = "9e1189c4-0a32-47d5-8664-88404a11f26f"
        self.sales_channels[web_channel_id] = {
            "id": web_channel_id,
            "name": "Web Store",
            "image_url": "https://cdn.store.com/web.png",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        mobile_channel_id = "9e1189c4-0a32-47d5-8664-88404a11f270"
        self.sales_channels[mobile_channel_id] = {
            "id": mobile_channel_id,
            "name": "Mobile POS",
            "image_url": "https://cdn.store.com/mobile.png",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

    # ---------------- Helper Methods ----------------

    def _format_user(self, user: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone"),
            "role": user["role"],
            "isActive": bool(user.get("is_active", True)),
            "permissionGroup": user.get("permission_group"),
            "lastActive": user.get("updated_at"),
        }

    def _extract_bearer_token(self, headers: Optional[Dict[str, str]]) -> Optional[str]:
        if not headers:
            return None
        auth_val = None
        for k, v in headers.items():
            if k.lower() == "authorization":
                auth_val = v
                break
        if not auth_val:
            return None
        parts = auth_val.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return auth_val.strip()

    def _get_auth_user(self, headers: Optional[Dict[str, str]]) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        token = self._extract_bearer_token(headers)
        if not token:
            return None, None
        user = self.tokens.get(token)
        return user, token

    def _require_admin_auth(self, headers: Optional[Dict[str, str]]) -> tuple[Optional[Dict[str, Any]], Optional[ApiResponse]]:
        user, token = self._get_auth_user(headers)
        if not user or not token:
            return None, ApiResponse(401, {"success": False, "message": "Unauthenticated.", "errors": {"auth": ["Unauthenticated."]}})
        if user.get("deleted_at") is not None:
            return None, ApiResponse(401, {"success": False, "message": "Unauthenticated.", "errors": {"auth": ["Unauthenticated."]}})
        if not user.get("is_active", True):
            return None, ApiResponse(403, {"success": False, "message": "Your account has been deactivated. Contact an administrator.", "errors": {"account": ["Account deactivated."]}})
        if user.get("role") not in ("SUPER_ADMIN", "ADMIN"):
            return None, ApiResponse(403, {"success": False, "message": "Forbidden. This action is restricted to Administrators.", "errors": {"role": ["Unauthorized role."]}})
        return user, None

    def _now_iso(self) -> str:
        return datetime.datetime.now(datetime.timezone.utc).isoformat()

    def _sanitize_sku_part(self, text: str) -> str:
        """Convert string to upper-case alphanumeric hyphen-separated token."""
        token = re.sub(r"[^A-Za-z0-9]+", "-", text.strip().upper())
        return token.strip("-")

    def _round_decimal(self, val: Union[float, int, Decimal, str]) -> Decimal:
        return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _is_valid_uuid(self, val: Any) -> bool:
        if not isinstance(val, str):
            return False
        try:
            uuid.UUID(val)
            return True
        except (ValueError, TypeError, AttributeError):
            return False

    def _is_valid_phone(self, phone: str) -> bool:
        if not isinstance(phone, str):
            return False
        cleaned = phone.strip()
        # Phone must contain valid digits/plus and be between 7 and 20 chars
        return bool(re.match(r"^\+?[0-9\s\-()]{7,20}$", cleaned))

    # ---------------- API Routing Handlers ----------------

    def handle_request(self, method: str, path: str, params: Optional[Dict] = None, data: Optional[Dict] = None, headers: Optional[Dict] = None) -> ApiResponse:
        method = method.upper()
        clean_path = path.split("?")[0].rstrip("/")
        if not clean_path.startswith("/"):
            clean_path = "/" + clean_path

        # Normalize prefix /api/v1
        if clean_path.startswith("/api/v1"):
            route = clean_path[len("/api/v1"):]
        else:
            route = clean_path

        if not route:
            route = "/"

        params = params or {}
        data = data or {}
        headers = headers or {}

        try:
            # Route: POST /auth/login
            if route == "/auth/login" and method == "POST":
                return self._post_auth_login(data)

            # Route: POST /auth/logout
            elif route == "/auth/logout" and method == "POST":
                return self._post_auth_logout(headers, data)

            # Route: GET /auth/me
            elif route == "/auth/me" and method == "GET":
                return self._get_auth_me(headers)

            # Route: PATCH /auth/password
            elif route == "/auth/password" and method in ("PATCH", "PUT"):
                return self._patch_auth_password(headers, data)

            # Route: GET /users
            elif route == "/users" and method == "GET":
                return self._get_users(headers, params)

            # Route: POST /users
            elif route == "/users" and method == "POST":
                return self._post_user(headers, data)

            # Route: PATCH /users/{id}/status
            elif route.startswith("/users/") and route.endswith("/status") and method in ("PATCH", "PUT"):
                parts = route.split("/")
                user_id = parts[2]
                return self._patch_user_status(headers, user_id, data)

            # Route: GET /users/{id}
            elif route.startswith("/users/") and method == "GET":
                parts = route.split("/")
                user_id = parts[2]
                return self._get_user_by_id(headers, user_id)

            # Route: PATCH /users/{id}
            elif route.startswith("/users/") and method in ("PATCH", "PUT"):
                parts = route.split("/")
                user_id = parts[2]
                return self._patch_user(headers, user_id, data)

            # Route: DELETE /users/{id}
            elif route.startswith("/users/") and method == "DELETE":
                parts = route.split("/")
                user_id = parts[2]
                return self._delete_user(headers, user_id)

            # Route: GET /attributes
            elif route == "/attributes" and method == "GET":
                return self._get_attributes()

            # Route: POST /products
            elif route == "/products" and method == "POST":
                return self._post_product(data)

            # Route: GET /products
            elif route == "/products" and method == "GET":
                return self._get_products(params)

            # Route: GET /products/{id}
            elif route.startswith("/products/") and method == "GET":
                prod_id = route.split("/")[2]
                return self._get_product_by_id(prod_id)

            # Route: DELETE /products/{id}
            elif route.startswith("/products/") and method == "DELETE":
                prod_id = route.split("/")[2]
                return self._delete_product(prod_id)

            # Route: DELETE /variants/{id}
            elif route.startswith("/variants/") and method == "DELETE":
                variant_id = route.split("/")[2]
                return self._delete_variant(variant_id)

            # Route: GET /inventory/scan
            elif route == "/inventory/scan" and method == "GET":
                code = params.get("code", "")
                return self._get_inventory_scan(code)

            # Route: POST /orders/checkout
            elif route == "/orders/checkout" and method == "POST":
                return self._post_checkout(data)

            # Route: GET /orders
            elif route == "/orders" and method == "GET":
                return self._get_orders(params)

            # Route: GET /orders/{id}
            elif route.startswith("/orders/") and method == "GET":
                order_id = route.split("/")[2]
                return self._get_order_by_id(order_id)

            # Route: POST /inventory/restock or /inventory/restock-sessions
            elif (route in ("/inventory/restock", "/inventory/restock-sessions")) and method == "POST":
                return self._post_restock(data)

            # Route: PUT /inventory/restock-sessions/{id}/complete
            elif route.startswith("/inventory/restock-sessions/") and route.endswith("/complete") and method in ("PUT", "POST"):
                parts = route.split("/")
                session_id = parts[3]
                return self._complete_restock_session(session_id)

            # Route: PUT /inventory/restock-sessions/{id}/cancel
            elif route.startswith("/inventory/restock-sessions/") and route.endswith("/cancel") and method in ("PUT", "POST"):
                parts = route.split("/")
                session_id = parts[3]
                return self._cancel_restock_session(session_id)

            # Route: GET /inventory/restock-sessions
            elif route in ("/inventory/restock", "/inventory/restock-sessions") and method == "GET":
                return self._get_restock_sessions()

            # Route: GET /customers
            elif route == "/customers" and method == "GET":
                return self._get_customers(params)

            # Route: GET /customers/{id}
            elif route.startswith("/customers/") and method == "GET":
                cust_id = route.split("/")[2]
                return self._get_customer_by_id(cust_id)

            # Route: DELETE /customers/{id}
            elif route.startswith("/customers/") and method == "DELETE":
                cust_id = route.split("/")[2]
                return self._delete_customer(cust_id)

            # Route: POST /expenses
            elif route == "/expenses" and method == "POST":
                return self._post_expense(data)

            # Route: GET /expenses
            elif route == "/expenses" and method == "GET":
                return self._get_expenses(params)

            # Route: GET /stock-movements
            elif route == "/stock-movements" and method == "GET":
                return self._get_stock_movements(params)

            # Route: GET /sales-channels
            elif route == "/sales-channels" and method == "GET":
                return self._get_sales_channels()

            else:
                return ApiResponse(404, {
                    "success": False,
                    "message": f"Endpoint not found: {method} {clean_path}",
                    "errors": {"route": [f"Cannot route {method} {clean_path}"]}
                })

        except Exception as ex:
            return ApiResponse(500, {
                "success": False,
                "message": f"Internal Server Error: {str(ex)}",
                "errors": {"exception": [str(ex)]}
            })

    # ---------------- Implementation of Endpoints ----------------

    def _post_auth_login(self, data: Dict[str, Any]) -> ApiResponse:
        errors: Dict[str, List[str]] = {}
        email = data.get("email")
        if not email or not isinstance(email, str) or not email.strip():
            errors["email"] = ["The email field is required."]
        password = data.get("password")
        if not password or not isinstance(password, str) or not password.strip():
            errors["password"] = ["The password field is required."]

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Validation failed.",
                "errors": errors
            })

        clean_email = email.strip().lower()
        matched_user = None
        for u in self.users.values():
            if u.get("deleted_at") is None and u["email"].lower() == clean_email:
                matched_user = u
                break

        if not matched_user or matched_user.get("password") != password:
            return ApiResponse(422, {
                "success": False,
                "message": "The provided credentials are incorrect.",
                "errors": {"email": ["The provided credentials are incorrect."]}
            })

        if not matched_user.get("is_active", True):
            return ApiResponse(403, {
                "success": False,
                "message": "Your account has been deactivated. Contact an administrator.",
                "errors": {"account": ["Your account has been deactivated."]}
            })

        # Issue token
        device_name = data.get("device_name", "e2e_runner")
        token = f"1|sim_{uuid.uuid4().hex}"
        self.tokens[token] = matched_user

        return ApiResponse(200, {
            "success": True,
            "message": "Login successful.",
            "data": {
                "token": token,
                "user": self._format_user(matched_user)
            }
        })

    def _post_auth_logout(self, headers: Optional[Dict[str, str]], data: Optional[Dict[str, Any]] = None) -> ApiResponse:
        user, token = self._get_auth_user(headers)
        if not user or not token:
            return ApiResponse(401, {
                "success": False,
                "message": "Unauthenticated.",
                "errors": {"auth": ["Unauthenticated."]}
            })

        all_devices = False
        if data and isinstance(data, dict):
            all_devices = bool(data.get("all_devices"))

        if all_devices:
            tokens_to_delete = [t for t, u in self.tokens.items() if u["id"] == user["id"]]
            for t in tokens_to_delete:
                del self.tokens[t]
        else:
            if token in self.tokens:
                del self.tokens[token]

        return ApiResponse(200, {
            "success": True,
            "message": "Logged out successfully."
        })

    def _get_auth_me(self, headers: Optional[Dict[str, str]]) -> ApiResponse:
        user, token = self._get_auth_user(headers)
        if not user or not token:
            return ApiResponse(401, {
                "success": False,
                "message": "Unauthenticated.",
                "errors": {"auth": ["Unauthenticated."]}
            })

        if user.get("deleted_at") is not None:
            if token in self.tokens:
                del self.tokens[token]
            return ApiResponse(401, {
                "success": False,
                "message": "Unauthenticated.",
                "errors": {"auth": ["Unauthenticated."]}
            })

        if not user.get("is_active", True):
            tokens_to_delete = [t for t, u in self.tokens.items() if u["id"] == user["id"]]
            for t in tokens_to_delete:
                del self.tokens[t]
            return ApiResponse(403, {
                "success": False,
                "message": "Your account has been deactivated. Contact an administrator.",
                "errors": {"account": ["Your account has been deactivated."]}
            })

        return ApiResponse(200, {
            "success": True,
            "data": self._format_user(user)
        })

    def _patch_auth_password(self, headers: Optional[Dict[str, str]], data: Dict[str, Any]) -> ApiResponse:
        user, token = self._get_auth_user(headers)
        if not user or not token:
            return ApiResponse(401, {
                "success": False,
                "message": "Unauthenticated.",
                "errors": {"auth": ["Unauthenticated."]}
            })

        cur_pass = data.get("current_password")
        new_pass = data.get("new_password")
        if not cur_pass or user.get("password") != cur_pass:
            return ApiResponse(422, {
                "success": False,
                "message": "The current password is incorrect.",
                "errors": {"current_password": ["The current password is incorrect."]}
            })
        if not new_pass or len(new_pass) < 8:
            return ApiResponse(422, {
                "success": False,
                "message": "Validation failed.",
                "errors": {"new_password": ["The new password must be at least 8 characters."]}
            })

        user["password"] = new_pass
        user["updated_at"] = self._now_iso()
        # Revoke other device tokens
        for t in list(self.tokens.keys()):
            if self.tokens[t]["id"] == user["id"] and t != token:
                del self.tokens[t]

        return ApiResponse(200, {
            "success": True,
            "message": "Password updated successfully."
        })

    def _get_users(self, headers: Optional[Dict[str, str]], params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        auth_user, err_resp = self._require_admin_auth(headers)
        if err_resp:
            return err_resp

        user_list = [
            self._format_user(u)
            for u in self.users.values()
            if u.get("deleted_at") is None
        ]
        user_list.sort(key=lambda u: u["name"])
        return ApiResponse(200, {
            "success": True,
            "data": user_list
        })

    def _post_user(self, headers: Optional[Dict[str, str]], data: Dict[str, Any]) -> ApiResponse:
        auth_user, err_resp = self._require_admin_auth(headers)
        if err_resp:
            return err_resp

        errors: Dict[str, List[str]] = {}
        name = data.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            errors["name"] = ["The name field is required."]
        elif len(name) > 100:
            errors["name"] = ["The name must not exceed 100 characters."]

        email = data.get("email")
        if not email or not isinstance(email, str) or not email.strip():
            errors["email"] = ["The email field is required."]
        else:
            clean_email = email.strip().lower()
            for u in self.users.values():
                if u.get("deleted_at") is None and u["email"].lower() == clean_email:
                    errors["email"] = ["The email has already been taken."]
                    break

        role = data.get("role")
        if not role or role not in ("SUPER_ADMIN", "ADMIN", "MANAGER", "SELLER"):
            errors["role"] = ["The selected role is invalid."]

        password = data.get("password")
        if not password or not isinstance(password, str):
            errors["password"] = ["The password field is required."]
        elif len(password) < 8:
            errors["password"] = ["The password must be at least 8 characters."]

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Validation failed.",
                "errors": errors
            })

        now = self._now_iso()
        user_id = str(uuid.uuid4())
        user_record = {
            "id": user_id,
            "name": name.strip(),
            "email": email.strip().lower(),
            "phone": data.get("phone"),
            "role": role,
            "password": password,
            "is_active": True,
            "permission_group": data.get("permission_group"),
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        self.users[user_id] = user_record
        return ApiResponse(201, {
            "success": True,
            "message": "User created successfully.",
            "data": self._format_user(user_record)
        })

    def _get_user_by_id(self, headers: Optional[Dict[str, str]], user_id: str) -> ApiResponse:
        auth_user, err_resp = self._require_admin_auth(headers)
        if err_resp:
            return err_resp

        user = self.users.get(user_id)
        if not user or user.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "User not found.",
                "errors": {"user": ["User does not exist or has been deleted."]}
            })
        return ApiResponse(200, {
            "success": True,
            "data": self._format_user(user)
        })

    def _patch_user(self, headers: Optional[Dict[str, str]], user_id: str, data: Dict[str, Any]) -> ApiResponse:
        auth_user, err_resp = self._require_admin_auth(headers)
        if err_resp:
            return err_resp

        user = self.users.get(user_id)
        if not user or user.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "User not found.",
                "errors": {"user": ["User does not exist or has been deleted."]}
            })

        errors: Dict[str, List[str]] = {}
        if "email" in data:
            email = data["email"]
            if not email or not isinstance(email, str) or not email.strip():
                errors["email"] = ["The email field cannot be empty."]
            else:
                clean_email = email.strip().lower()
                for uid, u in self.users.items():
                    if uid != user_id and u.get("deleted_at") is None and u["email"].lower() == clean_email:
                        errors["email"] = ["The email has already been taken."]
                        break
                if "email" not in errors:
                    user["email"] = clean_email

        if "name" in data:
            name = data["name"]
            if not name or not isinstance(name, str) or not name.strip():
                errors["name"] = ["The name field cannot be empty."]
            elif len(name) > 100:
                errors["name"] = ["The name must not exceed 100 characters."]
            else:
                user["name"] = name.strip()

        if "phone" in data:
            user["phone"] = data["phone"]

        if "role" in data:
            role = data["role"]
            if role not in ("SUPER_ADMIN", "ADMIN", "MANAGER", "SELLER"):
                errors["role"] = ["The selected role is invalid."]
            else:
                user["role"] = role

        if "password" in data:
            password = data["password"]
            if not password or len(password) < 8:
                errors["password"] = ["The password must be at least 8 characters."]
            else:
                user["password"] = password

        if "isActive" in data or "is_active" in data:
            is_act = bool(data.get("isActive", data.get("is_active")))
            user["is_active"] = is_act
            if not is_act:
                tokens_to_delete = [t for t, u in self.tokens.items() if u["id"] == user_id]
                for t in tokens_to_delete:
                    del self.tokens[t]

        if "permission_group" in data:
            user["permission_group"] = data["permission_group"]

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Validation failed.",
                "errors": errors
            })

        user["updated_at"] = self._now_iso()
        return ApiResponse(200, {
            "success": True,
            "message": "User updated successfully.",
            "data": self._format_user(user)
        })

    def _patch_user_status(self, headers: Optional[Dict[str, str]], user_id: str, data: Dict[str, Any]) -> ApiResponse:
        auth_user, err_resp = self._require_admin_auth(headers)
        if err_resp:
            return err_resp

        user = self.users.get(user_id)
        if not user or user.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "User not found.",
                "errors": {"user": ["User does not exist or has been deleted."]}
            })

        if user.get("role") == "SUPER_ADMIN":
            return ApiResponse(403, {
                "success": False,
                "message": "Super Admin accounts cannot be deactivated.",
                "errors": {"account": ["Super Admin accounts cannot be deactivated."]}
            })

        is_active = bool(data.get("is_active", data.get("isActive", True)))
        user["is_active"] = is_active
        user["updated_at"] = self._now_iso()

        if not is_active:
            tokens_to_delete = [t for t, u in self.tokens.items() if u["id"] == user_id]
            for t in tokens_to_delete:
                del self.tokens[t]

        status_str = "activated" if is_active else "deactivated"
        return ApiResponse(200, {
            "success": True,
            "message": f"User {status_str} successfully.",
            "data": self._format_user(user)
        })

    def _delete_user(self, headers: Optional[Dict[str, str]], user_id: str) -> ApiResponse:
        auth_user, err_resp = self._require_admin_auth(headers)
        if err_resp:
            return err_resp

        user = self.users.get(user_id)
        if not user or user.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "User not found.",
                "errors": {"user": ["User does not exist or has been deleted."]}
            })

        if user.get("role") == "SUPER_ADMIN":
            return ApiResponse(403, {
                "success": False,
                "message": "Super Admin accounts cannot be deleted.",
                "errors": {"account": ["Super Admin accounts cannot be deleted."]}
            })

        now = self._now_iso()
        user["deleted_at"] = now
        tokens_to_delete = [t for t, u in self.tokens.items() if u["id"] == user_id]
        for t in tokens_to_delete:
            del self.tokens[t]

        return ApiResponse(200, {
            "success": True,
            "message": "User deleted successfully."
        })

    def _get_attributes(self) -> ApiResponse:
        data = []
        for attr in self.attributes.values():
            vals = [
                {"id": v["id"], "value_name": v["value_name"]}
                for v in self.attribute_values.values()
                if v["attribute_id"] == attr["id"] and v["is_active"]
            ]
            data.append({
                "id": attr["id"],
                "name": attr["name"],
                "is_active": attr["is_active"],
                "values": vals,
            })
        return ApiResponse(200, {"success": True, "data": data})

    def _get_sales_channels(self) -> ApiResponse:
        channels = [c for c in self.sales_channels.values() if c["is_active"]]
        return ApiResponse(200, {"success": True, "data": channels})

    def _post_product(self, payload: Dict[str, Any]) -> ApiResponse:
        # Validation
        errors: Dict[str, List[str]] = {}
        name = payload.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            errors["name"] = ["The name field is required."]
        elif len(name) > 255:
            errors["name"] = ["The name must not exceed 255 characters."]

        purchase_price = payload.get("purchase_price")
        if purchase_price is None:
            errors["purchase_price"] = ["The purchase price field is required."]
        else:
            try:
                p_price = float(purchase_price)
                if p_price < 0:
                    errors["purchase_price"] = ["The purchase price must be >= 0."]
            except (ValueError, TypeError):
                errors["purchase_price"] = ["The purchase price must be a valid number."]

        selling_price = payload.get("selling_price")
        if selling_price is None:
            errors["selling_price"] = ["The selling price field is required."]
        else:
            try:
                s_price = float(selling_price)
                if s_price < 0:
                    errors["selling_price"] = ["The selling price must be >= 0."]
            except (ValueError, TypeError):
                errors["selling_price"] = ["The selling price must be a valid number."]

        barcode = payload.get("barcode")
        if barcode:
            if not isinstance(barcode, str) or not barcode.strip():
                errors["barcode"] = ["Barcode must be a valid non-empty string."]
            else:
                # Check uniqueness across products and variants
                for p in self.products.values():
                    if p.get("deleted_at") is None and p.get("barcode") == barcode:
                        errors["barcode"] = ["The product barcode has already been taken."]
                        break

        # Check explicit variants payload duplicate SKU/barcode if provided
        custom_variants = payload.get("variants")
        if custom_variants and isinstance(custom_variants, list):
            seen_skus = set()
            seen_barcodes = set()
            for idx, cv in enumerate(custom_variants):
                c_sku = cv.get("sku")
                c_bc = cv.get("barcode")
                if c_sku:
                    if c_sku in seen_skus:
                        errors[f"variants.{idx}.sku"] = ["Duplicate SKU in request."]
                    seen_skus.add(c_sku)
                    for v in self.product_variants.values():
                        if v.get("deleted_at") is None and v.get("sku") == c_sku:
                            errors[f"variants.{idx}.sku"] = ["The variant SKU has already been taken."]
                if c_bc:
                    if c_bc in seen_barcodes:
                        errors[f"variants.{idx}.barcode"] = ["Duplicate barcode in request."]
                    seen_barcodes.add(c_bc)
                    for v in self.product_variants.values():
                        if v.get("deleted_at") is None and v.get("barcode") == c_bc:
                            errors[f"variants.{idx}.barcode"] = ["The variant barcode has already been taken."]

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Validation failed.",
                "errors": errors
            })

        now = self._now_iso()
        product_id = str(uuid.uuid4())
        default_reorder = payload.get("default_reorder_level", 5)

        product_record = {
            "id": product_id,
            "name": name.strip(),
            "barcode": barcode.strip() if barcode else None,
            "purchase_price": float(self._round_decimal(purchase_price)),
            "selling_price": float(self._round_decimal(selling_price)),
            "default_reorder_level": int(default_reorder),
            "image_url": payload.get("image_url"),
            "is_active": payload.get("is_active", True),
            "deleted_at": None,
            "created_at": now,
            "updated_at": now,
        }
        self.products[product_id] = product_record

        # Process Attributes and Variants
        attributes_spec = payload.get("attributes", [])
        created_variants = []

        if custom_variants and isinstance(custom_variants, list):
            # Custom variants specified directly
            for cv in custom_variants:
                variant_id = str(uuid.uuid4())
                sku = cv.get("sku") or f"{self._sanitize_sku_part(name)}-{str(uuid.uuid4())[:6].upper()}"
                v_bc = cv.get("barcode")
                qoh = cv.get("quantity_on_hand", 0)
                cost_override = cv.get("cost_price_override")
                sell_override = cv.get("selling_price_override")
                reorder = cv.get("reorder_level", default_reorder)

                v_rec = {
                    "id": variant_id,
                    "product_id": product_id,
                    "sku": sku,
                    "barcode": v_bc,
                    "cost_price_override": float(self._round_decimal(cost_override)) if cost_override is not None else None,
                    "selling_price_override": float(self._round_decimal(sell_override)) if sell_override is not None else None,
                    "quantity_on_hand": int(qoh),
                    "quantity_reserved": 0,
                    "reorder_level": int(reorder),
                    "is_active": True,
                    "deleted_at": None,
                    "created_at": now,
                    "updated_at": now,
                    "attribute_values": cv.get("attribute_values", [])
                }
                self.product_variants[variant_id] = v_rec
                created_variants.append(v_rec)

                if qoh > 0:
                    self.stock_movements.append({
                        "id": str(uuid.uuid4()),
                        "variant_id": variant_id,
                        "movement_type": "INITIAL",
                        "quantity_change": int(qoh),
                        "reference_id": f"INIT-{sku}",
                        "notes": "Initial stock creation",
                        "created_at": now,
                    })

        elif attributes_spec and isinstance(attributes_spec, list):
            # Dynamic Cartesian Variant Matrix Generation (VariantGeneratorService)
            attr_dim_values = []
            for attr_spec in attributes_spec:
                attr_id = attr_spec.get("attribute_id")
                val_ids = attr_spec.get("value_ids", [])
                if not attr_id or not val_ids:
                    continue

                # Record product_attributes link
                pa_id = str(uuid.uuid4())
                self.product_attributes[pa_id] = {
                    "id": pa_id,
                    "product_id": product_id,
                    "attribute_id": attr_id,
                }

                attr_name = self.attributes.get(attr_id, {}).get("name", "ATTR")
                dim_items = []
                for vid in val_ids:
                    v_record = self.attribute_values.get(vid)
                    v_name = v_record["value_name"] if v_record else "VAL"
                    dim_items.append({"attr_id": attr_id, "attr_name": attr_name, "val_id": vid, "val_name": v_name})
                attr_dim_values.append(dim_items)

            if attr_dim_values:
                combinations = list(itertools.product(*attr_dim_values))
                base_sku_prefix = self._sanitize_sku_part(name)

                for combo in combinations:
                    variant_id = str(uuid.uuid4())
                    # Deterministic SKU formatting: [PRODUCT-NAME]-[ATTR1]-[ATTR2]...
                    sku_parts = [base_sku_prefix] + [self._sanitize_sku_part(c["val_name"]) for c in combo]
                    sku = "-".join(sku_parts)

                    # Ensure unique SKU suffix if clash
                    orig_sku = sku
                    dup_count = 1
                    while any(v.get("deleted_at") is None and v.get("sku") == sku for v in self.product_variants.values()):
                        sku = f"{orig_sku}-{dup_count}"
                        dup_count += 1

                    v_rec = {
                        "id": variant_id,
                        "product_id": product_id,
                        "sku": sku,
                        "barcode": None,
                        "cost_price_override": None,
                        "selling_price_override": None,
                        "quantity_on_hand": 0,
                        "quantity_reserved": 0,
                        "reorder_level": int(default_reorder),
                        "is_active": True,
                        "deleted_at": None,
                        "created_at": now,
                        "updated_at": now,
                        "attribute_values": [
                            {"attribute": c["attr_name"], "value": c["val_name"], "attribute_value_id": c["val_id"]}
                            for c in combo
                        ]
                    }
                    self.product_variants[variant_id] = v_rec

                    # Record variant_attribute_values junction
                    for c in combo:
                        vav_id = str(uuid.uuid4())
                        self.variant_attribute_values[vav_id] = {
                            "id": vav_id,
                            "variant_id": variant_id,
                            "attribute_value_id": c["val_id"],
                        }

                    created_variants.append(v_rec)
        else:
            # Standalone single default variant
            variant_id = str(uuid.uuid4())
            sku = self._sanitize_sku_part(name)
            v_rec = {
                "id": variant_id,
                "product_id": product_id,
                "sku": sku,
                "barcode": barcode.strip() if barcode else None,
                "cost_price_override": None,
                "selling_price_override": None,
                "quantity_on_hand": 0,
                "quantity_reserved": 0,
                "reorder_level": int(default_reorder),
                "is_active": True,
                "deleted_at": None,
                "created_at": now,
                "updated_at": now,
                "attribute_values": []
            }
            self.product_variants[variant_id] = v_rec
            created_variants.append(v_rec)

        response_data = dict(product_record)
        response_data["variants"] = created_variants
        return ApiResponse(201, {"success": True, "data": response_data})

    def _get_products(self, params: Dict[str, Any]) -> ApiResponse:
        data = []
        for p in self.products.values():
            if p.get("deleted_at") is not None:
                continue
            p_copy = dict(p)
            variants = [
                dict(v) for v in self.product_variants.values()
                if v["product_id"] == p["id"] and v.get("deleted_at") is None
            ]
            p_copy["variants"] = variants
            data.append(p_copy)

        return ApiResponse(200, {
            "success": True,
            "data": data,
            "meta": {
                "current_page": 1,
                "per_page": len(data),
                "total": len(data),
                "last_page": 1
            }
        })

    def _get_product_by_id(self, prod_id: str) -> ApiResponse:
        p = self.products.get(prod_id)
        if not p or p.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "Product not found.",
                "errors": {"product": ["Product does not exist or has been deleted."]}
            })
        p_copy = dict(p)
        p_copy["variants"] = [
            dict(v) for v in self.product_variants.values()
            if v["product_id"] == prod_id and v.get("deleted_at") is None
        ]
        return ApiResponse(200, {"success": True, "data": p_copy})

    def _delete_product(self, prod_id: str) -> ApiResponse:
        p = self.products.get(prod_id)
        if not p or p.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "Product not found.",
                "errors": {"product": ["Product does not exist or has been deleted."]}
            })
        now = self._now_iso()
        p["deleted_at"] = now
        for v in self.product_variants.values():
            if v["product_id"] == prod_id and v.get("deleted_at") is None:
                v["deleted_at"] = now
        return ApiResponse(200, {"success": True, "data": {"id": prod_id, "deleted_at": now}})

    def _delete_variant(self, variant_id: str) -> ApiResponse:
        v = self.product_variants.get(variant_id)
        if not v or v.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "Variant not found.",
                "errors": {"variant": ["Variant does not exist or has been deleted."]}
            })
        now = self._now_iso()
        v["deleted_at"] = now
        return ApiResponse(200, {"success": True, "data": {"id": variant_id, "deleted_at": now}})

    def _get_inventory_scan(self, code: str) -> ApiResponse:
        """
        Two-tier resolution:
        1. Check product_variants (direct barcode or SKU match)
        2. Fall back to products (master product barcode expansion)
        """
        if not code or not isinstance(code, str) or not code.strip():
            return ApiResponse(422, {
                "success": False,
                "message": "The code query parameter is required.",
                "errors": {"code": ["The code query parameter is required."]}
            })

        query = code.strip()

        # Step 1: Direct Variant resolution (match barcode OR sku case-insensitively)
        for v in self.product_variants.values():
            if v.get("deleted_at") is not None:
                continue
            v_bc = v.get("barcode") or ""
            v_sku = v.get("sku") or ""
            if (v_bc and v_bc.lower() == query.lower()) or (v_sku and v_sku.lower() == query.lower()):
                parent_product = self.products.get(v["product_id"], {})
                selling_price = v.get("selling_price_override")
                if selling_price is None:
                    selling_price = parent_product.get("selling_price", 0.0)

                # Fetch attribute values
                attr_vals = v.get("attribute_values", [])
                if not attr_vals:
                    # Lookup via variant_attribute_values junction
                    for vav in self.variant_attribute_values.values():
                        if vav["variant_id"] == v["id"]:
                            av = self.attribute_values.get(vav["attribute_value_id"])
                            if av:
                                a = self.attributes.get(av["attribute_id"])
                                attr_vals.append({
                                    "attribute": a["name"] if a else "Attribute",
                                    "value": av["value_name"]
                                })

                return ApiResponse(200, {
                    "success": True,
                    "data": {
                        "type": "VARIANT",
                        "variant": {
                            "id": v["id"],
                            "product_id": v["product_id"],
                            "product_name": parent_product.get("name", "Unknown Product"),
                            "sku": v["sku"],
                            "barcode": v.get("barcode"),
                            "selling_price": float(self._round_decimal(selling_price)),
                            "quantity_on_hand": v["quantity_on_hand"],
                            "attribute_values": attr_vals
                        }
                    }
                })

        # Step 2: Master product barcode expansion
        for p in self.products.values():
            if p.get("deleted_at") is not None:
                continue
            p_bc = p.get("barcode") or ""
            if p_bc and p_bc.lower() == query.lower():
                child_variants = [
                    {
                        "id": v["id"],
                        "sku": v["sku"],
                        "quantity_on_hand": v["quantity_on_hand"],
                        "selling_price": float(self._round_decimal(
                            v.get("selling_price_override") if v.get("selling_price_override") is not None else p.get("selling_price", 0.0)
                        )),
                        "attribute_values": v.get("attribute_values", [])
                    }
                    for v in self.product_variants.values()
                    if v["product_id"] == p["id"] and v.get("deleted_at") is None
                ]
                return ApiResponse(200, {
                    "success": True,
                    "data": {
                        "type": "PRODUCT",
                        "product": {
                            "id": p["id"],
                            "name": p["name"],
                            "barcode": p.get("barcode"),
                            "selling_price": float(self._round_decimal(p.get("selling_price", 0.0))),
                            "variants": child_variants
                        }
                    }
                })

        # Not found
        return ApiResponse(404, {
            "success": False,
            "message": f"Barcode or SKU '{code}' not recognized.",
            "errors": {"code": [f"No product or variant found matching barcode or SKU '{code}'."]}
        })

    def _post_checkout(self, payload: Dict[str, Any]) -> ApiResponse:
        """
        Atomic, Idempotent Checkout Service:
        - DB Transaction simulation
        - Idempotency via client_mutation_id
        - Pessimistic locking check: quantity_on_hand >= quantity
        - Immutable stock_movements ledger recording
        - Customer auto-upsert & loyalty metrics update
        - Orders, OrderItems, Payments insertion
        """
        errors: Dict[str, List[str]] = {}

        mutation_id = payload.get("client_mutation_id")
        if not mutation_id or not isinstance(mutation_id, str):
            errors["client_mutation_id"] = ["The client_mutation_id field is required."]
        elif not self._is_valid_uuid(mutation_id):
            errors["client_mutation_id"] = ["The client_mutation_id must be a valid UUID."]

        # Check idempotency replay BEFORE executing any mutations
        if mutation_id and mutation_id in self.orders_by_mutation:
            existing_order_id = self.orders_by_mutation[mutation_id]
            existing_order = self.orders[existing_order_id]
            return ApiResponse(200, {"success": True, "data": self._format_order_response(existing_order)})

        channel_id = payload.get("channel_id")
        if not channel_id:
            errors["channel_id"] = ["The channel_id field is required."]
        elif not self._is_valid_uuid(channel_id):
            errors["channel_id"] = ["The channel_id must be a valid UUID."]
        elif channel_id not in self.sales_channels:
            errors["channel_id"] = ["The specified sales channel does not exist."]

        items = payload.get("items")
        if not items or not isinstance(items, list) or len(items) == 0:
            errors["items"] = ["The items array cannot be empty."]

        payment = payload.get("payment")
        if not payment or not isinstance(payment, dict):
            errors["payment"] = ["The payment details are required."]
        else:
            if not payment.get("payment_method"):
                errors["payment.payment_method"] = ["Payment method is required."]

        customer_data = payload.get("customer")
        if customer_data and isinstance(customer_data, dict):
            phone = customer_data.get("phone")
            if phone and not self._is_valid_phone(phone):
                errors["customer.phone"] = ["The customer phone number format is invalid."]

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Validation failed.",
                "errors": errors
            })

        # Validate line items and inventory stock levels atomically
        validated_items = []
        subtotal = Decimal("0.00")

        for idx, item in enumerate(items):
            var_id = item.get("variant_id")
            qty = item.get("quantity")
            u_price = item.get("unit_price")

            if not var_id or not self._is_valid_uuid(var_id):
                errors[f"items.{idx}.variant_id"] = ["Invalid variant UUID."]
                continue

            variant = self.product_variants.get(var_id)
            if not variant or variant.get("deleted_at") is not None:
                errors[f"items.{idx}.variant_id"] = ["Variant does not exist or has been deleted."]
                continue

            if qty is None or not isinstance(qty, int) or qty <= 0:
                errors[f"items.{idx}.quantity"] = ["Quantity must be an integer greater than 0."]
                continue

            # Pessimistic lock check: CHECK (quantity_on_hand >= 0)
            if variant["quantity_on_hand"] < qty:
                errors[f"items.{idx}.quantity"] = [
                    f"Insufficient stock for variant {variant['sku']}. Available: {variant['quantity_on_hand']}, requested: {qty}."
                ]
                continue

            # Unit price resolution: override or explicit or product base
            if u_price is not None:
                try:
                    price_dec = self._round_decimal(u_price)
                    if price_dec < 0:
                        errors[f"items.{idx}.unit_price"] = ["Unit price cannot be negative."]
                        continue
                except Exception:
                    errors[f"items.{idx}.unit_price"] = ["Invalid unit price."]
                    continue
            else:
                price_override = variant.get("selling_price_override")
                if price_override is not None:
                    price_dec = self._round_decimal(price_override)
                else:
                    p = self.products.get(variant["product_id"], {})
                    price_dec = self._round_decimal(p.get("selling_price", 0.0))

            line_total = price_dec * Decimal(str(qty))
            subtotal += line_total
            validated_items.append({
                "variant": variant,
                "quantity": qty,
                "unit_price": price_dec,
                "total_price": line_total,
            })

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Checkout stock validation failed.",
                "errors": errors
            })

        # Calculate Financials
        discount = self._round_decimal(payload.get("discount", 0.0))
        delivery_cost = self._round_decimal(payload.get("delivery_cost", 0.0))

        if discount < 0:
            return ApiResponse(422, {
                "success": False,
                "message": "Discount cannot be negative.",
                "errors": {"discount": ["Discount must be >= 0."]}
            })
        if delivery_cost < 0:
            return ApiResponse(422, {
                "success": False,
                "message": "Delivery cost cannot be negative.",
                "errors": {"delivery_cost": ["Delivery cost must be >= 0."]}
            })

        # Total amount = max(0, subtotal - discount) + delivery_cost
        net_goods = max(Decimal("0.00"), subtotal - discount)
        total_amount = net_goods + delivery_cost

        # Atomic Execution
        now = self._now_iso()
        order_id = str(uuid.uuid4())
        order_number = f"ORD-{datetime.datetime.now().strftime('%Y%m%d')}-{self.order_sequence:04d}"
        self.order_sequence += 1

        # Decrement stock and log immutable stock movements
        total_units_sold = 0
        for v_item in validated_items:
            variant = v_item["variant"]
            qty = v_item["quantity"]
            variant["quantity_on_hand"] -= qty
            total_units_sold += qty

            self.stock_movements.append({
                "id": str(uuid.uuid4()),
                "variant_id": variant["id"],
                "movement_type": "SALE",
                "quantity_change": -qty,
                "reference_id": order_number,
                "notes": f"Sold in order {order_number}",
                "created_at": now,
            })

            # Record Order Item
            item_id = str(uuid.uuid4())
            self.order_items.append({
                "id": item_id,
                "order_id": order_id,
                "variant_id": variant["id"],
                "sku": variant["sku"],
                "quantity": qty,
                "unit_price": float(v_item["unit_price"]),
                "total_price": float(v_item["total_price"]),
                "created_at": now,
                "updated_at": now,
            })

        # Customer Loyalty Auto-Upsert
        customer_id = None
        if customer_data and isinstance(customer_data, dict):
            phone = customer_data.get("phone", "").strip()
            if phone:
                # Find existing customer by phone
                matched_cust = None
                for c in self.customers.values():
                    if c.get("deleted_at") is None and c.get("phone") == phone:
                        matched_cust = c
                        break

                if matched_cust:
                    customer_id = matched_cust["id"]
                    matched_cust["total_purchased"] += total_units_sold
                    matched_cust["total_spent"] = float(self._round_decimal(Decimal(str(matched_cust["total_spent"])) + total_amount))
                    matched_cust["last_purchase_at"] = now
                    if customer_data.get("name"):
                        matched_cust["name"] = customer_data["name"]
                    if customer_data.get("address"):
                        matched_cust["address"] = customer_data["address"]
                    matched_cust["updated_at"] = now
                else:
                    customer_id = str(uuid.uuid4())
                    self.customers[customer_id] = {
                        "id": customer_id,
                        "name": customer_data.get("name", "Valued Customer"),
                        "phone": phone,
                        "address": customer_data.get("address", ""),
                        "total_purchased": total_units_sold,
                        "total_spent": float(total_amount),
                        "last_purchase_at": now,
                        "deleted_at": None,
                        "created_at": now,
                        "updated_at": now,
                    }

        # Record Order
        order_record = {
            "id": order_id,
            "order_number": order_number,
            "client_mutation_id": mutation_id,
            "customer_id": customer_id,
            "channel_id": channel_id,
            "status": "COMPLETED",
            "subtotal": float(subtotal),
            "discount": float(discount),
            "delivery_cost": float(delivery_cost),
            "total_amount": float(total_amount),
            "delivery_address": payload.get("delivery_address"),
            "region": payload.get("region"),
            "created_by": payload.get("created_by"),
            "note": payload.get("note"),
            "created_at": now,
            "updated_at": now,
        }
        self.orders[order_id] = order_record
        self.orders_by_mutation[mutation_id] = order_id
        self.orders_by_number[order_number] = order_id

        # Record Payment
        pm_amount = payment.get("amount", float(total_amount))
        payment_id = str(uuid.uuid4())
        self.payments.append({
            "id": payment_id,
            "order_id": order_id,
            "payment_method": payment.get("payment_method"),
            "amount": float(self._round_decimal(pm_amount)),
            "transaction_ref": payment.get("transaction_ref"),
            "proof_image_url": payment.get("proof_image_url"),
            "created_at": now,
            "updated_at": now,
        })

        return ApiResponse(201, {"success": True, "data": self._format_order_response(order_record)})

    def _format_order_response(self, order: Dict[str, Any]) -> Dict[str, Any]:
        order_id = order["id"]
        items = [i for i in self.order_items if i["order_id"] == order_id]
        pmts = [p for p in self.payments if p["order_id"] == order_id]
        cust = self.customers.get(order["customer_id"]) if order["customer_id"] else None

        res = dict(order)
        res["customer"] = dict(cust) if cust else None
        res["items"] = items
        res["payments"] = pmts
        return res

    def _get_orders(self, params: Dict[str, Any]) -> ApiResponse:
        orders_list = []
        channel_filter = params.get("channel_id")
        for o in self.orders.values():
            if channel_filter and o["channel_id"] != channel_filter:
                continue
            orders_list.append(self._format_order_response(o))

        return ApiResponse(200, {
            "success": True,
            "data": orders_list,
            "meta": {
                "current_page": 1,
                "per_page": len(orders_list),
                "total": len(orders_list),
                "last_page": 1
            }
        })

    def _get_order_by_id(self, order_id: str) -> ApiResponse:
        order = self.orders.get(order_id)
        if not order:
            # Check by order_number
            if order_id in self.orders_by_number:
                order = self.orders[self.orders_by_number[order_id]]

        if not order:
            return ApiResponse(404, {
                "success": False,
                "message": "Order not found.",
                "errors": {"order": ["Order does not exist."]}
            })
        return ApiResponse(200, {"success": True, "data": self._format_order_response(order)})

    def _post_restock(self, payload: Dict[str, Any]) -> ApiResponse:
        """
        Restock session management:
        - Accepts session details with list of restock items (variant_id, quantity, unit_cost)
        - Can create in DRAFT or directly COMPLETED
        - Increments variant quantity_on_hand and logs immutable stock_movements ledger with 'RESTOCK'
        """
        errors: Dict[str, List[str]] = {}
        items = payload.get("items", [])
        if not items or not isinstance(items, list):
            errors["items"] = ["Restock items list cannot be empty."]

        status = payload.get("status", "COMPLETED").upper()
        if status not in ("DRAFT", "COMPLETED"):
            errors["status"] = ["Invalid status. Must be DRAFT or COMPLETED."]

        validated_items = []
        for idx, itm in enumerate(items):
            vid = itm.get("variant_id")
            qty = itm.get("quantity")
            cost = itm.get("unit_cost", 0.0)

            if not vid or not self._is_valid_uuid(vid):
                errors[f"items.{idx}.variant_id"] = ["Invalid variant UUID."]
                continue
            var = self.product_variants.get(vid)
            if not var or var.get("deleted_at") is not None:
                errors[f"items.{idx}.variant_id"] = ["Variant does not exist."]
                continue
            if qty is None or not isinstance(qty, int) or qty <= 0:
                errors[f"items.{idx}.quantity"] = ["Quantity must be an integer > 0."]
                continue
            try:
                cost_dec = self._round_decimal(cost)
                if cost_dec < 0:
                    errors[f"items.{idx}.unit_cost"] = ["Unit cost must be >= 0."]
                    continue
            except Exception:
                errors[f"items.{idx}.unit_cost"] = ["Invalid unit cost format."]
                continue

            validated_items.append({
                "variant": var,
                "quantity": qty,
                "unit_cost": float(cost_dec),
                "scanned_barcode": itm.get("scanned_barcode")
            })

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Restock validation failed.",
                "errors": errors
            })

        now = self._now_iso()
        session_id = str(uuid.uuid4())
        session_rec = {
            "id": session_id,
            "session_date": payload.get("session_date", now),
            "status": status,
            "created_by": payload.get("created_by"),
            "notes": payload.get("notes"),
            "created_at": now,
            "updated_at": now,
            "details": []
        }

        for v_itm in validated_items:
            detail_id = str(uuid.uuid4())
            var = v_itm["variant"]
            qty = v_itm["quantity"]

            detail_rec = {
                "id": detail_id,
                "restock_session_id": session_id,
                "variant_id": var["id"],
                "scanned_barcode": v_itm["scanned_barcode"],
                "quantity": qty,
                "unit_cost": v_itm["unit_cost"],
                "created_at": now,
                "updated_at": now,
            }
            self.restock_details.append(detail_rec)
            session_rec["details"].append(detail_rec)

            if status == "COMPLETED":
                var["quantity_on_hand"] += qty
                self.stock_movements.append({
                    "id": str(uuid.uuid4()),
                    "variant_id": var["id"],
                    "movement_type": "RESTOCK",
                    "quantity_change": qty,
                    "reference_id": session_id,
                    "notes": f"Restock session {session_id}",
                    "created_at": now,
                })

        self.restock_sessions[session_id] = session_rec
        return ApiResponse(201, {"success": True, "data": session_rec})

    def _complete_restock_session(self, session_id: str) -> ApiResponse:
        session = self.restock_sessions.get(session_id)
        if not session:
            return ApiResponse(404, {
                "success": False,
                "message": "Restock session not found.",
                "errors": {"session": ["Restock session does not exist."]}
            })

        if session["status"] == "COMPLETED":
            return ApiResponse(422, {
                "success": False,
                "message": "Restock session is already completed.",
                "errors": {"status": ["Cannot complete an already completed restock session."]}
            })

        if session["status"] == "CANCELLED":
            return ApiResponse(422, {
                "success": False,
                "message": "Cannot complete a cancelled restock session.",
                "errors": {"status": ["Cancelled restock sessions cannot be transitioned to completed."]}
            })

        now = self._now_iso()
        session["status"] = "COMPLETED"
        session["updated_at"] = now

        # Increment inventory and record stock movements
        for detail in self.restock_details:
            if detail["restock_session_id"] == session_id:
                var = self.product_variants.get(detail["variant_id"])
                if var:
                    var["quantity_on_hand"] += detail["quantity"]
                    self.stock_movements.append({
                        "id": str(uuid.uuid4()),
                        "variant_id": var["id"],
                        "movement_type": "RESTOCK",
                        "quantity_change": detail["quantity"],
                        "reference_id": session_id,
                        "notes": f"Restock session completed {session_id}",
                        "created_at": now,
                    })

        return ApiResponse(200, {"success": True, "data": session})

    def _cancel_restock_session(self, session_id: str) -> ApiResponse:
        session = self.restock_sessions.get(session_id)
        if not session:
            return ApiResponse(404, {
                "success": False,
                "message": "Restock session not found.",
                "errors": {"session": ["Restock session does not exist."]}
            })

        if session["status"] == "COMPLETED":
            return ApiResponse(422, {
                "success": False,
                "message": "Cannot cancel an already completed restock session.",
                "errors": {"status": ["Completed restock sessions cannot be cancelled."]}
            })

        now = self._now_iso()
        session["status"] = "CANCELLED"
        session["updated_at"] = now
        return ApiResponse(200, {"success": True, "data": session})

    def _get_restock_sessions(self) -> ApiResponse:
        sessions = list(self.restock_sessions.values())
        return ApiResponse(200, {"success": True, "data": sessions})

    def _get_customers(self, params: Dict[str, Any]) -> ApiResponse:
        data = [c for c in self.customers.values() if c.get("deleted_at") is None]
        return ApiResponse(200, {
            "success": True,
            "data": data,
            "meta": {
                "current_page": 1,
                "per_page": len(data),
                "total": len(data),
                "last_page": 1
            }
        })

    def _get_customer_by_id(self, cust_id: str) -> ApiResponse:
        c = self.customers.get(cust_id)
        if not c or c.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "Customer not found.",
                "errors": {"customer": ["Customer does not exist or has been deleted."]}
            })
        return ApiResponse(200, {"success": True, "data": c})

    def _delete_customer(self, cust_id: str) -> ApiResponse:
        c = self.customers.get(cust_id)
        if not c or c.get("deleted_at") is not None:
            return ApiResponse(404, {
                "success": False,
                "message": "Customer not found.",
                "errors": {"customer": ["Customer does not exist or has been deleted."]}
            })
        now = self._now_iso()
        c["deleted_at"] = now
        return ApiResponse(200, {"success": True, "data": {"id": cust_id, "deleted_at": now}})

    def _post_expense(self, payload: Dict[str, Any]) -> ApiResponse:
        errors: Dict[str, List[str]] = {}
        category = payload.get("category")
        if not category or not isinstance(category, str):
            errors["category"] = ["Category is required."]

        amount = payload.get("amount")
        if amount is None:
            errors["amount"] = ["Amount is required."]
        else:
            try:
                amt_dec = self._round_decimal(amount)
                if amt_dec <= 0:
                    errors["amount"] = ["Amount must be greater than 0."]
            except Exception:
                errors["amount"] = ["Invalid amount."]

        payment_method = payload.get("payment_method")
        if not payment_method or not isinstance(payment_method, str):
            errors["payment_method"] = ["Payment method is required."]

        if errors:
            return ApiResponse(422, {
                "success": False,
                "message": "Expense validation failed.",
                "errors": errors
            })

        now = self._now_iso()
        exp_id = str(uuid.uuid4())
        exp_record = {
            "id": exp_id,
            "expense_date": payload.get("expense_date", datetime.date.today().isoformat()),
            "category": category.strip(),
            "amount": float(self._round_decimal(amount)),
            "payment_method": payment_method.strip(),
            "notes": payload.get("notes"),
            "created_at": now,
            "updated_at": now,
        }
        self.expenses.append(exp_record)
        return ApiResponse(201, {"success": True, "data": exp_record})

    def _get_expenses(self, params: Dict[str, Any]) -> ApiResponse:
        filtered = list(self.expenses)
        from_date = params.get("from_date")
        to_date = params.get("to_date")
        category = params.get("category")

        if from_date:
            filtered = [e for e in filtered if e["expense_date"] >= from_date]
        if to_date:
            filtered = [e for e in filtered if e["expense_date"] <= to_date]
        if category:
            filtered = [e for e in filtered if e["category"].lower() == category.lower()]

        return ApiResponse(200, {
            "success": True,
            "data": filtered,
            "meta": {
                "total_records": len(filtered),
                "total_amount": sum(e["amount"] for e in filtered)
            }
        })

    def _get_stock_movements(self, params: Dict[str, Any]) -> ApiResponse:
        filtered = list(self.stock_movements)
        variant_id = params.get("variant_id")
        ref_id = params.get("reference_id")
        m_type = params.get("movement_type")

        if variant_id:
            filtered = [m for m in filtered if m["variant_id"] == variant_id]
        if ref_id:
            filtered = [m for m in filtered if m["reference_id"] == ref_id]
        if m_type:
            filtered = [m for m in filtered if m["movement_type"] == m_type]

        return ApiResponse(200, {"success": True, "data": filtered})


class ApiClient:
    """
    HTTP REST Client that connects to live Laravel server or falls back to
    SimulatedApiEngine for offline/hermetic test execution.
    """

    def __init__(self, base_url: Optional[str] = None, mode: Optional[str] = None):
        self.base_url = base_url or os.environ.get("API_BASE_URL", "http://localhost:8000/api/v1")
        self.engine = SimulatedApiEngine()
        self.mode = mode or os.environ.get("TEST_API_MODE", "auto")
        self._live_available: Optional[bool] = None
        self.token: Optional[str] = None

    def set_token(self, token: Optional[str]):
        """Set the active Bearer token for subsequent requests."""
        self.token = token

    def clear_token(self):
        """Clear the active Bearer token."""
        self.token = None

    def _is_live_server_reachable(self) -> bool:
        if self.mode == "simulated":
            return False
        if self.mode == "live":
            return True
        if self._live_available is not None:
            return self._live_available

        try:
            import requests
            resp = requests.get(f"{self.base_url}/sales-channels", timeout=0.8)
            self._live_available = resp.status_code in (200, 401, 403, 404)
        except Exception:
            self._live_available = False
        return self._live_available

    def request(self, method: str, path: str, params: Optional[Dict] = None, json_data: Optional[Dict] = None, headers: Optional[Dict] = None) -> ApiResponse:
        req_headers = dict(headers) if headers else {}
        if self.token and not any(k.lower() == "authorization" for k in req_headers):
            req_headers["Authorization"] = f"Bearer {self.token}"

        # Check if live server is configured and reachable
        if self._is_live_server_reachable():
            try:
                import requests
                url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
                full_headers = {"Accept": "application/json", "Content-Type": "application/json"}
                full_headers.update(req_headers)
                resp = requests.request(method=method, url=url, params=params, json=json_data, headers=full_headers, timeout=10)
                try:
                    data = resp.json()
                except Exception:
                    data = {"success": resp.status_code < 400, "data": resp.text}
                return ApiResponse(resp.status_code, data, resp.text)
            except Exception as ex:
                if self.mode == "live":
                    return ApiResponse(500, {"success": False, "message": f"Network Error: {str(ex)}", "errors": {"network": [str(ex)]}})

        # Fallback to simulated engine
        return self.engine.handle_request(method, path, params, json_data, headers=req_headers)

    def get(self, path: str, params: Optional[Dict] = None, headers: Optional[Dict] = None) -> ApiResponse:
        return self.request("GET", path, params=params, headers=headers)

    def post(self, path: str, json_data: Optional[Dict] = None, headers: Optional[Dict] = None) -> ApiResponse:
        return self.request("POST", path, json_data=json_data, headers=headers)

    def put(self, path: str, json_data: Optional[Dict] = None, headers: Optional[Dict] = None) -> ApiResponse:
        return self.request("PUT", path, json_data=json_data, headers=headers)

    def patch(self, path: str, json_data: Optional[Dict] = None, headers: Optional[Dict] = None) -> ApiResponse:
        return self.request("PATCH", path, json_data=json_data, headers=headers)

    def delete(self, path: str, headers: Optional[Dict] = None) -> ApiResponse:
        return self.request("DELETE", path, headers=headers)

    # Auth helpers
    def login(self, email: str, password: str, device_name: str = "e2e_runner") -> ApiResponse:
        resp = self.post("/auth/login", json_data={"email": email, "password": password, "device_name": device_name})
        if resp.is_success and isinstance(resp.data, dict) and "token" in resp.data:
            self.set_token(resp.data["token"])
        return resp

    def logout(self, all_devices: bool = False) -> ApiResponse:
        resp = self.post("/auth/logout", json_data={"all_devices": all_devices})
        self.clear_token()
        return resp

    def get_me(self, headers: Optional[Dict] = None) -> ApiResponse:
        return self.get("/auth/me", headers=headers)

    def change_password(self, current_password: str, new_password: str) -> ApiResponse:
        return self.patch("/auth/password", json_data={"current_password": current_password, "new_password": new_password})

    # User / Staff management helpers
    def list_users(self, headers: Optional[Dict] = None) -> ApiResponse:
        return self.get("/users", headers=headers)

    def get_user(self, user_id: str, headers: Optional[Dict] = None) -> ApiResponse:
        return self.get(f"/users/{user_id}", headers=headers)

    def create_user(self, payload: Dict[str, Any], headers: Optional[Dict] = None) -> ApiResponse:
        return self.post("/users", json_data=payload, headers=headers)

    def update_user(self, user_id: str, payload: Dict[str, Any], headers: Optional[Dict] = None) -> ApiResponse:
        return self.patch(f"/users/{user_id}", json_data=payload, headers=headers)

    def update_user_status(self, user_id: str, is_active: bool, headers: Optional[Dict] = None) -> ApiResponse:
        return self.patch(f"/users/{user_id}/status", json_data={"is_active": is_active}, headers=headers)

    def delete_user(self, user_id: str, headers: Optional[Dict] = None) -> ApiResponse:
        return self.delete(f"/users/{user_id}", headers=headers)

    # High-level domain helpers
    def scan_barcode(self, code: str) -> ApiResponse:
        return self.get("/inventory/scan", params={"code": code})

    def checkout(self, payload: Dict[str, Any]) -> ApiResponse:
        return self.post("/orders/checkout", json_data=payload)

    def create_product(self, payload: Dict[str, Any]) -> ApiResponse:
        return self.post("/products", json_data=payload)

    def restock(self, payload: Dict[str, Any]) -> ApiResponse:
        return self.post("/inventory/restock", json_data=payload)

    def create_expense(self, payload: Dict[str, Any]) -> ApiResponse:
        return self.post("/expenses", json_data=payload)

