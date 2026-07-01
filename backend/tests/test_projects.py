"""Projects module backend tests — CRUD, incomes/expenses/payments, RBAC, cascade, separation from Accounting."""
import os
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crm-quote-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@arigastro.com"
ADMIN_PASSWORD = "admin123"
TEST_PREFIX = "TEST_"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def customer(admin):
    r = admin.post(f"{API}/customers", json={
        "company_name": f"{TEST_PREFIX}ProjCust {uuid.uuid4().hex[:6]}",
        "tax_number": "9998887770", "tax_office": "TR",
        "contact_person": "P", "phone": "+90", "whatsapp": "+90",
        "email": "p@t.com", "address": "a", "city": "c", "notes": "",
    }, timeout=15)
    assert r.status_code == 200, r.text
    c = r.json()
    yield c
    admin.delete(f"{API}/customers/{c['id']}", timeout=15)


@pytest.fixture(scope="module")
def sales_user(admin):
    email = f"{TEST_PREFIX}sales_p_{uuid.uuid4().hex[:6]}@arigastro.com"
    r = admin.post(f"{API}/users", json={"email": email, "name": "TS", "role": "sales", "password": "Sales1234!"}, timeout=15)
    assert r.status_code == 200, r.text
    u = r.json()
    yield {"id": u["id"], "email": email, "password": "Sales1234!"}
    admin.delete(f"{API}/users/{u['id']}", timeout=15)


@pytest.fixture(scope="module")
def sales(sales_user):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": sales_user["email"], "password": sales_user["password"]}, timeout=15)
    assert r.status_code == 200, r.text
    return s


class TestProjectsCRUD:
    def test_create_project_defaults_and_get(self, admin, customer):
        r = admin.post(f"{API}/projects", json={
            "customer_id": customer["id"], "name": f"{TEST_PREFIX}Proj A",
            "amount": 500000, "currency": "EUR", "info": "info x",
        }, timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["amount"] == 500000.0
        assert p["currency"] == "EUR"
        assert p["name"] == f"{TEST_PREFIX}Proj A"
        pid = p["id"]
        # detail
        d = admin.get(f"{API}/projects/{pid}", timeout=15).json()
        s = d["summary"]
        assert s["amount"] == 500000.0
        assert s["income_total"] == 0
        assert s["remaining_receivable"] == 500000.0
        assert s["expense_debt_total"] == 0
        assert s["profit"] == 500000.0
        # list includes it, with customer name and profit
        L = admin.get(f"{API}/projects", timeout=15).json()["items"]
        row = next((x for x in L if x["id"] == pid), None)
        assert row and row["customer"]["company_name"] == customer["company_name"]
        assert row["profit"] == 500000.0 and row["remaining_receivable"] == 500000.0
        admin.delete(f"{API}/projects/{pid}", timeout=15)

    def test_currencies_try_usd(self, admin, customer):
        for cur in ("TRY", "USD"):
            r = admin.post(f"{API}/projects", json={
                "customer_id": customer["id"], "name": f"{TEST_PREFIX}{cur}",
                "amount": 1000, "currency": cur, "info": "",
            }, timeout=15)
            assert r.status_code == 200, r.text
            assert r.json()["currency"] == cur
            admin.delete(f"{API}/projects/{r.json()['id']}", timeout=15)

    def test_invalid_customer(self, admin):
        r = admin.post(f"{API}/projects", json={
            "customer_id": "no-such", "name": "x", "amount": 10, "currency": "EUR", "info": "",
        }, timeout=15)
        assert r.status_code == 400

    def test_update_project(self, admin, customer):
        c = admin.post(f"{API}/projects", json={
            "customer_id": customer["id"], "name": f"{TEST_PREFIX}U", "amount": 100, "currency": "EUR", "info": "",
        }, timeout=15).json()
        r = admin.put(f"{API}/projects/{c['id']}", json={"amount": 250, "name": f"{TEST_PREFIX}U2"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["amount"] == 250 and r.json()["name"] == f"{TEST_PREFIX}U2"
        admin.delete(f"{API}/projects/{c['id']}", timeout=15)


class TestIncomesExpensesPayments:
    @pytest.fixture(scope="class")
    def project(self, admin, customer):
        r = admin.post(f"{API}/projects", json={
            "customer_id": customer["id"], "name": f"{TEST_PREFIX}Full", "amount": 500000, "currency": "EUR", "info": "",
        }, timeout=15)
        p = r.json()
        yield p
        admin.delete(f"{API}/projects/{p['id']}", timeout=15)

    def test_add_income_and_summary(self, admin, project):
        pid = project["id"]
        r = admin.post(f"{API}/projects/{pid}/incomes", json={
            "amount": 100000, "currency": "EUR", "date": "2026-01-10", "note": "first",
        }, timeout=15)
        assert r.status_code == 200
        d = admin.get(f"{API}/projects/{pid}", timeout=15).json()
        assert d["summary"]["income_total"] == 100000
        assert d["summary"]["remaining_receivable"] == 400000
        assert d["summary"]["profit"] == 500000  # no expenses yet

    def test_add_expense_with_initial_payment(self, admin, project):
        pid = project["id"]
        r = admin.post(f"{API}/projects/{pid}/expenses", json={
            "name": "Mobilyacı", "total_debt": 100000, "currency": "EUR", "note": "",
            "initial_payment": {"amount": 50000, "currency": "EUR", "date": "2026-01-15", "note": "p1", "receipts": []},
        }, timeout=15)
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["total_debt"] == 100000 and e["paid"] == 50000 and e["remaining"] == 50000
        assert e["payments_count"] == 1
        # summary
        d = admin.get(f"{API}/projects/{pid}", timeout=15).json()["summary"]
        assert d["expense_debt_total"] == 100000
        assert d["expense_paid_total"] == 50000
        assert d["expense_remaining_total"] == 50000
        assert d["profit"] == 400000  # 500000 - 100000

    def test_add_second_payment_and_recalc(self, admin, project):
        pid = project["id"]
        # fetch expense id
        d = admin.get(f"{API}/projects/{pid}", timeout=15).json()
        exp = d["expenses"][0]
        eid = exp["id"]
        r = admin.post(f"{API}/projects/{pid}/expenses/{eid}/payments", json={
            "amount": 20000, "currency": "EUR", "date": "2026-01-20", "note": "p2", "receipts": [],
        }, timeout=15)
        assert r.status_code == 200, r.text
        e2 = r.json()
        assert e2["paid"] == 70000 and e2["remaining"] == 30000 and e2["payments_count"] == 2
        s = admin.get(f"{API}/projects/{pid}", timeout=15).json()["summary"]
        assert s["expense_remaining_total"] == 30000
        assert s["profit"] == 400000

    def test_delete_payment_recalculates(self, admin, project):
        pid = project["id"]
        d = admin.get(f"{API}/projects/{pid}", timeout=15).json()
        exp = d["expenses"][0]
        # delete the 20000 payment
        target = next(p for p in exp["payments"] if p["amount"] == 20000)
        r = admin.delete(f"{API}/projects/{pid}/expenses/{exp['id']}/payments/{target['id']}", timeout=15)
        assert r.status_code == 200
        e = r.json()
        assert e["paid"] == 50000 and e["remaining"] == 50000 and e["payments_count"] == 1


class TestSeparationFromAccounting:
    def test_projects_dont_touch_accounting(self, admin, customer):
        # snapshot accounting stats
        before = admin.get(f"{API}/accounting/stats", timeout=15).json()
        # snapshot accounting list count
        blist = admin.get(f"{API}/accounting", params={"page_size": 1}, timeout=15).json()
        bcount = blist.get("total", 0)
        # create project + income + expense
        p = admin.post(f"{API}/projects", json={
            "customer_id": customer["id"], "name": f"{TEST_PREFIX}Sep", "amount": 1000, "currency": "EUR", "info": "",
        }, timeout=15).json()
        admin.post(f"{API}/projects/{p['id']}/incomes", json={"amount": 300, "currency": "EUR", "date": "2026-02-01", "note": ""}, timeout=15)
        admin.post(f"{API}/projects/{p['id']}/expenses", json={
            "name": "Malzeme", "total_debt": 200, "currency": "EUR", "note": "",
            "initial_payment": {"amount": 100, "currency": "EUR", "date": "2026-02-02", "note": "", "receipts": []},
        }, timeout=15)
        # compare after
        after = admin.get(f"{API}/accounting/stats", timeout=15).json()
        alist = admin.get(f"{API}/accounting", params={"page_size": 1}, timeout=15).json()
        acount = alist.get("total", 0)
        try:
            assert bcount == acount, f"Accounting rowcount changed: {bcount} -> {acount}"
            assert round(before.get("total_income", 0), 2) == round(after.get("total_income", 0), 2)
            assert round(before.get("total_expense", 0), 2) == round(after.get("total_expense", 0), 2)
        finally:
            admin.delete(f"{API}/projects/{p['id']}", timeout=15)


class TestCascadeDelete:
    def test_cascade_deletes_incomes_and_expenses(self, admin, customer):
        p = admin.post(f"{API}/projects", json={
            "customer_id": customer["id"], "name": f"{TEST_PREFIX}Casc", "amount": 500, "currency": "EUR", "info": "",
        }, timeout=15).json()
        admin.post(f"{API}/projects/{p['id']}/incomes", json={"amount": 100, "currency": "EUR", "date": "2026-01-01", "note": ""}, timeout=15)
        admin.post(f"{API}/projects/{p['id']}/expenses", json={
            "name": "x", "total_debt": 50, "currency": "EUR", "note": "",
        }, timeout=15)
        # delete
        r = admin.delete(f"{API}/projects/{p['id']}", timeout=15)
        assert r.status_code == 200
        # get 404
        r2 = admin.get(f"{API}/projects/{p['id']}", timeout=15)
        assert r2.status_code == 404


class TestRBAC:
    def test_sales_default_allowed(self, sales):
        r = sales.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200

    def test_sales_blocked_when_disabled(self, admin, sales):
        cur = admin.get(f"{API}/settings", timeout=15).json()
        original = cur.get("projects_visible_roles") or ["admin", "sales", "muhasebe"]
        try:
            new = [r for r in original if r != "sales"]
            if "admin" not in new:
                new.append("admin")
            up = admin.put(f"{API}/settings", json={"projects_visible_roles": new}, timeout=15)
            assert up.status_code == 200
            r = sales.get(f"{API}/projects", timeout=15)
            assert r.status_code == 403, f"expected 403 got {r.status_code}"
            # admin always allowed
            assert admin.get(f"{API}/projects", timeout=15).status_code == 200
            # verify persistence
            got = admin.get(f"{API}/settings", timeout=15).json()
            assert "sales" not in (got.get("projects_visible_roles") or [])
        finally:
            admin.put(f"{API}/settings", json={"projects_visible_roles": original}, timeout=15)


class TestUploads:
    def test_upload_and_serve_png(self, admin):
        # minimal 1x1 PNG
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        files = {"file": ("t.png", base64.b64decode(png_b64), "image/png")}
        r = admin.post(f"{API}/uploads", files=files, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "url" in j and "/api/uploads/file/" in j["url"]
        url = j["url"] if j["url"].startswith("http") else f"{BASE_URL}{j['url']}"
        r2 = admin.get(url, timeout=15)
        assert r2.status_code == 200
        assert r2.content[:4] == b"\x89PNG"
