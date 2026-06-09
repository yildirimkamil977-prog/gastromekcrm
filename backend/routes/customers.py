"""Customer endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from models import CustomerCreate, uid
from auth import get_current_user_from_request


def build_customers_router(db):
    router = APIRouter(prefix="/customers", tags=["customers"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    @router.get("")
    async def list_customers(
        search: str = Query("", description="İsim, vergi no, telefon veya email ara"),
        city: str = Query(""),
        date_from: str = Query(""),
        date_to: str = Query(""),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=200),
        user=Depends(current_user),
    ):
        q: dict = {}
        if search:
            q["$or"] = [
                {"company_name": {"$regex": search, "$options": "i"}},
                {"tax_number": {"$regex": search, "$options": "i"}},
                {"contact_person": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
            ]
        if city:
            q["city"] = {"$regex": city, "$options": "i"}
        if date_from:
            q.setdefault("created_at", {})["$gte"] = date_from
        if date_to:
            q.setdefault("created_at", {})["$lte"] = date_to + "T23:59:59"
        total = await db.customers.count_documents(q)
        skip = (page - 1) * page_size
        items = await db.customers.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.get("/{customer_id}")
    async def get_customer(customer_id: str, user=Depends(current_user)):
        c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
        return c

    @router.post("")
    async def create_customer(body: CustomerCreate, user=Depends(current_user)):
        now = datetime.now(timezone.utc).isoformat()
        doc = body.model_dump()
        doc["id"] = uid()
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.customers.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.put("/{customer_id}")
    async def update_customer(customer_id: str, body: CustomerCreate, user=Depends(current_user)):
        update = body.model_dump()
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = await db.customers.update_one({"id": customer_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
        c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        return c

    @router.delete("/{customer_id}")
    async def delete_customer(
        customer_id: str,
        force: bool = Query(False, description="True: teklifleri dahil cascade sil"),
        user=Depends(current_user),
    ):
        quote_count = await db.quotes.count_documents({"customer_id": customer_id})
        if quote_count > 0 and not force:
            raise HTTPException(
                status_code=409,
                detail=f"Bu müşterinin {quote_count} adet teklifi var. Silmek için onayınız gerekir.",
            )
        if quote_count > 0:
            await db.quotes.delete_many({"customer_id": customer_id})
        res = await db.customers.delete_one({"id": customer_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
        return {"ok": True, "deleted_quotes": quote_count}

    @router.get("/{customer_id}/quotes")
    async def customer_quotes(customer_id: str, user=Depends(current_user)):
        items = await db.quotes.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
        creator_ids = list({q.get("created_by") for q in items if q.get("created_by")})
        if creator_ids:
            creator_map = {
                u["id"]: u
                for u in await db.users.find(
                    {"id": {"$in": creator_ids}},
                    {"_id": 0, "id": 1, "name": 1},
                ).to_list(len(creator_ids))
            }
            for q in items:
                q["creator"] = creator_map.get(q.get("created_by"))
        return items

    return router
