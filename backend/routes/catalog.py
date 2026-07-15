"""German catalog module.

A curated, MANUALLY-managed copy of feed products (collection: catalog_products)
that is NOT auto-synced daily, so translations/edits are preserved. Admin-only.
Feed products used by the quote form remain untouched in the `products` collection.
"""
import os
import io
import csv
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape
from typing import List, Optional

from fastapi import APIRouter, Request, HTTPException, Depends, Query, Response
from pydantic import BaseModel
from pymongo import UpdateOne, InsertOne

from auth import get_current_user_from_request
from openai import AsyncOpenAI
from feed_sync import fetch_feed, parse_feed_xml

logger = logging.getLogger("catalog")

BASE_FIELDS = ["code", "title", "description", "link", "image", "additional_images",
               "price", "currency", "brand", "product_type", "gtin", "mpn",
               "condition", "availability"]

CSV_HEADER = ["Ürün Grup ID", "Varyant ID", "İsim", "Açıklama", "Satış Fiyatı",
              "İndirimli Fiyatı", "Alış Fiyatı", "Barkod Listesi", "SKU", "Silindi mi?",
              "Marka", "Kategoriler", "Etiketler", "Resim URL", "Metadata Başlık",
              "Metadata Açıklama", "Slug", "Stok:Ana Depo", "Tip", "Varyant Tip 1",
              "Varyant Değer 1", "Varyant Tip 2", "Varyant Değer 2", "Desi", "HS Kod",
              "Birim Ürün Miktarı", "Ürün Birimi", "Satılan Ürün Miktarı",
              "Satılan Ürün Birimi", "Google Ürün Kategorisi", "Tedarikçi",
              "Stoğu Tükenince Satmaya Devam Et", "Satış Kanalı:gastromek",
              "Sepet Başına Minimum Alma Adeti:gastromek",
              "Sepet Başına Maksimum Alma Adeti:gastromek", "Varyant Aktiflik"]


class IdsBody(BaseModel):
    ids: List[str]


class UpdateProductBody(BaseModel):
    title: Optional[str] = None
    title_de: Optional[str] = None
    description: Optional[str] = None
    description_de: Optional[str] = None
    brand: Optional[str] = None
    product_type: Optional[str] = None
    product_type_de: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    image: Optional[str] = None
    code: Optional[str] = None


async def _get_openai_key(db) -> str:
    key = os.environ.get("OPENAI_API_KEY")
    s = await db.settings.find_one({"key": "company"}, {"openai_api_key": 1})
    if s and (s.get("openai_api_key") or "").strip():
        key = s["openai_api_key"].strip()
    return key


def _de(p: dict, field: str) -> str:
    """German value with fallback to source."""
    return (p.get(f"{field}_de") or "").strip() or (p.get(field) or "")


def build_catalog_router(db):
    router = APIRouter(prefix="/catalog", tags=["catalog"])

    async def admin_user(request: Request):
        user = await get_current_user_from_request(request, db)
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Yetkiniz yok")
        return user

    async def _export_token() -> str:
        doc = await db.catalog_meta.find_one({"key": "export"})
        if doc and doc.get("token"):
            return doc["token"]
        token = uuid.uuid4().hex
        await db.catalog_meta.update_one({"key": "export"}, {"$set": {"token": token}}, upsert=True)
        return token

    # ---------- list / facets ----------
    @router.get("/products")
    async def list_products(
        search: str = Query(""),
        brand: str = Query(""),
        category: str = Query(""),
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=200),
        user=Depends(admin_user),
    ):
        q: dict = {}
        if search:
            rx = {"$regex": search, "$options": "i"}
            q["$or"] = [{"title": rx}, {"title_de": rx}, {"code": rx}, {"gtin": rx}, {"mpn": rx}, {"brand": rx}]
        if brand:
            q["brand"] = brand
        if category:
            q["product_type"] = {"$regex": category, "$options": "i"}
        total = await db.catalog_products.count_documents(q)
        skip = (page - 1) * page_size
        items = await db.catalog_products.find(q, {"_id": 0}).sort("title", 1).skip(skip).limit(page_size).to_list(page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.get("/facets")
    async def facets(user=Depends(admin_user)):
        brands = await db.catalog_products.distinct("brand")
        cats = await db.catalog_products.distinct("product_type")
        brands = sorted([b for b in brands if b])
        cats = sorted([c for c in cats if c])
        return {"brands": brands, "categories": cats}

    @router.get("/count")
    async def count(user=Depends(admin_user)):
        total = await db.catalog_products.count_documents({})
        exported = await db.catalog_products.count_documents({"in_export": True})
        translated = await db.catalog_products.count_documents({"translated": True})
        return {"count": total, "exported": exported, "translated": translated}

    # ---------- import from feed (LIVE) ----------
    @router.post("/import")
    async def import_from_feed(user=Depends(admin_user)):
        url = os.environ.get("PRODUCT_FEED_URL", "")
        if not url:
            raise HTTPException(status_code=500, detail="PRODUCT_FEED_URL tanımlı değil")
        try:
            xml_bytes = await fetch_feed(url)
            feed_products = parse_feed_xml(xml_bytes)
        except Exception as e:  # noqa: BLE001
            logger.error(f"feed fetch failed: {e}")
            raise HTTPException(status_code=502, detail="Feed alınamadı")
        if not feed_products:
            raise HTTPException(status_code=502, detail="Feed'de ürün bulunamadı")

        feed_ids = {p["id"] for p in feed_products if p.get("id")}
        existing = {}
        async for d in db.catalog_products.find({}, {"id": 1, "edited": 1, "_id": 0}):
            existing[d["id"]] = bool(d.get("edited"))
        now = datetime.now(timezone.utc).isoformat()
        ops = []
        added = updated = skipped = 0
        for p in feed_products:
            pid = p.get("id")
            if not pid:
                continue
            base = {k: p.get(k) for k in BASE_FIELDS}
            if pid not in existing:
                doc = {"id": pid, **base, "title_de": "", "description_de": "",
                       "product_type_de": "", "edited": False, "translated": False,
                       "in_export": False, "created_at": now, "updated_at": now}
                ops.append(InsertOne(doc))
                added += 1
            elif not existing[pid]:
                ops.append(UpdateOne({"id": pid}, {"$set": {**base, "updated_at": now}}))
                updated += 1
            else:
                skipped += 1
            if len(ops) >= 500:
                await db.catalog_products.bulk_write(ops, ordered=False)
                ops = []
        if ops:
            await db.catalog_products.bulk_write(ops, ordered=False)
        # remove stale products that are no longer in the feed AND were not manually edited
        removed = await db.catalog_products.delete_many(
            {"id": {"$nin": list(feed_ids)}, "edited": {"$ne": True}}
        )
        total = await db.catalog_products.count_documents({})
        return {"added": added, "updated": updated, "skipped": skipped,
                "removed": removed.deleted_count, "feed": len(feed_ids), "total": total}

    # ---------- edit / delete ----------
    @router.put("/products/{product_id}")
    async def update_product(product_id: str, body: UpdateProductBody, user=Depends(admin_user)):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="Güncellenecek alan yok")
        update["edited"] = True
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.catalog_products.update_one({"id": product_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı")
        return await db.catalog_products.find_one({"id": product_id}, {"_id": 0})

    @router.delete("/products/{product_id}")
    async def delete_product(product_id: str, user=Depends(admin_user)):
        await db.catalog_products.delete_one({"id": product_id})
        return {"ok": True}

    @router.post("/bulk-delete")
    async def bulk_delete(body: IdsBody, user=Depends(admin_user)):
        res = await db.catalog_products.delete_many({"id": {"$in": body.ids}})
        return {"deleted": res.deleted_count}

    # ---------- translate ----------
    @router.post("/translate")
    async def translate(body: IdsBody, user=Depends(admin_user)):
        if len(body.ids) > 20:
            raise HTTPException(status_code=400, detail="Tek seferde en fazla 20 ürün çevrilebilir")
        key = await _get_openai_key(db)
        if not key:
            raise HTTPException(status_code=500, detail="OpenAI API anahtarı ayarlanmamış")
        client = AsyncOpenAI(api_key=key)
        sem = asyncio.Semaphore(5)
        now = datetime.now(timezone.utc).isoformat()

        async def _one(pid: str):
            p = await db.catalog_products.find_one({"id": pid}, {"_id": 0})
            if not p:
                return None
            payload = {"title": p.get("title", ""), "description": p.get("description", ""),
                       "category": p.get("product_type", "")}
            system = (
                "You are a professional translator for an industrial kitchen equipment e-commerce store. "
                "Translate the values of title, description and category into German (Deutsch). "
                "Keep product codes, GTIN/MPN, numbers, dimensions and units (cm, mm, m, kg, g, W, kW, V, A, L, °C, Ø, %), "
                "brand and model names UNCHANGED. Return ONLY valid JSON of the exact form "
                "{\"title\": \"...\", \"description\": \"...\", \"category\": \"...\"}."
            )
            async with sem:
                try:
                    comp = await client.chat.completions.create(
                        model="gpt-4o-mini", temperature=0,
                        response_format={"type": "json_object"},
                        messages=[{"role": "system", "content": system},
                                  {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                    )
                    data = json.loads(comp.choices[0].message.content)
                except Exception as e:  # noqa: BLE001
                    logger.error(f"translate {pid} failed: {e}")
                    return {"id": pid, "ok": False}
            await db.catalog_products.update_one({"id": pid}, {"$set": {
                "title_de": str(data.get("title", "")).strip(),
                "description_de": str(data.get("description", "")).strip(),
                "product_type_de": str(data.get("category", "")).strip(),
                "translated": True, "edited": True, "updated_at": now,
            }})
            return {"id": pid, "ok": True}

        results = await asyncio.gather(*[_one(i) for i in body.ids])
        ok = [r["id"] for r in results if r and r.get("ok")]
        failed = [r["id"] for r in results if r and not r.get("ok")]
        return {"translated": len(ok), "failed": failed, "ok_ids": ok}

    # ---------- export flag ----------
    @router.post("/export/add")
    async def export_add(body: IdsBody, user=Depends(admin_user)):
        await db.catalog_products.update_many({"id": {"$in": body.ids}}, {"$set": {"in_export": True}})
        count = await db.catalog_products.count_documents({"in_export": True})
        return {"in_export": count}

    @router.post("/export/remove")
    async def export_remove(body: IdsBody, user=Depends(admin_user)):
        await db.catalog_products.update_many({"id": {"$in": body.ids}}, {"$set": {"in_export": False}})
        count = await db.catalog_products.count_documents({"in_export": True})
        return {"in_export": count}

    @router.get("/export/info")
    async def export_info(user=Depends(admin_user)):
        token = await _export_token()
        count = await db.catalog_products.count_documents({"in_export": True})
        return {"token": token, "path": f"/api/catalog/feed/{token}.xml", "count": count}

    # ---------- CSV export ----------
    @router.post("/export-csv")
    async def export_csv(body: IdsBody, user=Depends(admin_user)):
        prods = await db.catalog_products.find({"id": {"$in": body.ids}}, {"_id": 0}).to_list(len(body.ids) or 1)
        buf = io.StringIO()
        buf.write("\ufeff")  # UTF-8 BOM (ikas format)
        w = csv.writer(buf, quoting=csv.QUOTE_ALL)
        w.writerow(CSV_HEADER)
        for p in prods:
            row = [""] * len(CSV_HEADER)
            row[0] = p.get("id", "")
            row[2] = _de(p, "title")
            row[3] = _de(p, "description")
            row[4] = f"{p.get('price', 0)}"
            row[7] = p.get("mpn") or p.get("gtin") or ""
            row[8] = p.get("code", "")
            row[9] = "false"
            row[10] = p.get("brand", "")
            row[11] = _de(p, "product_type")
            row[13] = p.get("image", "")
            w.writerow(row)
        return Response(
            content=buf.getvalue().encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=katalog-urunler.csv"},
        )

    # ---------- PUBLIC XML feed (no auth) ----------
    @router.get("/feed/{token}.xml")
    async def public_feed(token: str):
        meta = await db.catalog_meta.find_one({"key": "export"})
        if not meta or meta.get("token") != token:
            raise HTTPException(status_code=404, detail="Feed bulunamadı")
        prods = await db.catalog_products.find({"in_export": True}, {"_id": 0}).sort("title", 1).to_list(100000)
        parts = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel>',
                 '<title>arigastro</title><link>https://arigastro.com/</link>',
                 '<description>Gastromek product feed</description>']
        for p in prods:
            e = xml_escape
            parts.append("<item>")
            parts.append(f"<g:id>{e(p.get('id',''))}</g:id>")
            parts.append(f"<g:title>{e(_de(p,'title'))}</g:title>")
            parts.append(f"<g:description>{e(_de(p,'description'))}</g:description>")
            parts.append(f"<g:link>{e(p.get('link',''))}</g:link>")
            if p.get("image"):
                parts.append(f"<g:image_link>{e(p['image'])}</g:image_link>")
            parts.append(f"<g:condition>{e(p.get('condition','new'))}</g:condition>")
            parts.append(f"<g:availability>{e(p.get('availability','in stock'))}</g:availability>")
            parts.append(f"<g:price>{p.get('price',0)}{e(p.get('currency','TRY'))}</g:price>")
            if p.get("brand"):
                parts.append(f"<g:brand>{e(p['brand'])}</g:brand>")
            parts.append(f"<g:product_type>{e(_de(p,'product_type'))}</g:product_type>")
            for img in (p.get("additional_images") or []):
                if img:
                    parts.append(f"<g:additional_image_link>{e(img)}</g:additional_image_link>")
            mpn = p.get("mpn") or p.get("gtin")
            if mpn:
                parts.append(f"<g:mpn>{e(mpn)}</g:mpn>")
            parts.append("</item>")
        parts.append("</channel></rss>")
        xml = "".join(parts)
        return Response(content=xml.encode("utf-8"), media_type="application/xml; charset=utf-8")

    return router
