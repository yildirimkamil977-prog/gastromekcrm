"""
Regression tests for the translate.py fix
(emergentintegrations -> openai AsyncOpenAI SDK).

Verifies:
1. Backend starts cleanly (no ModuleNotFoundError) — /api/health 200
2. Admin login works — proves auth stack + settings routes usable
3. POST /api/translate (DE) returns matching translations (real OpenAI call)
4. POST /api/translate (TR) works
5. POST /api/translate rejects unauth
6. Quote listing + customer listing still 200 (general regression)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@arigastro.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "admin"
    assert "access_token" in data
    assert "access_token" in s.cookies, "httpOnly cookie should be set"
    return s


# 1. Backend health — proves no import crash-loop
def test_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("ok", "healthy") or "status" in body


# 2. Admin login (also covered by fixture, explicit test for clarity)
def test_admin_login_success():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == ADMIN_EMAIL


# 3. Translate DE — real OpenAI call
def test_translate_de(admin_session):
    payload = {
        "target_lang": "de",
        "texts": ["Endüstriyel Bulaşık Makinesi", "Fiyat", ""]
    }
    r = admin_session.post(f"{API}/translate", json=payload, timeout=60)
    assert r.status_code == 200, f"Translate DE failed: {r.status_code} {r.text}"
    data = r.json()
    assert "translations" in data
    trs = data["translations"]
    assert isinstance(trs, list) and len(trs) == 3
    # empty stays empty
    assert trs[2] == ""
    # first two should not be identical to source (translated)
    assert trs[0] and trs[0] != "Endüstriyel Bulaşık Makinesi"
    # sanity: DE mention of the product
    assert any(k in trs[0].lower() for k in ("geschirr", "industrie", "spül"))


# 4. Translate TR
def test_translate_tr(admin_session):
    payload = {"target_lang": "tr", "texts": ["Industrial Dishwasher"]}
    r = admin_session.post(f"{API}/translate", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    trs = r.json()["translations"]
    assert len(trs) == 1
    assert trs[0] and trs[0].lower() != "industrial dishwasher"


# 5. Translate requires auth
def test_translate_requires_auth():
    r = requests.post(f"{API}/translate",
                      json={"target_lang": "de", "texts": ["hello"]},
                      timeout=15)
    assert r.status_code in (401, 403)


# 6. Translate invalid lang
def test_translate_invalid_lang(admin_session):
    r = admin_session.post(f"{API}/translate",
                           json={"target_lang": "fr", "texts": ["merhaba"]},
                           timeout=15)
    assert r.status_code == 400


# 7. Regression: quotes list
def test_quotes_list(admin_session):
    r = admin_session.get(f"{API}/quotes", timeout=30)
    assert r.status_code == 200
    body = r.json()
    # accept list or {items:[...]}
    items = body if isinstance(body, list) else body.get("items", body.get("quotes", []))
    assert isinstance(items, list)


# 8. Regression: customers list
def test_customers_list(admin_session):
    r = admin_session.get(f"{API}/customers", timeout=30)
    assert r.status_code == 200
    body = r.json()
    items = body if isinstance(body, list) else body.get("items", body.get("customers", []))
    assert isinstance(items, list)
