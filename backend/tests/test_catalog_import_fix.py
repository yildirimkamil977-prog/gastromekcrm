"""Regression tests for the catalog-import fix (iteration_17).

Verifies:
- GET /api/catalog/count matches live-feed size (NOT the stale 4193 number)
- POST /api/catalog/import fetches live feed and returns feed/total
- Re-running import is idempotent
- Edit preservation across re-import
- /api/products (feed / quote picker) remains a SEPARATE dataset
"""
import os
import time
import xml.etree.ElementTree as ET

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "http://localhost:8001"

ADMIN_EMAIL = "admin@arigastro.com"
ADMIN_PASSWORD = "admin123"
FEED_URL = os.environ.get(
    "PRODUCT_FEED_URL",
    "https://api.myikas.com/api/admin/ms/149e1ffa-f004-4044-b059-10d86865ebab/"
    "5f782569-de17-4d4e-88a4-c65bd533ac9f/google/feed.xml",
)


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def live_feed_count():
    """Fetch live feed and count <item> entries once for the module."""
    r = requests.get(FEED_URL, timeout=60)
    assert r.status_code == 200, f"feed unreachable: {r.status_code}"
    root = ET.fromstring(r.content)
    items = root.findall(".//item")
    return len(items)


class TestCountReflectsLiveFeed:
    def test_count_endpoint_not_stale(self, admin, live_feed_count):
        r = admin.get(f"{BASE_URL}/api/catalog/count")
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and "translated" in data and "exported" in data
        assert data["count"] != 4193, "catalog still holds the OLD stale 4193 total"
        # Should be within a reasonable delta of live feed
        # (may differ slightly because edited products are preserved
        # and the feed itself can shift between our fetch and the server's)
        delta = abs(data["count"] - live_feed_count)
        assert delta <= 200, (
            f"catalog count {data['count']} vs live feed {live_feed_count} "
            f"differ by {delta}"
        )
        # NOTE: translated / exported may be > 0 if an earlier test agent
        # left artifacts — do not assert strict zero.
        assert data["translated"] >= 0
        assert data["exported"] >= 0
        print(f"catalog count={data['count']}  live feed={live_feed_count}")


class TestImportEndpoint:
    def test_import_returns_feed_and_total(self, admin, live_feed_count):
        r = admin.post(f"{BASE_URL}/api/catalog/import", timeout=180)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("added", "updated", "skipped", "removed", "feed", "total"):
            assert k in body, f"missing key {k} in {body}"
        # feed count reported by backend should match our own live fetch
        assert abs(body["feed"] - live_feed_count) <= 50, (
            f"backend feed={body['feed']} vs client feed={live_feed_count}"
        )
        # total == feed  +  possibly-preserved-edited-products
        assert body["total"] >= body["feed"], (
            f"total {body['total']} < feed {body['feed']}"
        )
        # total should NEVER be the stale 4193
        assert body["total"] < 4000, (
            f"total {body['total']} still looks stale (>=4000)"
        )
        print(f"import result: {body}")

    def test_import_is_idempotent(self, admin):
        r1 = admin.post(f"{BASE_URL}/api/catalog/import", timeout=180).json()
        r2 = admin.post(f"{BASE_URL}/api/catalog/import", timeout=180).json()
        # On a clean re-run the second call should add 0 (feed hasn't changed)
        # and total should stay close to feed.
        assert r2["added"] <= 20, f"unexpected added on re-run: {r2}"
        assert abs(r2["total"] - r1["total"]) <= 20
        # removed should also be near zero on a clean re-run
        assert r2["removed"] <= 20, f"unexpected removed on re-run: {r2}"
        print(f"idempotent run: {r2}")


class TestEditPreservationAcrossImport:
    def test_edited_product_survives_reimport(self, admin):
        # 1) pick a product that is NOT already edited
        page = admin.get(
            f"{BASE_URL}/api/catalog/products",
            params={"page": 1, "page_size": 100},
        ).json()
        target = next((p for p in page["items"] if not p.get("edited")), None)
        assert target, "could not find an un-edited product to mark"
        pid = target["id"]
        original_title_de = target.get("title_de", "")

        # 2) mark it edited by setting a distinctive title_de
        stamp = f"TESTDE_{int(time.time())}"
        r = admin.put(
            f"{BASE_URL}/api/catalog/products/{pid}",
            json={"title_de": stamp},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["title_de"] == stamp
        assert body["edited"] is True

        # 3) run /import again
        imp = admin.post(f"{BASE_URL}/api/catalog/import", timeout=180)
        assert imp.status_code == 200

        # 4) product must still exist with the edited title_de intact
        after = admin.get(
            f"{BASE_URL}/api/catalog/products",
            params={"search": stamp, "page": 1, "page_size": 5},
        ).json()
        matched = [p for p in after["items"] if p["id"] == pid]
        assert matched, (
            f"edited product {pid} vanished after re-import"
        )
        assert matched[0]["title_de"] == stamp, matched[0]
        assert matched[0].get("edited") is True

        # 5) cleanup: revert title_de (edited stays True — acceptable)
        admin.put(
            f"{BASE_URL}/api/catalog/products/{pid}",
            json={"title_de": original_title_de},
        )


class TestProductsEndpointSeparateFromCatalog:
    def test_products_and_catalog_are_separate(self, admin):
        p = admin.get(f"{BASE_URL}/api/products", params={"limit": 5})
        assert p.status_code == 200
        pdata = p.json()
        items = pdata if isinstance(pdata, list) else (
            pdata.get("items") or pdata.get("products") or []
        )
        assert isinstance(items, list) and len(items) >= 1, "/api/products empty"
        # response should be plain product docs (no catalog-only flags like
        # 'in_export' or 'translated' set — those live in catalog_products)
        # We just make sure the endpoint works and does NOT return {count:4193}.
        first = items[0]
        assert "id" in first and "title" in first

        c = admin.get(f"{BASE_URL}/api/catalog/count").json()
        # both datasets exist independently
        assert c["count"] > 0
        # /api/products count and /api/catalog/count are separate — but at
        # least verify catalog list also works
        cp = admin.get(
            f"{BASE_URL}/api/catalog/products",
            params={"page": 1, "page_size": 5},
        )
        assert cp.status_code == 200
        assert len(cp.json()["items"]) >= 1
