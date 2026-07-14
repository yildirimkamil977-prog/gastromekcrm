"""Gastromek CRM - FastAPI backend"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import asyncio
import os
import logging
import traceback
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import hash_password, verify_password
from models import uid
from routes.auth_routes import build_auth_router
from routes.users import build_users_router
from routes.customers import build_customers_router
from routes.products import build_products_router
from routes.quotes import build_quotes_router, build_public_pdf_router
from routes.settings import build_settings_router, get_settings_doc
from routes.uploads import build_uploads_router, build_image_proxy_router
from routes.accounting import build_accounting_router
from routes.projects import build_projects_router
from routes.translate import build_translate_router
from feed_sync import start_daily_scheduler, sync_products

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, maxPoolSize=50, retryWrites=True)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Gastromek CRM API", version="1.0")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "Gastromek CRM", "status": "ok"}


@api_router.get("/health")
async def health():
    """Health check for external monitors (UptimeRobot, etc.)."""
    try:
        await db.command("ping")
        return {"status": "healthy", "db": "ok", "at": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "error": str(e)[:200]})


# register routers
api_router.include_router(build_auth_router(db))
api_router.include_router(build_users_router(db))
api_router.include_router(build_customers_router(db))
api_router.include_router(build_products_router(db))
api_router.include_router(build_quotes_router(db))
api_router.include_router(build_public_pdf_router(db))
api_router.include_router(build_settings_router(db))
api_router.include_router(build_uploads_router(db))
api_router.include_router(build_image_proxy_router())
api_router.include_router(build_accounting_router(db))
api_router.include_router(build_projects_router(db))
api_router.include_router(build_translate_router(db))
app.include_router(api_router)

# CORS
cors_origins_raw = os.environ.get("CORS_ORIGINS", "*")
cors_origins = ["*"] if cors_origins_raw.strip() == "*" else cors_origins_raw.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_origin_regex=r"https?://.*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Global safety net: log stack, return sanitized 500 so secrets never leak."""
    logger.error(
        "Unhandled error on %s %s: %s\n%s",
        request.method, request.url.path, exc, traceback.format_exc()[-2000:],
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Beklenmedik bir hata oluştu. Lütfen tekrar deneyin."},
    )


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@arigastro.com").lower().strip()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    name = os.environ.get("ADMIN_NAME", "Sistem Yöneticisi")
    existing = await db.users.find_one({"email": email})
    now = datetime.now(timezone.utc).isoformat()
    if existing is None:
        await db.users.insert_one({
            "id": uid(),
            "email": email,
            "name": name,
            "role": "admin",
            "password_hash": hash_password(password),
            "created_at": now,
        })
        logger.info(f"Admin user seeded: {email}")
    else:
        if not verify_password(password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": email},
                {"$set": {"password_hash": hash_password(password), "role": "admin", "name": name}},
            )
            logger.info("Admin password updated from .env")


async def ensure_indexes():
    """Create all indexes. Idempotent."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.customers.create_index("id", unique=True)
    await db.customers.create_index("company_name")
    await db.customers.create_index("tax_number")
    await db.customers.create_index("created_at")
    await db.products.create_index("id", unique=True)
    await db.products.create_index("code")
    await db.products.create_index([("title", "text"), ("code", "text")])
    await db.quotes.create_index("id", unique=True)
    await db.quotes.create_index("quote_no", unique=True)
    await db.quotes.create_index("customer_id")
    await db.quotes.create_index("created_by")
    await db.quotes.create_index("status")
    await db.quotes.create_index("created_at")
    await db.quotes.create_index("valid_until")

    await db.transactions.create_index("id", unique=True)
    await db.transactions.create_index("kind")
    await db.transactions.create_index("date")
    await db.transactions.create_index("created_at")

    await db.projects.create_index("id", unique=True)
    await db.projects.create_index("customer_id")
    await db.projects.create_index("created_at")
    await db.project_incomes.create_index("id", unique=True)
    await db.project_incomes.create_index("project_id")
    await db.project_expenses.create_index("id", unique=True)
    await db.project_expenses.create_index("project_id")

    # TTL indexes — auto-cleanup to prevent unbounded growth
    # Login attempts: auto-delete after 1 hour
    try:
        await db.login_attempts.create_index("at_dt", expireAfterSeconds=3600)
    except Exception:
        pass
    # Quote share links: auto-delete after 90 days
    try:
        await db.quote_shares.create_index("created_dt", expireAfterSeconds=90 * 86400)
    except Exception:
        pass
    # Sync logs: keep 60 days
    try:
        await db.sync_logs.create_index("at_dt", expireAfterSeconds=60 * 86400)
    except Exception:
        pass
    # Email logs: keep 1 year
    try:
        await db.email_logs.create_index("at_dt", expireAfterSeconds=365 * 86400)
    except Exception:
        pass


async def auto_expire_quotes_loop():
    """Every 1h, mark quotes as 'suresi_doldu' if valid_until < today and status is sent/draft."""
    while True:
        try:
            today_iso = datetime.now(timezone.utc).date().isoformat()
            res = await db.quotes.update_many(
                {
                    "status": {"$in": ["taslak", "gonderildi"]},
                    "valid_until": {"$lt": today_iso},
                },
                {"$set": {"status": "suresi_doldu", "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            if res.modified_count:
                logger.info(f"Auto-expired {res.modified_count} quote(s)")
        except Exception:
            logger.exception("auto-expire loop error")
        await asyncio.sleep(3600)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_admin()
    await get_settings_doc(db)
    # background tasks
    await start_daily_scheduler(db)
    asyncio.create_task(auto_expire_quotes_loop())
    logger.info("Gastromek CRM API started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
