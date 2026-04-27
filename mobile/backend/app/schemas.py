"""Pydantic API schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    """Kept for OpenAPI completeness; the active login route uses
    OAuth2PasswordRequestForm (form-encoded username/password)."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    full_name: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6, max_length=128)


class UserAdminUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None          # "admin" | "inspector" | "viewer"
    password: str | None = Field(None, min_length=6, max_length=128)


# ---- Scan ----
class ScanResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    currency: str
    denomination: str
    authenticity_score: float
    verdict: str
    confidence: float
    demonetized: bool = False
    breakdown: dict
    created_at: datetime | None = None


# ---- Team ----
class TeamMemberIn(BaseModel):
    name: str
    role: str
    github: str = ""
    photo_url: str = ""
    contribution: str = ""
    order_index: int = 0


class TeamMemberOut(TeamMemberIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- Currency ----
class CurrencyConfigIn(BaseModel):
    code: str
    name: str
    enabled: bool = True
    denominations: list[str] = []


class CurrencyConfigOut(CurrencyConfigIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    accuracy: float = 0.0


# ---- Settings ----
class SettingItem(BaseModel):
    """Setting value can be any JSON type (number, string, boolean, list, dict)."""
    key: str
    value: Any


class SettingValueIn(BaseModel):
    value: Any
