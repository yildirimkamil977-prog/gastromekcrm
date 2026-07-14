"""Company settings endpoints (admin only for writes, readable by all)."""
from fastapi import APIRouter, Request, Depends
from models import CompanySettings
from auth import get_current_user_from_request, require_admin

SETTINGS_KEY = "company"


def _sanitize_for_sales(data: dict) -> dict:
    """Remove sensitive keys when sales role reads settings."""
    sensitive = {"resend_api_key", "smtp_password", "openai_api_key"}
    return {k: v for k, v in data.items() if k not in sensitive}


async def get_settings_doc(db) -> dict:
    doc = await db.settings.find_one({"key": SETTINGS_KEY}, {"_id": 0})
    defaults = CompanySettings().model_dump()
    if not doc:
        defaults["key"] = SETTINGS_KEY
        await db.settings.insert_one(defaults)
        defaults.pop("_id", None)
        return defaults
    # merge new default fields that don't exist on existing doc
    missing = {k: v for k, v in defaults.items() if k not in doc}
    if missing:
        await db.settings.update_one({"key": SETTINGS_KEY}, {"$set": missing})
        doc.update(missing)
    # migrate legacy single bank → banks[0]
    if (not doc.get("banks")) and (doc.get("bank_name") or doc.get("bank_iban")):
        migrated = [{
            "name": doc.get("bank_name", ""),
            "account_holder": doc.get("bank_account_holder", ""),
            "iban": doc.get("bank_iban", ""),
            "currency": "TRY",
        }]
        await db.settings.update_one({"key": SETTINGS_KEY}, {"$set": {"banks": migrated}})
        doc["banks"] = migrated
    return doc


def build_settings_router(db):
    router = APIRouter(prefix="/settings", tags=["settings"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    @router.get("")
    async def read_settings(user=Depends(current_user)):
        doc = await get_settings_doc(db)
        doc.pop("key", None)
        if user["role"] != "admin":
            doc = _sanitize_for_sales(doc)
        return doc

    @router.put("")
    async def update_settings(body: CompanySettings, user=Depends(current_user)):
        require_admin(user)
        data = body.model_dump()
        # clean banks: drop empties, cap at 3
        clean_banks = []
        for b in (data.get("banks") or []):
            name = (b.get("name") or "").strip()
            iban = (b.get("iban") or "").strip()
            holder = (b.get("account_holder") or "").strip()
            if name or iban or holder:
                clean_banks.append({
                    "name": name,
                    "account_holder": holder,
                    "iban": iban,
                    "currency": b.get("currency") or "TRY",
                })
        data["banks"] = clean_banks[:3]
        data["key"] = SETTINGS_KEY
        await db.settings.update_one(
            {"key": SETTINGS_KEY}, {"$set": data}, upsert=True
        )
        data.pop("key", None)
        return data

    return router
