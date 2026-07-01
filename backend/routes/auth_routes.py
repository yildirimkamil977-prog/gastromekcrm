"""Auth endpoints."""
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from models import LoginRequest
from auth import (
    verify_password,
    create_access_token,
    create_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    get_current_user_from_request,
)


def build_auth_router(db):
    router = APIRouter(prefix="/auth", tags=["auth"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    @router.post("/login")
    async def login(body: LoginRequest, request: Request, response: Response):
        email = body.email.lower().strip()

        user = await db.users.find_one({"email": email}, {"_id": 0})
        ok = user is not None and verify_password(body.password, user.get("password_hash", ""))

        if not ok:
            raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")

        access = create_access_token(user["id"], user["email"], user["role"])
        refresh = create_refresh_token(user["id"])
        set_auth_cookies(response, access, refresh)
        user.pop("password_hash", None)
        return {"user": user, "access_token": access}

    @router.post("/logout")
    async def logout(response: Response, user=Depends(current_user)):
        clear_auth_cookies(response)
        return {"ok": True}

    @router.get("/me")
    async def me(user=Depends(current_user)):
        return user

    return router
