"""File upload endpoint — saves images to shared /app/uploads volume."""
import os
import secrets
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Request, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import Response, FileResponse
from auth import get_current_user_from_request

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


def build_uploads_router(db):
    router = APIRouter(prefix="/uploads", tags=["uploads"])

    async def current_user(request: Request):
        return await get_current_user_from_request(request, db)

    @router.post("")
    async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
        filename = file.filename or "upload"
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(
                status_code=400,
                detail=f"Desteklenmeyen format. İzinli: {', '.join(sorted(ALLOWED_EXT))}",
            )
        content = await file.read()
        if len(content) > MAX_BYTES:
            raise HTTPException(status_code=400, detail="Dosya 5 MB'den büyük olamaz")

        new_name = f"{secrets.token_hex(8)}{ext}"
        dest = UPLOAD_DIR / new_name
        dest.write_bytes(content)

        base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
        url = f"{base}/api/uploads/file/{new_name}" if base else f"/api/uploads/file/{new_name}"
        return {"url": url, "filename": new_name, "size": len(content)}

    @router.get("/file/{name}")
    async def serve_upload(name: str):
        safe = Path(name).name
        dest = UPLOAD_DIR / safe
        if not dest.exists():
            raise HTTPException(status_code=404, detail="Dosya bulunamadı")
        return FileResponse(str(dest))

    return router


def build_image_proxy_router():
    """Stream an external image back through our origin so html2canvas can render it
    without CORS issues (needed for custom quote item images from Google / arbitrary hosts)."""
    router = APIRouter(tags=["image-proxy"])

    @router.get("/image-proxy")
    async def proxy_image(url: str = Query(..., min_length=8)):
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HTTPException(status_code=400, detail="Geçersiz URL")
        try:
            async with httpx.AsyncClient(
                timeout=15.0, follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 AriCRM ImageProxy"},
            ) as cli:
                r = await cli.get(url)
                r.raise_for_status()
            content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="URL bir görsel döndürmüyor")
            return Response(
                content=r.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Görsel alınamadı: {e}") from e

    return router
