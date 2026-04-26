"""Scan endpoint — accepts an image, runs the CV pipeline, returns result."""
import csv
import io
import os
import time
import uuid
from collections import defaultdict
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_user
from ..config import settings
from ..cv_pipeline.pipeline import DEMONETIZED, analyze
from ..database import get_db
from ..models import CurrencyConfig, Scan, User
from ..schemas import ScanResult

router = APIRouter(prefix="/api/scan", tags=["scan"])

# ── Simple in-memory rate limiter ─────────────────────────────────────────────
_rate_store: dict[int, list[float]] = defaultdict(list)
RATE_LIMIT = 10       # max scans
RATE_WINDOW = 60.0    # per 60 seconds


def _check_rate(user_id: int) -> None:
    now = time.time()
    window_start = now - RATE_WINDOW
    calls = [t for t in _rate_store[user_id] if t > window_start]
    if len(calls) >= RATE_LIMIT:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Rate limit: max {RATE_LIMIT} scans per minute. Try again shortly.",
        )
    _rate_store[user_id] = calls + [now]

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg", "application/octet-stream"}


async def _run_single_scan(
    data: bytes,
    filename: str,
    hint: str | None,
    enabled_codes: list[str] | None,
    user_id: int | None,
    db: AsyncSession,
) -> ScanResult:
    """Internal helper — analyse bytes, persist (if authed), return ScanResult."""
    os.makedirs(settings.upload_dir, exist_ok=True)
    fname = f"{uuid.uuid4().hex}_{filename[:60]}"
    path = os.path.join(settings.upload_dir, fname)
    with open(path, "wb") as f:
        f.write(data)

    result = analyze(
        data,
        settings.authentic_threshold,
        settings.suspicious_threshold,
        enabled_currencies=enabled_codes,
        currency_hint=hint,
    )

    # Only persist to DB when a user is logged in
    if user_id is not None:
        scan = Scan(
            user_id=user_id,
            image_path=path,
            currency=result["currency"],
            denomination=result["denomination"],
            authenticity_score=result["authenticity_score"],
            verdict=result["verdict"],
            breakdown=result["breakdown"],
            created_at=datetime.utcnow(),
        )
        db.add(scan)
        await db.commit()
        await db.refresh(scan)
        scan_id = scan.id
    else:
        scan_id = None

    return ScanResult(
        id=scan_id,
        currency=result["currency"],
        denomination=result["denomination"],
        authenticity_score=result["authenticity_score"],
        verdict=result["verdict"],
        confidence=result["confidence"],
        demonetized=result.get("demonetized", False),
        breakdown=result["breakdown"],
        created_at=datetime.utcnow(),
    )


@router.post("", response_model=ScanResult)
async def scan_note(
    image: UploadFile = File(...),
    hint_currency: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """Scan a banknote image. Works for guests (result not saved) and logged-in users."""
    if user is not None:
        if user.role == "viewer":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Viewers have read-only access. Scanning requires the Inspector or Admin role.",
            )
        _check_rate(user.id)

    if image.content_type and image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported media type: {image.content_type}",
        )
    data = await image.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Image larger than {settings.max_upload_mb} MB",
        )
    if len(data) < 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image too small to analyse")

    enabled = (
        await db.execute(select(CurrencyConfig.code).where(CurrencyConfig.enabled.is_(True)))
    ).scalars().all()
    enabled_codes = list(enabled) or None
    hint = (hint_currency or "").upper().strip() or None
    if hint:
        enabled_codes = [hint]

    try:
        return await _run_single_scan(data, image.filename or "note.jpg", hint, enabled_codes, user.id if user else None, db)
    except HTTPException:
        raise
    except Exception as exc:
        # Any pipeline error → 422 with a clear message instead of a 500
        # ("backend not running") that the frontend interprets as a crash.
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Could not analyse image: {type(exc).__name__}: {exc}",
        )


@router.post("/batch", response_model=list[ScanResult])
async def scan_batch(
    images: List[UploadFile] = File(...),
    hint_currency: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Scan multiple banknote images in one request (max 10)."""
    if user.role == "viewer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewers cannot submit scans.")
    if len(images) > 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum 10 images per batch.")
    _check_rate(user.id)

    enabled = (
        await db.execute(select(CurrencyConfig.code).where(CurrencyConfig.enabled.is_(True)))
    ).scalars().all()
    enabled_codes = list(enabled) or None
    hint = (hint_currency or "").upper().strip() or None
    if hint:
        enabled_codes = [hint]

    results: list[ScanResult] = []
    skipped: list[dict] = []   # for logging visibility — surfaced in breakdown of last result

    for img in images:
        fname = img.filename or "note.jpg"
        if img.content_type and img.content_type not in ALLOWED_TYPES:
            skipped.append({"file": fname, "reason": f"unsupported type: {img.content_type}"})
            continue
        data = await img.read()
        if len(data) < 1024:
            skipped.append({"file": fname, "reason": "image too small (< 1 KB)"})
            continue
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            skipped.append({"file": fname, "reason": f"image too large (> {settings.max_upload_mb} MB)"})
            continue
        try:
            r = await _run_single_scan(data, fname, hint, enabled_codes, user.id, db)
            results.append(r)
        except Exception as exc:
            # One bad image must not abort the whole batch — log and continue
            import traceback
            print(f"[batch] skipped {fname!r}: {type(exc).__name__}: {exc}")
            traceback.print_exc()
            skipped.append({"file": fname, "reason": f"{type(exc).__name__}: {exc}"})
            continue

    # Tag the first result with the skipped list so the frontend can show what
    # got dropped from the batch (e.g. "2 of 4 images couldn't be processed").
    if results and skipped:
        results[0].breakdown = {**results[0].breakdown, "batch_skipped": skipped}

    if not results:
        details = "; ".join(f"{s['file']}: {s['reason']}" for s in skipped) or "no valid images"
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"No images could be processed. {details}")
    return results


@router.get("/history", response_model=list[ScanResult])
async def history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
    limit: int = 50,
):
    """Return scan history.

    - Admin  : all scans (bureau-wide audit log).
    - Viewer : all scans (read-only oversight role).
    - Inspector : own scans only (operational record).
    """
    q = select(Scan).order_by(Scan.created_at.desc()).limit(min(limit, 200))
    if user.role == "inspector":
        q = q.where(Scan.user_id == user.id)

    res = await db.execute(q)
    items = res.scalars().all()
    return [
        ScanResult(
            id=s.id,
            currency=s.currency,
            denomination=s.denomination,
            authenticity_score=s.authenticity_score,
            verdict=s.verdict,
            confidence=s.authenticity_score,
            demonetized=s.denomination in DEMONETIZED.get(s.currency, set()),
            breakdown=s.breakdown or {},
            created_at=s.created_at,
        )
        for s in items
    ]


@router.get("/stats")
async def scan_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Aggregate stats for the dashboard charts."""
    q = select(Scan)
    if user.role == "inspector":
        q = q.where(Scan.user_id == user.id)
    items = (await db.execute(q)).scalars().all()

    verdict_counts: dict[str, int] = {"authentic": 0, "suspicious": 0, "counterfeit": 0}
    currency_counts: dict[str, int] = defaultdict(int)
    daily_counts: dict[str, dict[str, int]] = defaultdict(lambda: {"authentic": 0, "suspicious": 0, "counterfeit": 0})
    total_score = 0.0

    for s in items:
        v = s.verdict if s.verdict in verdict_counts else "suspicious"
        verdict_counts[v] += 1
        currency_counts[s.currency] += 1
        total_score += s.authenticity_score
        day = s.created_at.strftime("%Y-%m-%d") if s.created_at else "unknown"
        daily_counts[day][v] += 1

    # Last 14 days only for the trend chart
    sorted_days = sorted(daily_counts.keys())[-14:]
    trend = [{"date": d, **daily_counts[d]} for d in sorted_days]

    top_currencies = sorted(currency_counts.items(), key=lambda x: -x[1])[:8]

    return {
        "total": len(items),
        "verdicts": verdict_counts,
        "avg_score": round(total_score / len(items), 3) if items else 0.0,
        "top_currencies": [{"code": c, "count": n} for c, n in top_currencies],
        "trend": trend,
    }


@router.get("/export")
async def export_csv(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
    token: str | None = None,
):
    """Export scan history as CSV."""
    q = select(Scan).order_by(Scan.created_at.desc()).limit(1000)
    if user.role == "inspector":
        q = q.where(Scan.user_id == user.id)
    items = (await db.execute(q)).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "created_at", "currency", "denomination", "verdict", "authenticity_score", "demonetized"])
    for s in items:
        writer.writerow([
            s.id,
            s.created_at.isoformat() if s.created_at else "",
            s.currency,
            s.denomination,
            s.verdict,
            round(s.authenticity_score, 4),
            s.denomination in DEMONETIZED.get(s.currency, set()),
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vericash_scans.csv"},
    )


@router.delete("/history")
async def clear_history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Clear scan history.

    - Inspector: deletes only their own scans.
    - Admin: deletes ALL scans (bureau-wide).
    - Viewer: forbidden.
    """
    if user.role == "viewer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewers cannot delete scan history.")

    q = delete(Scan)
    if user.role == "inspector":
        q = q.where(Scan.user_id == user.id)

    result = await db.execute(q)
    await db.commit()
    return {"deleted": result.rowcount}
# reload Fri Apr 24 15:39:03 IST 2026
