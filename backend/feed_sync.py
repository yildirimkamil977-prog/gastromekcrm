"""Myikas Google Shopping feed sync."""
import os
import re
import asyncio
import logging
from datetime import datetime, timezone
import httpx
from lxml import etree

logger = logging.getLogger(__name__)

NS = {"g": "http://base.google.com/ns/1.0"}

# Description içinde "Ürün Kodu: XYZ" / "Model Kodu: XYZ" / "Stok Kodu: XYZ"
# gibi etiketli alanlardan çek. Kod sonrası bir başka etiket ("Boyutlar:",
# "Kapasite:", vs.) veya yeni satır ile sınırlandırılır.
LABEL_CODE_RE = re.compile(
    r"(?:Ür[üu]n\s*Kodu|Model\s*Kodu|Stok\s*Kodu|Ürün\s*Kod|Product\s*Code)\s*[:：]?\s*"
    r"([A-Z0-9][A-Z0-9.\-_/ ]{1,40}?)"
    r"(?=\s*(?:\n|\t|\r|$|[A-ZÇĞİÖŞÜa-zçğıöşü][\wçğıöşüÇĞİÖŞÜ ]{2,30}\s*[:：]))",
    re.IGNORECASE | re.UNICODE,
)

# Başlıkta geçen model numarası (ör. "Eka MKL-1064S", "Brema CB 184", "X580C").
# Harfle başlar, en az 2 rakam içerir, isteğe bağlı son ek harfler/rakamlar.
TITLE_MODEL_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,3}[- ]?\d{2,5}[A-Z0-9]{0,6})\b")


def _txt(el, tag: str) -> str:
    found = el.find(f"g:{tag}", NS)
    if found is not None and found.text:
        return found.text.strip()
    return ""


def _parse_price(raw: str):
    """Parse '18966.30TRY' -> (18966.30, 'TRY')."""
    if not raw:
        return 0.0, "TRY"
    m = re.match(r"([\d]+(?:[.,]\d+)?)\s*([A-Z]{3})?", raw.strip())
    if not m:
        return 0.0, "TRY"
    try:
        price = float(m.group(1).replace(",", "."))
    except ValueError:
        price = 0.0
    currency = (m.group(2) or "TRY").upper()
    return price, currency


def _extract_code(description: str, gtin: str, title: str) -> str:
    """Extract product code with a multi-strategy approach:
    1. Explicit label in description ("Ürün Kodu: XYZ", "Stok Kodu: XYZ", ...)
    2. Model pattern in the title ("Eka MKL-1064S" → "MKL-1064S")
    3. Fall back to GTIN/barcode if nothing else is found
    """
    import html
    txt = html.unescape(description or "")

    m = LABEL_CODE_RE.search(txt)
    if m:
        code = re.sub(r"\s+", " ", m.group(1)).strip().rstrip(".,-")
        if 2 <= len(code) <= 40:
            return code

    m = TITLE_MODEL_RE.search(title or "")
    if m:
        return m.group(1).strip()

    if gtin:
        return gtin
    return ""


def parse_feed_xml(xml_bytes: bytes) -> list[dict]:
    root = etree.fromstring(xml_bytes)
    items = root.findall(".//item")
    parsed: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()
    for el in items:
        pid = _txt(el, "id")
        title = _txt(el, "title")
        description = _txt(el, "description")
        link = _txt(el, "link")
        image = _txt(el, "image_link")
        brand = _txt(el, "brand")
        ptype = _txt(el, "product_type")
        gtin = _txt(el, "gtin")
        mpn = _txt(el, "mpn")
        condition = _txt(el, "condition") or "new"
        availability = _txt(el, "availability") or "in stock"
        price_raw = _txt(el, "price")
        price, currency = _parse_price(price_raw)

        # additional images (there can be multiple)
        additional = [
            (x.text or "").strip()
            for x in el.findall("g:additional_image_link", NS)
            if x is not None and x.text
        ]

        code = _extract_code(description, gtin, title)

        parsed.append({
            "id": pid,
            "code": code,
            "title": title,
            "description": description,
            "link": link,
            "image": image,
            "additional_images": additional,
            "price": price,
            "currency": currency,
            "brand": brand,
            "product_type": ptype,
            "gtin": gtin,
            "mpn": mpn,
            "condition": condition,
            "availability": availability,
            "synced_at": now,
        })
    return parsed


async def fetch_feed(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def sync_products(db) -> dict:
    url = os.environ.get("PRODUCT_FEED_URL", "")
    if not url:
        return {"success": False, "error": "PRODUCT_FEED_URL tanımlı değil", "count": 0}
    try:
        xml_bytes = await fetch_feed(url)
        products = parse_feed_xml(xml_bytes)
        if not products:
            return {"success": False, "error": "Feed'de ürün bulunamadı", "count": 0}
        # upsert each
        ops = 0
        for p in products:
            await db.products.update_one(
                {"id": p["id"]},
                {"$set": p},
                upsert=True,
            )
            ops += 1
        # record sync info
        await db.sync_logs.insert_one({
            "type": "products_feed",
            "count": ops,
            "at": datetime.now(timezone.utc).isoformat(),
            "at_dt": datetime.now(timezone.utc),
            "success": True,
        })
        logger.info(f"Product feed sync complete: {ops} products")
        return {"success": True, "count": ops, "synced_at": products[0]["synced_at"]}
    except Exception as e:
        logger.exception("Feed sync failed")
        await db.sync_logs.insert_one({
            "type": "products_feed",
            "count": 0,
            "at": datetime.now(timezone.utc).isoformat(),
            "at_dt": datetime.now(timezone.utc),
            "success": False,
            "error": str(e),
        })
        return {"success": False, "error": str(e), "count": 0}


async def start_daily_scheduler(db):
    """Run feed sync immediately once, then every 24 hours."""
    async def _loop():
        # initial sync (non-blocking to startup)
        await asyncio.sleep(5)
        try:
            await sync_products(db)
        except Exception:
            logger.exception("Initial feed sync failed")
        while True:
            await asyncio.sleep(24 * 3600)
            try:
                await sync_products(db)
            except Exception:
                logger.exception("Scheduled feed sync failed")

    asyncio.create_task(_loop())
