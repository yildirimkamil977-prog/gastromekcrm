"""On-demand translation endpoint (used for translated quote PDF downloads).

Translates a flat list of strings to a target language using the user's own
OpenAI key via the emergentintegrations chat wrapper. Does not persist anything.
"""
import os
import json
import logging
from typing import List

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from auth import get_current_user_from_request
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("translate")

LANG_NAMES = {"de": "German (Deutsch)", "tr": "Turkish (Türkçe)"}


class TranslateRequest(BaseModel):
    target_lang: str
    texts: List[str]


def _parse_items(raw: str) -> list | None:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text[:4].lower() == "json":
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
    items = data.get("items")
    return items if isinstance(items, list) else None


def build_translate_router(db):
    router = APIRouter(prefix="/translate", tags=["translate"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    @router.post("")
    async def translate(body: TranslateRequest, user=Depends(current_user)):
        target = LANG_NAMES.get(body.target_lang)
        if not target:
            raise HTTPException(status_code=400, detail="Geçersiz dil")

        texts = [(s or "") for s in body.texts]
        if not any(s.strip() for s in texts):
            return {"translations": texts}

        api_key = os.environ.get("OPENAI_API_KEY")
        settings = await db.settings.find_one({"key": "company"}, {"openai_api_key": 1})
        if settings and (settings.get("openai_api_key") or "").strip():
            api_key = settings["openai_api_key"].strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="Çeviri servisi yapılandırılmamış")

        system = (
            "You are a professional translator for an industrial kitchen equipment company. "
            f"Translate every string in the given JSON array of items to {target}. "
            "Rules: keep product codes, GTIN/EAN, numbers, dimensions and units (cm, mm, m, kg, g, W, kW, V, A, L, °C, Ø, %), "
            "brand names, model names and URLs UNCHANGED. Preserve the array order and length exactly; "
            "if an item is an empty string, return an empty string in the same position. "
            "Return ONLY a valid JSON object of the exact form {\"items\": [...]} with the translated strings and nothing else."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"quote-translate-{body.target_lang}",
            system_message=system,
        ).with_model("openai", "gpt-4o-mini")

        try:
            resp = await chat.send_message(UserMessage(text=json.dumps({"items": texts}, ensure_ascii=False)))
        except Exception as e:  # noqa: BLE001
            logger.error(f"Translation failed: {e}")
            raise HTTPException(status_code=502, detail="Çeviri sırasında bir hata oluştu")

        items = _parse_items(resp)
        if items is None or len(items) != len(texts):
            logger.warning("Translation output mismatch; returning originals")
            return {"translations": texts}
        return {"translations": [str(x) for x in items]}

    return router
