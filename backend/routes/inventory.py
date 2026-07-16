"""Inventory (Envanter) module.

A fully INDEPENDENT warehouse/stock list (collection: inventory_products).
Not synced from the feed and not linked to catalog_products or products/quotes:
editing/deleting here never affects any other module. Products can be copied in
from the Catalog (only name/image/sale price; purchase price & stock left empty).
Admin-only.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel

from auth import get_current_user_from_request

logger = logging.getLogger("inventory")


class InventoryBody(BaseModel):
    name: Optional[str] = None
    image: Optional[str] = None
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    stock: Optional[float] = None
    currency: Optional[str] = None


class IdsBody(BaseModel):
    ids: List[str]


def build_inventory_router(db):
    router = APIRouter(prefix="/inventory", tags=["inventory"])

    async def admin_user(request: Request):
        user = await get_current_user_from_request(request, db)
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Yetkiniz yok")
        return user

    @router.get("")
    async def list_products(
        search: str = Query(""),
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=200),
        user=Depends(admin_user),
    ):
        q: dict = {}
        if search:
            q["name"] = {"$regex": search, "$options": "i"}
        total = await db.inventory_products.count_documents(q)
        skip = (page - 1) * page_size
        items = await db.inventory_products.find(q, {"_id": 0}).sort(
            "created_at", -1
        ).skip(skip).limit(page_size).to_list(page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.post("")
    async def create_product(body: InventoryBody, user=Depends(admin_user)):
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": uuid.uuid4().hex,
            "name": (body.name or "").strip(),
            "image": (body.image or "").strip(),
            "purchase_price": body.purchase_price,
            "sale_price": body.sale_price,
            "stock": body.stock,
            "currency": (body.currency or "TRY").upper(),
            "created_at": now,
            "updated_at": now,
        }
        await db.inventory_products.insert_one(dict(doc))
        return doc

    @router.put("/{product_id}")
    async def update_product(product_id: str, body: InventoryBody, user=Depends(admin_user)):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if "currency" in update:
            update["currency"] = str(update["currency"]).upper()
        if not update:
            raise HTTPException(status_code=400, detail="Güncellenecek alan yok")
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.inventory_products.update_one({"id": product_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı")
        return await db.inventory_products.find_one({"id": product_id}, {"_id": 0})

    @router.delete("/{product_id}")
    async def delete_product(product_id: str, user=Depends(admin_user)):
        await db.inventory_products.delete_one({"id": product_id})
        return {"ok": True}

    @router.post("/bulk-delete")
    async def bulk_delete(body: IdsBody, user=Depends(admin_user)):
        res = await db.inventory_products.delete_many({"id": {"$in": body.ids}})
        return {"deleted": res.deleted_count}

    @router.post("/from-catalog")
    async def from_catalog(body: IdsBody, user=Depends(admin_user)):
        prods = await db.catalog_products.find(
            {"id": {"$in": body.ids}}, {"_id": 0}
        ).to_list(len(body.ids) or 1)
        now = datetime.now(timezone.utc).isoformat()
        added = skipped = 0
        for p in prods:
            src = p.get("id")
            # dedupe: skip if this catalog product was already moved in
            if src and await db.inventory_products.find_one({"catalog_source_id": src}, {"_id": 1}):
                skipped += 1
                continue
            doc = {
                "id": uuid.uuid4().hex,
                "catalog_source_id": src,
                "name": (p.get("title_de") or p.get("title") or "").strip(),
                "image": p.get("image") or "",
                "purchase_price": None,
                "sale_price": p.get("price"),
                "stock": None,
                "currency": (p.get("currency") or "TRY").upper(),
                "created_at": now,
                "updated_at": now,
            }
            await db.inventory_products.insert_one(dict(doc))
            added += 1
        total = await db.inventory_products.count_documents({})
        return {"added": added, "skipped": skipped, "total": total}

    return router
