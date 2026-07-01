"""Projects module — independent from the Accounting (transactions) module.

Uses its own collections: projects, project_incomes, project_expenses.
Each project tracks its own incomes and expenses (with installment payments),
and computes remaining receivable, per-expense paid/remaining, and profit.
"""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends, Query

from models import (
    ProjectCreate, ProjectUpdate,
    ProjectIncomeCreate, ProjectIncomeUpdate,
    ProjectExpenseCreate, ProjectExpenseUpdate,
    ProjectPaymentCreate,
    uid,
)
from auth import get_current_user_from_request
from routes.settings import get_settings_doc


def _round(v):
    return round(float(v or 0), 2)


def _expense_totals(exp: dict) -> dict:
    payments = exp.get("payments", []) or []
    paid = sum(float(p.get("amount", 0) or 0) for p in payments)
    debt = float(exp.get("total_debt", 0) or 0)
    exp["paid"] = _round(paid)
    exp["remaining"] = _round(debt - paid)
    exp["payments_count"] = len(payments)
    return exp


def build_projects_router(db):
    router = APIRouter(prefix="/projects", tags=["projects"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    async def ensure_access(user: dict):
        if user.get("role") == "admin":
            return
        settings = await get_settings_doc(db)
        allowed = settings.get("projects_visible_roles") or ["admin", "sales", "muhasebe"]
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Bu sayfaya erişim yetkiniz yok")

    async def _get_project(project_id: str) -> dict:
        p = await db.projects.find_one({"id": project_id}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Proje bulunamadı")
        return p

    # ---- Projects list & CRUD ----
    @router.get("")
    async def list_projects(search: str = Query(""), user=Depends(current_user)):
        await ensure_access(user)
        q = {}
        if search:
            q["name"] = {"$regex": re.escape(search), "$options": "i"}
        projects = await db.projects.find(q, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
        if not projects:
            return {"items": []}

        pids = [p["id"] for p in projects]
        cust_ids = list({p.get("customer_id") for p in projects if p.get("customer_id")})
        cmap = {}
        if cust_ids:
            cmap = {
                c["id"]: c
                for c in await db.customers.find(
                    {"id": {"$in": cust_ids}}, {"_id": 0, "id": 1, "company_name": 1}
                ).to_list(len(cust_ids))
            }
        # income totals
        inc_map = {}
        async for r in db.project_incomes.aggregate([
            {"$match": {"project_id": {"$in": pids}}},
            {"$group": {"_id": "$project_id", "sum": {"$sum": "$amount"}}},
        ]):
            inc_map[r["_id"]] = _round(r["sum"])
        # expense debt totals
        exp_map = {}
        async for r in db.project_expenses.aggregate([
            {"$match": {"project_id": {"$in": pids}}},
            {"$group": {"_id": "$project_id", "sum": {"$sum": "$total_debt"}}},
        ]):
            exp_map[r["_id"]] = _round(r["sum"])

        for p in projects:
            amount = float(p.get("amount", 0) or 0)
            income_total = inc_map.get(p["id"], 0.0)
            expense_debt = exp_map.get(p["id"], 0.0)
            p["customer"] = cmap.get(p.get("customer_id"))
            p["income_total"] = income_total
            p["remaining_receivable"] = _round(amount - income_total)
            p["expense_debt_total"] = expense_debt
            p["profit"] = _round(amount - expense_debt)
        return {"items": projects}

    @router.post("")
    async def create_project(body: ProjectCreate, user=Depends(current_user)):
        await ensure_access(user)
        if not await db.customers.find_one({"id": body.customer_id}, {"_id": 1}):
            raise HTTPException(status_code=400, detail="Müşteri bulunamadı")
        now = datetime.now(timezone.utc).isoformat()
        doc = body.model_dump()
        doc["id"] = uid()
        doc["amount"] = _round(body.amount)
        doc["created_by"] = user["id"]
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.projects.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/{project_id}")
    async def get_project_detail(project_id: str, user=Depends(current_user)):
        await ensure_access(user)
        p = await _get_project(project_id)
        customer = None
        if p.get("customer_id"):
            customer = await db.customers.find_one({"id": p["customer_id"]}, {"_id": 0})
        incomes = await db.project_incomes.find(
            {"project_id": project_id}, {"_id": 0}
        ).sort("date", -1).to_list(1000)
        expenses = await db.project_expenses.find(
            {"project_id": project_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
        for e in expenses:
            e.setdefault("payments", [])
            e["payments"] = sorted(e["payments"], key=lambda x: x.get("date", ""), reverse=True)
            _expense_totals(e)

        amount = float(p.get("amount", 0) or 0)
        income_total = _round(sum(float(i.get("amount", 0) or 0) for i in incomes))
        expense_debt_total = _round(sum(float(e.get("total_debt", 0) or 0) for e in expenses))
        expense_paid_total = _round(sum(e.get("paid", 0) for e in expenses))
        return {
            "project": p,
            "customer": customer,
            "incomes": incomes,
            "expenses": expenses,
            "summary": {
                "amount": _round(amount),
                "currency": p.get("currency", "EUR"),
                "income_total": income_total,
                "remaining_receivable": _round(amount - income_total),
                "expense_debt_total": expense_debt_total,
                "expense_paid_total": expense_paid_total,
                "expense_remaining_total": _round(expense_debt_total - expense_paid_total),
                "profit": _round(amount - expense_debt_total),
            },
        }

    @router.put("/{project_id}")
    async def update_project(project_id: str, body: ProjectUpdate, user=Depends(current_user)):
        await ensure_access(user)
        await _get_project(project_id)
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if "amount" in update:
            update["amount"] = _round(update["amount"])
        if update.get("customer_id") and not await db.customers.find_one({"id": update["customer_id"]}, {"_id": 1}):
            raise HTTPException(status_code=400, detail="Müşteri bulunamadı")
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.projects.update_one({"id": project_id}, {"$set": update})
        return await db.projects.find_one({"id": project_id}, {"_id": 0})

    @router.delete("/{project_id}")
    async def delete_project(project_id: str, user=Depends(current_user)):
        await ensure_access(user)
        await _get_project(project_id)
        await db.project_incomes.delete_many({"project_id": project_id})
        await db.project_expenses.delete_many({"project_id": project_id})
        await db.projects.delete_one({"id": project_id})
        return {"ok": True}

    # ---- Incomes ----
    @router.post("/{project_id}/incomes")
    async def add_income(project_id: str, body: ProjectIncomeCreate, user=Depends(current_user)):
        await ensure_access(user)
        await _get_project(project_id)
        now = datetime.now(timezone.utc).isoformat()
        doc = body.model_dump()
        doc["id"] = uid()
        doc["project_id"] = project_id
        doc["amount"] = _round(body.amount)
        doc["note"] = (body.note or "").strip()
        doc["created_by"] = user["id"]
        doc["created_at"] = now
        await db.project_incomes.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.put("/{project_id}/incomes/{income_id}")
    async def update_income(project_id: str, income_id: str, body: ProjectIncomeUpdate, user=Depends(current_user)):
        await ensure_access(user)
        existing = await db.project_incomes.find_one({"id": income_id, "project_id": project_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Gelir bulunamadı")
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if "amount" in update:
            update["amount"] = _round(update["amount"])
        await db.project_incomes.update_one({"id": income_id}, {"$set": update})
        return await db.project_incomes.find_one({"id": income_id}, {"_id": 0})

    @router.delete("/{project_id}/incomes/{income_id}")
    async def delete_income(project_id: str, income_id: str, user=Depends(current_user)):
        await ensure_access(user)
        res = await db.project_incomes.delete_one({"id": income_id, "project_id": project_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Gelir bulunamadı")
        return {"ok": True}

    # ---- Expenses ----
    @router.post("/{project_id}/expenses")
    async def add_expense(project_id: str, body: ProjectExpenseCreate, user=Depends(current_user)):
        await ensure_access(user)
        await _get_project(project_id)
        now = datetime.now(timezone.utc).isoformat()
        payments = []
        if body.initial_payment and float(body.initial_payment.amount or 0) > 0:
            ip = body.initial_payment
            payments.append({
                "id": uid(),
                "amount": _round(ip.amount),
                "currency": ip.currency or body.currency,
                "date": ip.date,
                "note": (ip.note or "").strip(),
                "receipts": ip.receipts or [],
                "created_at": now,
            })
        doc = {
            "id": uid(),
            "project_id": project_id,
            "name": body.name.strip(),
            "total_debt": _round(body.total_debt),
            "currency": body.currency,
            "note": (body.note or "").strip(),
            "payments": payments,
            "created_by": user["id"],
            "created_at": now,
        }
        await db.project_expenses.insert_one(doc)
        doc.pop("_id", None)
        return _expense_totals(doc)

    @router.put("/{project_id}/expenses/{expense_id}")
    async def update_expense(project_id: str, expense_id: str, body: ProjectExpenseUpdate, user=Depends(current_user)):
        await ensure_access(user)
        existing = await db.project_expenses.find_one({"id": expense_id, "project_id": project_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Gider bulunamadı")
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if "total_debt" in update:
            update["total_debt"] = _round(update["total_debt"])
        if "name" in update:
            update["name"] = update["name"].strip()
        await db.project_expenses.update_one({"id": expense_id}, {"$set": update})
        doc = await db.project_expenses.find_one({"id": expense_id}, {"_id": 0})
        return _expense_totals(doc)

    @router.delete("/{project_id}/expenses/{expense_id}")
    async def delete_expense(project_id: str, expense_id: str, user=Depends(current_user)):
        await ensure_access(user)
        res = await db.project_expenses.delete_one({"id": expense_id, "project_id": project_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Gider bulunamadı")
        return {"ok": True}

    # ---- Expense payments (installments) ----
    @router.post("/{project_id}/expenses/{expense_id}/payments")
    async def add_payment(project_id: str, expense_id: str, body: ProjectPaymentCreate, user=Depends(current_user)):
        await ensure_access(user)
        exp = await db.project_expenses.find_one({"id": expense_id, "project_id": project_id}, {"_id": 0})
        if not exp:
            raise HTTPException(status_code=404, detail="Gider bulunamadı")
        payment = {
            "id": uid(),
            "amount": _round(body.amount),
            "currency": body.currency or exp.get("currency", "EUR"),
            "date": body.date,
            "note": (body.note or "").strip(),
            "receipts": body.receipts or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.project_expenses.update_one({"id": expense_id}, {"$push": {"payments": payment}})
        doc = await db.project_expenses.find_one({"id": expense_id}, {"_id": 0})
        return _expense_totals(doc)

    @router.delete("/{project_id}/expenses/{expense_id}/payments/{payment_id}")
    async def delete_payment(project_id: str, expense_id: str, payment_id: str, user=Depends(current_user)):
        await ensure_access(user)
        exp = await db.project_expenses.find_one({"id": expense_id, "project_id": project_id}, {"_id": 1})
        if not exp:
            raise HTTPException(status_code=404, detail="Gider bulunamadı")
        await db.project_expenses.update_one({"id": expense_id}, {"$pull": {"payments": {"id": payment_id}}})
        doc = await db.project_expenses.find_one({"id": expense_id}, {"_id": 0})
        return _expense_totals(doc)

    return router
