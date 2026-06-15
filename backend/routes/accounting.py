"""Accounting (income / expense) endpoints.

Access is controlled by the `accounting_visible_roles` setting; admins always
have access.
"""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends, Query

from models import TransactionCreate, TransactionUpdate, uid, INCOME_CATEGORIES, EXPENSE_CATEGORIES
from auth import get_current_user_from_request
from routes.settings import get_settings_doc


def _validate(kind: str, category: str):
    if kind not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="Geçersiz tür")
    cats = INCOME_CATEGORIES if kind == "income" else EXPENSE_CATEGORIES
    if category not in cats:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")


def build_accounting_router(db):
    router = APIRouter(prefix="/accounting", tags=["accounting"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    async def ensure_access(user: dict):
        if user.get("role") == "admin":
            return
        settings = await get_settings_doc(db)
        allowed = settings.get("accounting_visible_roles") or ["admin", "sales", "muhasebe"]
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Bu sayfaya erişim yetkiniz yok")

    def _build_filter(kind, search, cats, date_from, date_to, owner=""):
        q = {}
        if kind in ("income", "expense"):
            q["kind"] = kind
        if owner:
            q["owner_id"] = owner
        if date_from or date_to:
            dr = {}
            if date_from:
                dr["$gte"] = date_from
            if date_to:
                dr["$lte"] = date_to
            q["date"] = dr
        ors = []
        if search:
            ors.append({"description": {"$regex": re.escape(search), "$options": "i"}})
        if cats:
            ors.append({"category": {"$in": cats}})
        if ors:
            q["$or"] = ors
        return q

    @router.get("")
    async def list_tx(
        kind: str = Query(""),
        search: str = Query(""),
        cats: str = Query(""),
        date_from: str = Query(""),
        date_to: str = Query(""),
        owner: str = Query(""),
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=200),
        user=Depends(current_user),
    ):
        await ensure_access(user)
        cats_list = [c for c in cats.split(",") if c] if cats else []
        q = _build_filter(kind, search, cats_list, date_from, date_to, owner)
        total = await db.transactions.count_documents(q)
        skip = (page - 1) * page_size
        items = (
            await db.transactions.find(q, {"_id": 0})
            .sort([("date", -1), ("created_at", -1)])
            .skip(skip)
            .limit(page_size)
            .to_list(page_size)
        )
        uids = set()
        for t in items:
            if t.get("created_by"):
                uids.add(t["created_by"])
            if t.get("owner_id"):
                uids.add(t["owner_id"])
        umap = {}
        if uids:
            umap = {
                u["id"]: u
                for u in await db.users.find(
                    {"id": {"$in": list(uids)}}, {"_id": 0, "id": 1, "name": 1}
                ).to_list(len(uids))
            }
        for t in items:
            t["creator"] = umap.get(t.get("created_by"))
            t["owner"] = umap.get(t.get("owner_id"))
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.get("/stats")
    async def stats(
        search: str = Query(""),
        cats: str = Query(""),
        date_from: str = Query(""),
        date_to: str = Query(""),
        owner: str = Query(""),
        user=Depends(current_user),
    ):
        await ensure_access(user)
        cats_list = [c for c in cats.split(",") if c] if cats else []
        base = _build_filter("", search, cats_list, date_from, date_to, owner)

        totals = {"income": 0.0, "expense": 0.0}
        async for r in db.transactions.aggregate(
            [{"$match": base}, {"$group": {"_id": "$kind", "sum": {"$sum": "$amount"}}}]
        ):
            if r["_id"] in totals:
                totals[r["_id"]] = round(r["sum"], 2)

        monthly_map = {}
        async for r in db.transactions.aggregate([
            {"$match": base},
            {"$group": {
                "_id": {"m": {"$substr": ["$date", 0, 7]}, "k": "$kind"},
                "sum": {"$sum": "$amount"},
            }},
        ]):
            m = r["_id"]["m"]
            k = r["_id"]["k"]
            bucket = monthly_map.setdefault(m, {"month": m, "income": 0.0, "expense": 0.0})
            if k in ("income", "expense"):
                bucket[k] = round(r["sum"], 2)
        monthly = sorted(monthly_map.values(), key=lambda x: x["month"])

        return {
            "total_income": totals["income"],
            "total_expense": totals["expense"],
            "net": round(totals["income"] - totals["expense"], 2),
            "monthly": monthly,
        }

    @router.post("")
    async def create_tx(body: TransactionCreate, user=Depends(current_user)):
        await ensure_access(user)
        _validate(body.kind, body.category)
        now = datetime.now(timezone.utc).isoformat()
        doc = body.model_dump()
        doc["id"] = uid()
        doc["amount"] = round(float(body.amount), 2)
        doc["currency"] = "EUR"
        doc["description"] = (body.description or "").strip()
        doc["owner_id"] = body.owner_id or user["id"]
        doc["created_by"] = user["id"]
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.transactions.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.put("/{tx_id}")
    async def update_tx(tx_id: str, body: TransactionUpdate, user=Depends(current_user)):
        await ensure_access(user)
        existing = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        merged = {**existing, **update}
        _validate(merged["kind"], merged["category"])
        if "amount" in update:
            update["amount"] = round(float(update["amount"]), 2)
        if "description" in update:
            update["description"] = (update["description"] or "").strip()
        update["currency"] = "EUR"
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.transactions.update_one({"id": tx_id}, {"$set": update})
        return await db.transactions.find_one({"id": tx_id}, {"_id": 0})

    @router.delete("/{tx_id}")
    async def delete_tx(tx_id: str, user=Depends(current_user)):
        await ensure_access(user)
        res = await db.transactions.delete_one({"id": tx_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
        return {"ok": True}

    return router
