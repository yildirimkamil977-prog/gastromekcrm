"""User management (admin only)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends
from models import UserCreate, UserUpdate, uid
from auth import hash_password, get_current_user_from_request, require_admin


def build_users_router(db):
    router = APIRouter(prefix="/users", tags=["users"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    @router.get("")
    async def list_users(user=Depends(current_user)):
        # All authenticated users can list users (for "Hazırlayan" filter on Quotes page).
        # Write operations below remain admin-only.
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
        return users

    @router.post("")
    async def create_user(body: UserCreate, user=Depends(current_user)):
        require_admin(user)
        email = body.email.lower().strip()
        exists = await db.users.find_one({"email": email})
        if exists:
            raise HTTPException(status_code=400, detail="Bu e-posta ile kullanıcı zaten var")
        if body.role not in ("admin", "sales", "muhasebe"):
            raise HTTPException(status_code=400, detail="Geçersiz rol")
        doc = {
            "id": uid(),
            "email": email,
            "name": body.name,
            "role": body.role,
            "password_hash": hash_password(body.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        doc.pop("password_hash")
        doc.pop("_id", None)
        return doc

    @router.put("/{user_id}")
    async def update_user(user_id: str, body: UserUpdate, user=Depends(current_user)):
        require_admin(user)
        update = {}
        if body.email is not None:
            update["email"] = body.email.lower().strip()
        if body.name is not None:
            update["name"] = body.name
        if body.role is not None:
            if body.role not in ("admin", "sales", "muhasebe"):
                raise HTTPException(status_code=400, detail="Geçersiz rol")
            update["role"] = body.role
        if body.password:
            update["password_hash"] = hash_password(body.password)
        if not update:
            raise HTTPException(status_code=400, detail="Güncellenecek alan yok")
        res = await db.users.update_one({"id": user_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        return u

    @router.delete("/{user_id}")
    async def delete_user(user_id: str, user=Depends(current_user)):
        require_admin(user)
        if user_id == user["id"]:
            raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
        res = await db.users.delete_one({"id": user_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        return {"ok": True}

    return router
