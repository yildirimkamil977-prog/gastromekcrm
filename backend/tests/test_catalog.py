"""Backend tests for the German Katalog module (/api/catalog/*).

Covers: admin auth guard, listing/pagination/filters, facets, count,
translate max-20 guard + real OpenAI call, export flag add/remove,
export/info + PUBLIC XML feed (no-auth), CSV export, edit persistence,
regression on /api/products (quote-form picker) and /api/health.
"""
import os
import io
import csv
import time
import xml.etree.ElementTree as ET

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # dev fallback for pytest running inside container
    BASE_URL = "http://localhost:8001"

ADMIN_EMAIL = "admin@arigastro.com"
ADMIN_PASSWORD = "admin123"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_session(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    # cookies are stored on the session automatically
    return api_client


@pytest.fixture(scope="session")
def sample_product_id(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/catalog/products",
                          params={"page": 1, "page_size": 5})
    assert r.status_code == 200
    items = r.json().get("items") or []
    assert items, "catalog has no products"
    return items[0]["id"]


# ---------- health / basic ----------
class TestBasics:
    def test_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"

    def test_catalog_requires_auth(self, api_client):
        # NB: use a fresh session (no auth cookie)
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/catalog/products")
        assert r.status_code in (401, 403), r.status_code


# ---------- list / facets / count ----------
class TestListAndFacets:
    def test_list_default(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/catalog/products",
                              params={"page": 1, "page_size": 50})
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        assert data["page"] == 1 and data["page_size"] == 50
        assert data["total"] >= 1, "catalog is empty"
        assert len(data["items"]) <= 50
        # no _id leakage
        for it in data["items"]:
            assert "_id" not in it
            assert "id" in it and "title" in it

    def test_list_pagination_returns_different_products(self, admin_session):
        r1 = admin_session.get(f"{BASE_URL}/api/catalog/products",
                               params={"page": 1, "page_size": 5}).json()
        r2 = admin_session.get(f"{BASE_URL}/api/catalog/products",
                               params={"page": 2, "page_size": 5}).json()
        ids1 = [x["id"] for x in r1["items"]]
        ids2 = [x["id"] for x in r2["items"]]
        assert ids1 and ids2
        assert set(ids1).isdisjoint(set(ids2)), "pagination returned overlapping ids"

    def test_search_filter(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/catalog/products",
                              params={"search": "tava", "page": 1, "page_size": 20})
        assert r.status_code == 200
        data = r.json()
        # allow zero, but validate response shape
        assert isinstance(data["items"], list)
        # if items present, every one should contain 'tava' somewhere textual
        for it in data["items"][:5]:
            hay = " ".join(str(it.get(k, "")).lower()
                           for k in ("title", "title_de", "code", "brand", "gtin", "mpn"))
            assert "tava" in hay

    def test_facets(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/catalog/facets")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["brands"], list) and isinstance(d["categories"], list)
        assert len(d["brands"]) > 0

    def test_brand_filter_applies(self, admin_session):
        f = admin_session.get(f"{BASE_URL}/api/catalog/facets").json()
        if not f["brands"]:
            pytest.skip("no brands in catalog")
        brand = f["brands"][0]
        r = admin_session.get(f"{BASE_URL}/api/catalog/products",
                              params={"brand": brand, "page": 1, "page_size": 20})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it.get("brand") == brand

    def test_count(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/catalog/count")
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        assert d["exported"] >= 0 and d["translated"] >= 0


# ---------- edit / persistence ----------
class TestEdit:
    def test_edit_and_persist(self, admin_session, sample_product_id):
        # snapshot original
        orig = admin_session.get(
            f"{BASE_URL}/api/catalog/products",
            params={"search": "", "page": 1, "page_size": 50}).json()["items"]
        target = next((p for p in orig if p["id"] == sample_product_id), None)
        assert target
        original_title_de = target.get("title_de", "")

        new_val = f"TEST_DE_{int(time.time())}"
        r = admin_session.put(
            f"{BASE_URL}/api/catalog/products/{sample_product_id}",
            json={"title_de": new_val})
        assert r.status_code == 200
        body = r.json()
        assert body["title_de"] == new_val
        assert body["edited"] is True

        # reload via list search to confirm persistence
        r2 = admin_session.get(f"{BASE_URL}/api/catalog/products",
                               params={"search": new_val, "page": 1, "page_size": 5})
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert any(p["id"] == sample_product_id and p["title_de"] == new_val
                   for p in items)

        # revert
        admin_session.put(f"{BASE_URL}/api/catalog/products/{sample_product_id}",
                          json={"title_de": original_title_de})


# ---------- export flag + XML feed ----------
class TestExportAndFeed:
    def test_add_remove_export_and_public_feed(self, admin_session, sample_product_id):
        # info
        info = admin_session.get(f"{BASE_URL}/api/catalog/export/info").json()
        assert "path" in info and info["path"].startswith("/api/catalog/feed/")
        initial_count = info["count"]

        # add
        r = admin_session.post(f"{BASE_URL}/api/catalog/export/add",
                               json={"ids": [sample_product_id]})
        assert r.status_code == 200
        assert r.json()["in_export"] >= max(1, initial_count)

        # public feed reachable WITHOUT auth
        pub_url = f"{BASE_URL}{info['path']}"
        pub = requests.get(pub_url)
        assert pub.status_code == 200, f"public feed not 200: {pub.status_code}"
        ctype = pub.headers.get("content-type", "")
        assert "xml" in ctype.lower()
        assert pub.text.startswith("<?xml")
        # parse and verify Google Shopping structure
        root = ET.fromstring(pub.text)
        assert root.tag == "rss"
        channel = root.find("channel")
        assert channel is not None
        items = channel.findall("item")
        assert len(items) >= 1
        ns = {"g": "http://base.google.com/ns/1.0"}
        first = items[0]
        assert first.find("g:id", ns) is not None
        assert first.find("g:title", ns) is not None
        assert first.find("g:price", ns) is not None

        # remove
        r = admin_session.post(f"{BASE_URL}/api/catalog/export/remove",
                               json={"ids": [sample_product_id]})
        assert r.status_code == 200

    def test_feed_bad_token_404(self, api_client):
        r = requests.get(f"{BASE_URL}/api/catalog/feed/badtoken123.xml")
        assert r.status_code == 404


# ---------- CSV export ----------
class TestCsv:
    def test_csv_export_shape(self, admin_session, sample_product_id):
        r = admin_session.post(f"{BASE_URL}/api/catalog/export-csv",
                               json={"ids": [sample_product_id]})
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype
        # BOM + parse
        text = r.content.decode("utf-8-sig")
        rows = list(csv.reader(io.StringIO(text)))
        assert len(rows) >= 2, "CSV should have header + at least 1 row"
        header = rows[0]
        assert len(header) == 36, f"expected 36 columns, got {len(header)}"
        assert header[0] == "Ürün Grup ID"
        assert header[2] == "İsim"
        data_row = rows[1]
        assert data_row[0] == sample_product_id


# ---------- translate ----------
class TestTranslate:
    def test_max_20_guard(self, admin_session):
        # 21 dummy ids (server just checks length, doesn't need real ids for the 400)
        ids = [f"dummy-{i}" for i in range(21)]
        r = admin_session.post(f"{BASE_URL}/api/catalog/translate", json={"ids": ids})
        assert r.status_code == 400
        assert "20" in r.json().get("detail", "")

    def test_translate_real_openai(self, admin_session, sample_product_id):
        # pick a product that is NOT already translated so we can validate change
        r = admin_session.get(f"{BASE_URL}/api/catalog/products",
                              params={"page": 1, "page_size": 50}).json()
        target = next((p for p in r["items"] if not p.get("translated")), None)
        if target is None:
            target = r["items"][0]
        pid = target["id"]

        resp = admin_session.post(f"{BASE_URL}/api/catalog/translate",
                                  json={"ids": [pid]}, timeout=60)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["translated"] >= 1, body
        assert pid in body["ok_ids"]

        # verify persisted
        r2 = admin_session.get(f"{BASE_URL}/api/catalog/products",
                               params={"search": target.get("title", "")[:20],
                                       "page": 1, "page_size": 50}).json()
        got = next((p for p in r2["items"] if p["id"] == pid), None)
        assert got is not None
        assert got.get("translated") is True
        assert (got.get("title_de") or "").strip() != ""


# ---------- REGRESSION ----------
class TestRegression:
    def test_products_endpoint_unchanged(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/products",
                              params={"limit": 5})
        assert r.status_code == 200
        data = r.json()
        # products endpoint returns list or {items:[...]}, both are fine
        if isinstance(data, dict):
            items = data.get("items") or data.get("products") or []
        else:
            items = data
        assert isinstance(items, list)
        # Not asserting count > 0 to avoid coupling — but structure must be intact
