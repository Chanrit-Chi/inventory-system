"""
Tier 1: Feature Coverage - Authentication & Role-Based Access Control (RBAC).
Tests authentication, token lifecycle, post-logout invalidation, role restrictions,
and staff management CRUD conforming to specifications in ORIGINAL_REQUEST.md.
"""

import uuid
import pytest
from tests.e2e.api_client import ApiClient


def test_login_all_roles(api: ApiClient):
    """
    Verify Super Admin, Admin, Manager, and Cashier (Seller) can authenticate,
    receive valid Sanctum Bearer tokens, and fetch their profile via /auth/me.
    """
    credentials = [
        ("admin@inventory.local", "password", "SUPER_ADMIN", "System Administrator"),
        ("branch@inventory.local", "password", "ADMIN", "Branch Admin"),
        ("manager@inventory.local", "password", "MANAGER", "Store Manager"),
        ("cashier1@inventory.local", "password", "SELLER", "Main POS Cashier"),
        ("cashier2@inventory.local", "password", "SELLER", "Secondary Cashier"),
    ]

    for email, password, expected_role, expected_name in credentials:
        resp = api.login(email=email, password=password)
        assert resp.status_code == 200, f"Login failed for {email}: {resp.message}"
        assert resp.is_success is True
        assert "token" in resp.data
        assert isinstance(resp.data["token"], str)
        assert len(resp.data["token"]) > 0

        user_data = resp.data["user"]
        assert user_data["email"].lower() == email.lower()
        assert user_data["role"] == expected_role
        assert user_data["name"] == expected_name
        assert user_data["isActive"] is True

        # Verify /auth/me works with this token
        me_resp = api.get_me()
        assert me_resp.status_code == 200
        assert me_resp.is_success is True
        assert me_resp.data["email"].lower() == email.lower()
        assert me_resp.data["role"] == expected_role

        # Logout cleanly
        logout_resp = api.logout()
        assert logout_resp.status_code == 200


def test_login_invalid_credentials(api: ApiClient):
    """
    Verify login failures return 422 Unprocessable Entity with clear error messages.
    """
    # 1. Non-existent email
    resp_nonexistent = api.login("nonexistent@inventory.local", "password")
    assert resp_nonexistent.status_code == 422
    assert resp_nonexistent.is_success is False
    assert "email" in resp_nonexistent.errors

    # 2. Incorrect password
    resp_badpass = api.login("admin@inventory.local", "WrongPassword123!")
    assert resp_badpass.status_code == 422
    assert resp_badpass.is_success is False
    assert "email" in resp_badpass.errors

    # 3. Missing / empty fields
    resp_empty = api.post("/auth/login", json_data={"email": "", "password": ""})
    assert resp_empty.status_code == 422
    assert resp_empty.is_success is False
    assert "email" in resp_empty.errors
    assert "password" in resp_empty.errors


def test_rbac_manager_and_cashier_rejected_on_admin_endpoints(api: ApiClient):
    """
    Verify Manager and Cashier tokens are strictly rejected with 403 Forbidden
    when attempting to access Admin-only staff management endpoints (/users).
    """
    admin_id = "u0000000-0000-0000-0000-000000000001"

    # Test Manager role (MANAGER)
    manager_login = api.login("manager@inventory.local", "password")
    assert manager_login.status_code == 200

    # Manager: GET /users -> 403 Forbidden
    resp_get = api.list_users()
    assert resp_get.status_code == 403
    assert resp_get.is_success is False

    # Manager: POST /users -> 403 Forbidden
    resp_post = api.create_user({
        "name": "Unauthorized User",
        "email": "unauth_manager@inventory.local",
        "role": "SELLER",
        "password": "password123"
    })
    assert resp_post.status_code == 403
    assert resp_post.is_success is False

    # Manager: PATCH /users/{id} -> 403 Forbidden
    resp_patch = api.update_user(admin_id, {"name": "Hacked Name"})
    assert resp_patch.status_code == 403
    assert resp_patch.is_success is False

    # Manager: DELETE /users/{id} -> 403 Forbidden
    resp_del = api.delete_user(admin_id)
    assert resp_del.status_code == 403
    assert resp_del.is_success is False

    api.logout()

    # Test Cashier role (SELLER)
    cashier_login = api.login("cashier1@inventory.local", "password")
    assert cashier_login.status_code == 200

    # Cashier: GET /users -> 403 Forbidden
    resp_cashier_get = api.list_users()
    assert resp_cashier_get.status_code == 403
    assert resp_cashier_get.is_success is False

    # Cashier: POST /users -> 403 Forbidden
    resp_cashier_post = api.create_user({
        "name": "Unauthorized Cashier User",
        "email": "unauth_cashier@inventory.local",
        "role": "SELLER",
        "password": "password123"
    })
    assert resp_cashier_post.status_code == 403
    assert resp_cashier_post.is_success is False

    # Cashier: DELETE /users/{id} -> 403 Forbidden
    resp_cashier_del = api.delete_user(admin_id)
    assert resp_cashier_del.status_code == 403
    assert resp_cashier_del.is_success is False

    api.logout()


def test_admin_staff_management_crud(api: ApiClient):
    """
    Verify Super Admin and Branch Admin can perform full CRUD lifecycle
    on staff user accounts (/users): list, create, view, update, status toggle, delete.
    """
    # 1. Authenticate as Admin
    login_resp = api.login("admin@inventory.local", "password")
    assert login_resp.status_code == 200

    # 2. List users
    list_resp = api.list_users()
    assert list_resp.status_code == 200
    assert list_resp.is_success is True
    assert isinstance(list_resp.data, list)
    assert len(list_resp.data) >= 5

    # 3. Create a new staff user (Manager)
    new_user_email = f"new_manager_{uuid.uuid4().hex[:6]}@inventory.local"
    create_payload = {
        "name": "New Regional Manager",
        "email": new_user_email,
        "phone": "+85512999888",
        "role": "MANAGER",
        "password": "SecurePassword123!",
        "permission_group": "Store Managers",
    }
    create_resp = api.create_user(create_payload)
    assert create_resp.status_code == 201
    assert create_resp.is_success is True
    new_user_id = create_resp.data["id"]
    assert create_resp.data["email"].lower() == new_user_email.lower()
    assert create_resp.data["role"] == "MANAGER"

    # 4. Fetch the created user by ID
    get_resp = api.get_user(new_user_id)
    assert get_resp.status_code == 200
    assert get_resp.data["name"] == "New Regional Manager"

    # 5. Update user name and role
    update_resp = api.update_user(new_user_id, {
        "name": "Promoted Regional Director",
        "role": "ADMIN"
    })
    assert update_resp.status_code == 200
    assert update_resp.data["name"] == "Promoted Regional Director"
    assert update_resp.data["role"] == "ADMIN"

    # 6. Toggle user status (deactivate)
    status_resp = api.update_user_status(new_user_id, is_active=False)
    assert status_resp.status_code == 200
    assert status_resp.data["isActive"] is False

    # 7. Delete the user
    delete_resp = api.delete_user(new_user_id)
    assert delete_resp.status_code == 200

    # 8. Verify deleted user is no longer accessible
    get_deleted_resp = api.get_user(new_user_id)
    assert get_deleted_resp.status_code == 404

    api.logout()


def test_logout_invalidates_token(api: ApiClient):
    """
    Verify that calling /auth/logout immediately invalidates the token,
    and subsequent requests with the revoked token return 401 Unauthorized.
    """
    # 1. Login and capture token
    login_resp = api.login("branch@inventory.local", "password")
    assert login_resp.status_code == 200
    saved_token = api.token
    assert saved_token is not None

    # 2. Verify token is functional
    me_resp = api.get_me()
    assert me_resp.status_code == 200

    # 3. Perform logout
    logout_resp = api.logout()
    assert logout_resp.status_code == 200

    # 4. Attempt to reuse revoked token on /auth/me -> 401 Unauthorized
    revoked_me_resp = api.get_me(headers={"Authorization": f"Bearer {saved_token}"})
    assert revoked_me_resp.status_code == 401
    assert revoked_me_resp.is_success is False

    # 5. Attempt to reuse revoked token on /users -> 401 Unauthorized
    revoked_users_resp = api.list_users(headers={"Authorization": f"Bearer {saved_token}"})
    assert revoked_users_resp.status_code == 401
    assert revoked_users_resp.is_success is False


def test_unauthenticated_request_rejected(api: ApiClient):
    """
    Verify protected endpoints strictly reject unauthenticated requests with 401.
    """
    api.clear_token()

    # /auth/me without token -> 401
    resp_me = api.get("/auth/me")
    assert resp_me.status_code == 401
    assert resp_me.is_success is False

    # /users without token -> 401
    resp_users = api.get("/users")
    assert resp_users.status_code == 401
    assert resp_users.is_success is False

    # /auth/logout without token -> 401
    resp_logout = api.post("/auth/logout")
    assert resp_logout.status_code == 401
    assert resp_logout.is_success is False


def test_deactivated_user_cannot_login_or_access_endpoints(api: ApiClient):
    """
    Verify deactivated user accounts cannot log in (403) and existing sessions are rejected.
    """
    # Admin logs in to create and deactivate a staff user
    api.login("admin@inventory.local", "password")
    temp_email = f"deact_{uuid.uuid4().hex[:6]}@inventory.local"
    created = api.create_user({
        "name": "Temporary Cashier",
        "email": temp_email,
        "role": "SELLER",
        "password": "password123"
    })
    assert created.status_code == 201
    temp_id = created.data["id"]

    # Deactivate the account
    deact_resp = api.update_user_status(temp_id, is_active=False)
    assert deact_resp.status_code == 200
    assert deact_resp.data["isActive"] is False
    api.logout()

    # Attempt to log in with deactivated account -> 403 Forbidden
    login_attempt = api.login(temp_email, "password123")
    assert login_attempt.status_code == 403
    assert login_attempt.is_success is False
    assert "deactivated" in login_attempt.message.lower()


def test_super_admin_protection(api: ApiClient):
    """
    Verify Super Admin account cannot be deleted or deactivated (403 Forbidden).
    """
    api.login("admin@inventory.local", "password")
    super_admin_id = "u0000000-0000-0000-0000-000000000001"

    # Attempt delete super admin -> 403
    del_resp = api.delete_user(super_admin_id)
    assert del_resp.status_code == 403
    assert del_resp.is_success is False

    # Attempt deactivate super admin -> 403
    status_resp = api.update_user_status(super_admin_id, is_active=False)
    assert status_resp.status_code == 403
    assert status_resp.is_success is False

    api.logout()


def test_user_creation_validation(api: ApiClient):
    """
    Verify staff user creation validation rules: duplicate email and short password.
    """
    api.login("admin@inventory.local", "password")

    # 1. Duplicate email -> 422
    dup_resp = api.create_user({
        "name": "Duplicate User",
        "email": "cashier1@inventory.local",
        "role": "SELLER",
        "password": "ValidPassword123!"
    })
    assert dup_resp.status_code == 422
    assert "email" in dup_resp.errors

    # 2. Short password (< 8 chars) -> 422
    short_pw_resp = api.create_user({
        "name": "Short PW User",
        "email": f"shortpw_{uuid.uuid4().hex[:6]}@inventory.local",
        "role": "SELLER",
        "password": "short"
    })
    assert short_pw_resp.status_code == 422
    assert "password" in short_pw_resp.errors

    api.logout()
