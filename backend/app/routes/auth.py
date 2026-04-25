"""Auth routes — register, login, me, profile, user management."""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import (
    create_access_token,
    hash_password,
    require_admin,
    require_user,
    verify_password,
)
from ..database import get_db
from ..models import User
from ..schemas import (
    ForgotPasswordRequest,
    PasswordChange,
    ResetPasswordRequest,
    TokenOut,
    UserAdminUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory reset codes: email → (code, expiry)
_reset_codes: dict[str, tuple[str, datetime]] = {}


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    # First user becomes admin (bootstrap), unless admin is already seeded.
    n_users = (await db.execute(select(func.count(User.id)))).scalar_one() or 0
    role = "admin" if n_users == 0 else "inspector"

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name or payload.email.split("@")[0],
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.email, {"role": user.role})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Standard OAuth2 password flow (application/x-www-form-urlencoded)."""
    email = (form.username or "").lower().strip()
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user.email, {"role": user.role})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(require_user)):
    return UserOut.model_validate(user)


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.full_name is not None:
        stripped = payload.full_name.strip()
        if stripped:
            user.full_name = stripped
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChange,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    await db.commit()


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a 6-digit reset code.

    In a production system this would be emailed. For this demo the code is
    returned directly in the response so the developer can test without an
    SMTP server.
    """
    email = payload.email.lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    demo_code = None
    if user:
        code = f"{secrets.randbelow(900000) + 100000}"
        _reset_codes[email] = (code, datetime.utcnow() + timedelta(minutes=15))
        demo_code = code  # exposed only for demo — remove in production
    return {
        "message": "If that email is registered a reset code has been generated.",
        "demo_code": demo_code,
    }


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower()
    stored = _reset_codes.get(email)
    if not stored or stored[0] != payload.code or datetime.utcnow() > stored[1]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset code")
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.hashed_password = hash_password(payload.new_password)
    del _reset_codes[email]
    await db.commit()


# ── Admin user management ─────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users = (await db.execute(select(User).order_by(User.id))).scalars().all()
    return [UserOut.model_validate(u) for u in users]


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.full_name is not None:
        stripped = payload.full_name.strip()
        if stripped:
            user.full_name = stripped
    if payload.role and payload.role in ("admin", "inspector", "viewer"):
        user.role = payload.role
    if payload.password:
        user.hashed_password = hash_password(payload.password)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if admin.id == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete your own account")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    await db.delete(user)
    await db.commit()
