"""Project members CRUD."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_admin
from ..database import get_db
from ..models import TeamMember, User
from ..schemas import TeamMemberIn, TeamMemberOut

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[TeamMemberOut])
async def list_members(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(TeamMember).order_by(TeamMember.order_index))
    return list(res.scalars().all())


@router.post("", response_model=TeamMemberOut)
async def create_member(payload: TeamMemberIn, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    m = TeamMember(**payload.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@router.put("/{mid}", response_model=TeamMemberOut)
async def update_member(mid: int, payload: TeamMemberIn, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    m = await db.get(TeamMember, mid)
    if not m:
        raise HTTPException(404, "Not found")
    for k, v in payload.model_dump().items():
        setattr(m, k, v)
    await db.commit()
    await db.refresh(m)
    return m


@router.delete("/{mid}")
async def delete_member(mid: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    m = await db.get(TeamMember, mid)
    if not m:
        raise HTTPException(404, "Not found")
    await db.delete(m)
    await db.commit()
    return {"ok": True}
