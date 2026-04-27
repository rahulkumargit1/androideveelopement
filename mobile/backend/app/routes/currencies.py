"""Currency configuration."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_admin
from ..database import get_db
from ..models import CurrencyConfig, User
from ..schemas import CurrencyConfigIn, CurrencyConfigOut

router = APIRouter(prefix="/api/currencies", tags=["currencies"])


@router.get("", response_model=list[CurrencyConfigOut])
async def list_currencies(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CurrencyConfig).order_by(CurrencyConfig.code))
    return list(res.scalars().all())


@router.post("", response_model=CurrencyConfigOut)
async def upsert_currency(payload: CurrencyConfigIn, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    res = await db.execute(select(CurrencyConfig).where(CurrencyConfig.code == payload.code))
    c = res.scalar_one_or_none()
    if c:
        for k, v in payload.model_dump().items():
            setattr(c, k, v)
    else:
        c = CurrencyConfig(**payload.model_dump())
        db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@router.delete("/{code}")
async def delete_currency(code: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    res = await db.execute(select(CurrencyConfig).where(CurrencyConfig.code == code))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Not found")
    await db.delete(c)
    await db.commit()
    return {"ok": True}
