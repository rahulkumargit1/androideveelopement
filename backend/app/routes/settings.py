"""Generic key/value app settings.

Read endpoints are public (no secrets are ever stored here).
Write endpoints require admin role.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_admin
from ..database import get_db
from ..models import AppSetting, User
from ..schemas import SettingItem, SettingValueIn

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=list[SettingItem])
async def list_settings(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AppSetting))
    return [SettingItem(key=s.key, value=s.value) for s in res.scalars().all()]


@router.get("/{key}", response_model=SettingItem)
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(AppSetting, key)
    if not s:
        raise HTTPException(404, f"Setting '{key}' not found")
    return SettingItem(key=s.key, value=s.value)


@router.put("/{key}", response_model=SettingItem)
async def upsert_setting(
    key: str,
    payload: SettingValueIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await db.get(AppSetting, key)
    if s:
        s.value = payload.value
    else:
        s = AppSetting(key=key, value=payload.value)
        db.add(s)
    await db.commit()
    return SettingItem(key=key, value=payload.value)


@router.delete("/{key}")
async def delete_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await db.get(AppSetting, key)
    if not s:
        raise HTTPException(404, f"Setting '{key}' not found")
    await db.delete(s)
    await db.commit()
    return {"ok": True}
