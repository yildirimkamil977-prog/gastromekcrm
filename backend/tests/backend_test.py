"""
ArıCRM backend API tests (pytest).
Covers: auth, users RBAC, customers CRUD, products sync/search,
quotes CRUD/stats/revise/email-error, settings sanitization.
"""
import base64
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crm-quote-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@arigastro.com"
ADMIN_PASSWORD = "admin123"

TEST_PREFIX = "TEST_"


# ---------------------------- fixtures ----------------------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data["user"]["role"] == "admin"
    # cookies
    assert "access_token" in s.cookies
    return s


@pytest.fixture(scope="session")
def sales_user(admin_session):
    """Create a sales user for RBAC tests."""
    email = f"{TEST_PREFIX}sales_{uuid.uuid4().hex[:6]}@arigastro.com"
    password = "Sales123!"
    r = admin_session.post(f"{API}/users", json={
        "email": email, "name": "TEST Sales", "role": "sales", "password": password
    }, timeout=30)
    assert r.status_code == 200, r.text
    u = r.json()
    yield {"id": u["id"], "email": email, "password": password}
    admin_session.delete(f"{API}/users/{u['id']}", timeout=15)


@pytest.fixture(scope="session")
def sales_session(sales_user):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": sales_user["email"], "password": sales_user["password"]}, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="session")
def test_customer(admin_session):
    payload = {
        "company_name": f"{TEST_PREFIX}Acme Gıda",
        "tax_number": "1234567890",
        "tax_office": "Kadikoy",
        "contact_person": "Ali Veli",
        "phone": "+905551112233",
        "whatsapp": "+905551112233",
        "email": "acme@arigastro.com",
        "address": "Istanbul",
        "city": "Istanbul",
        "notes": "test",
    }
    r = admin_session.post(f"{API}/customers", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    c = r.json()
    yield c
    admin_session.delete(f"{API}/customers/{c['id']}", timeout=15)


# ---------------------------- AUTH ----------------------------
class TestAuth:
    def test_login_success_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert "password_hash" not in data["user"]
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_cookie(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_returns_user(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"


# ---------------------------- USERS RBAC ----------------------------
class TestUsers:
    def test_admin_can_list_users(self, admin_session):
        r = admin_session.get(f"{API}/users", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1
        assert all("password_hash" not in u for u in arr)

    def test_sales_cannot_list_users(self, sales_session):
        r = sales_session.get(f"{API}/users", timeout=15)
        assert r.status_code == 403

    def test_sales_cannot_create_user(self, sales_session):
        r = sales_session.post(f"{API}/users", json={
            "email": f"{TEST_PREFIX}x@arigastro.com", "name": "x", "role": "sales", "password": "X12345678"
        }, timeout=15)
        assert r.status_code == 403

    def test_admin_crud_user_lifecycle(self, admin_session):
        email = f"{TEST_PREFIX}crud_{uuid.uuid4().hex[:6]}@arigastro.com"
        r = admin_session.post(f"{API}/users", json={
            "email": email, "name": "CRUD", "role": "sales", "password": "pass12345"
        }, timeout=15)
        assert r.status_code == 200
        uid_ = r.json()["id"]
        # update
        r = admin_session.put(f"{API}/users/{uid_}", json={"name": "CRUD2"}, timeout=15)
        assert r.status_code == 200 and r.json()["name"] == "CRUD2"
        # delete
        r = admin_session.delete(f"{API}/users/{uid_}", timeout=15)
        assert r.status_code == 200


# ---------------------------- CUSTOMERS ----------------------------
class TestCustomers:
    def test_list_customers(self, admin_session, test_customer):
        r = admin_session.get(f"{API}/customers", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert any(c["id"] == test_customer["id"] for c in arr)

    def test_search_filter(self, admin_session, test_customer):
        r = admin_session.get(f"{API}/customers", params={"search": "Acme"}, timeout=15)
        assert r.status_code == 200
        assert any(c["id"] == test_customer["id"] for c in r.json())

    def test_update_customer(self, admin_session, test_customer):
        payload = dict(test_customer)
        payload["notes"] = "updated"
        for k in ("id", "created_at", "updated_at"):
            payload.pop(k, None)
        r = admin_session.put(f"{API}/customers/{test_customer['id']}", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["notes"] == "updated"
        # verify persisted
        r2 = admin_session.get(f"{API}/customers/{test_customer['id']}", timeout=15)
        assert r2.status_code == 200 and r2.json()["notes"] == "updated"

    def test_customer_quotes_endpoint(self, admin_session, test_customer):
        r = admin_session.get(f"{API}/customers/{test_customer['id']}/quotes", timeout=15)
        assert r.status_code == 200 and isinstance(r.json(), list)


# ---------------------------- PRODUCTS ----------------------------
class TestProducts:
    def test_products_count(self, admin_session):
        r = admin_session.get(f"{API}/products/count", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data
        # feed should have a large number of products post-sync
        # do not hard-assert 4173 but assert >0 OR perform a sync if 0
        if data["count"] == 0:
            # trigger sync (may take time)
            s = admin_session.post(f"{API}/products/sync", timeout=300)
            assert s.status_code == 200
            r = admin_session.get(f"{API}/products/count", timeout=30)
            assert r.json()["count"] > 0

    def test_products_search(self, admin_session):
        r = admin_session.get(f"{API}/products", params={"search": "a", "limit": 5}, timeout=30)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) <= 5


# ---------------------------- QUOTES ----------------------------
class TestQuotes:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/quotes/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("by_status", "total", "customer_count", "product_count", "recent"):
            assert k in d

    def test_create_quote_and_totals(self, admin_session, test_customer):
        items = [
            {"title": "Blender", "code": "BL-1", "quantity": 2, "unit_price": 1000.0, "discount_percent": 10},
            {"title": "Oven", "code": "OV-1", "quantity": 1, "unit_price": 5000.0, "discount_percent": 0},
        ]
        payload = {
            "customer_id": test_customer["id"],
            "currency": "TRY",
            "vat_rate": 20.0,
            "discount_rate": 5.0,
            "valid_until": "2030-12-31",
            "notes": f"{TEST_PREFIX}notes",
            "items": items,
            "status": "taslak",
        }
        r = admin_session.post(f"{API}/quotes", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        q = r.json()
        # quote_no format
        import re
        assert re.match(r"^AR-\d{6}-\d{4}$", q["quote_no"]), f"bad quote_no {q['quote_no']}"
        # totals: 2*1000*(0.9) + 1*5000 = 1800 + 5000 = 6800; vat=1360; total_vat=8160; disc=408; grand=7752
        assert abs(q["subtotal"] - 6800.0) < 0.01
        assert abs(q["vat_amount"] - 1360.0) < 0.01
        assert abs(q["total_with_vat"] - 8160.0) < 0.01
        assert abs(q["discount_amount"] - 408.0) < 0.01
        assert abs(q["grand_total"] - 7752.0) < 0.01
        # save for follow-on
        TestQuotes._qid = q["id"]
        TestQuotes._qno = q["quote_no"]

    def test_list_with_filters(self, admin_session, test_customer):
        r = admin_session.get(f"{API}/quotes", params={"customer_id": test_customer["id"]}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert all(x["customer_id"] == test_customer["id"] for x in arr)

    def test_update_recomputes_totals(self, admin_session):
        qid = TestQuotes._qid
        r = admin_session.put(f"{API}/quotes/{qid}", json={
            "items": [{"title": "X", "code": "x", "quantity": 1, "unit_price": 100, "discount_percent": 0}],
            "vat_rate": 10.0, "discount_rate": 0.0,
        }, timeout=15)
        assert r.status_code == 200
        q = r.json()
        assert abs(q["subtotal"] - 100.0) < 0.01
        assert abs(q["vat_amount"] - 10.0) < 0.01
        assert abs(q["grand_total"] - 110.0) < 0.01

    def test_revise(self, admin_session):
        qid = TestQuotes._qid
        qno = TestQuotes._qno
        r = admin_session.post(f"{API}/quotes/{qid}/revise", timeout=15)
        assert r.status_code == 200
        new = r.json()
        assert new["quote_no"] == f"{qno}-R1"
        assert new["revision_number"] == 1
        TestQuotes._rev_id = new["id"]

    def test_email_missing_resend_key(self, admin_session):
        qid = TestQuotes._qid
        # Ensure settings have empty resend_api_key (default)
        fake_pdf = base64.b64encode(b"%PDF-1.4 fake").decode()
        r = admin_session.post(f"{API}/quotes/{qid}/email", json={
            "recipient_email": "test@example.com", "pdf_base64": fake_pdf,
        }, timeout=30)
        # Either 400 (no key) or 500 (invalid key) acceptable
        assert r.status_code in (400, 500), r.text

    def test_email_with_fake_key_errors(self, admin_session):
        # Get settings, set fake resend key, call email, expect 500
        r = admin_session.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        settings = r.json()
        original_key = settings.get("resend_api_key", "")
        settings["resend_api_key"] = "re_FAKE_KEY_FOR_TEST_123"
        r = admin_session.put(f"{API}/settings", json=settings, timeout=15)
        assert r.status_code == 200
        try:
            qid = TestQuotes._qid
            fake_pdf = base64.b64encode(b"%PDF-1.4 fake").decode()
            r = admin_session.post(f"{API}/quotes/{qid}/email", json={
                "recipient_email": "test@example.com", "pdf_base64": fake_pdf,
            }, timeout=30)
            assert r.status_code in (400, 500)
        finally:
            settings["resend_api_key"] = original_key
            admin_session.put(f"{API}/settings", json=settings, timeout=15)

    def test_delete_quote(self, admin_session):
        for qid in (getattr(TestQuotes, "_rev_id", None), getattr(TestQuotes, "_qid", None)):
            if qid:
                r = admin_session.delete(f"{API}/quotes/{qid}", timeout=15)
                assert r.status_code == 200


# ---------------------------- SETTINGS ----------------------------
class TestSettings:
    def test_admin_gets_full_settings(self, admin_session):
        r = admin_session.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "resend_api_key" in d
        assert "smtp_password" in d

    def test_sales_gets_sanitized(self, sales_session):
        r = sales_session.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "resend_api_key" not in d
        assert "smtp_password" not in d

    def test_sales_cannot_update(self, sales_session):
        r = sales_session.put(f"{API}/settings", json={"company_name": "Hack"}, timeout=15)
        assert r.status_code == 403
