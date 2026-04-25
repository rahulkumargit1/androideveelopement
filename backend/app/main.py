"""FastAPI entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from . import __version__
from .auth import hash_password
from .config import settings
from .database import AsyncSessionLocal, init_db
from .models import AppSetting, CurrencyConfig, TeamMember, User
from .routes import auth as auth_routes
from .routes import currencies as currency_routes
from .routes import members as member_routes
from .routes import scan as scan_routes
from .routes import settings as setting_routes

DEFAULT_CURRENCIES = [
    # ── Asia-Pacific ──────────────────────────────────────────────────────────
    ("INR", "Indian Rupee",          ["10", "20", "50", "100", "200", "500", "2000"]),
    ("JPY", "Japanese Yen",          ["1000", "5000", "10000"]),
    ("CNY", "Chinese Yuan",          ["1", "5", "10", "20", "50", "100"]),
    ("KRW", "South Korean Won",      ["1000", "5000", "10000", "50000"]),
    ("AUD", "Australian Dollar",     ["5", "10", "20", "50", "100"]),
    ("SGD", "Singapore Dollar",      ["2", "5", "10", "50", "100", "1000"]),
    ("HKD", "Hong Kong Dollar",      ["10", "20", "50", "100", "500", "1000"]),
    ("MYR", "Malaysian Ringgit",     ["1", "5", "10", "20", "50", "100"]),
    ("THB", "Thai Baht",             ["20", "50", "100", "500", "1000"]),
    ("IDR", "Indonesian Rupiah",     ["1000", "2000", "5000", "10000", "20000", "50000", "100000"]),
    ("PKR", "Pakistani Rupee",       ["10", "20", "50", "100", "500", "1000", "5000"]),
    ("BDT", "Bangladeshi Taka",      ["10", "20", "50", "100", "200", "500", "1000"]),
    ("LKR", "Sri Lankan Rupee",      ["20", "50", "100", "500", "1000", "5000"]),
    ("NPR", "Nepalese Rupee",        ["5", "10", "20", "50", "100", "500", "1000"]),
    ("PHP", "Philippine Peso",       ["20", "50", "100", "200", "500", "1000"]),
    ("VND", "Vietnamese Dong",       ["10000", "20000", "50000", "100000", "200000", "500000"]),
    ("TWD", "Taiwan Dollar",         ["100", "200", "500", "1000", "2000"]),
    # ── Europe ────────────────────────────────────────────────────────────────
    ("EUR", "Euro",                  ["5", "10", "20", "50", "100", "200", "500"]),
    ("GBP", "Pound Sterling",        ["5", "10", "20", "50"]),
    ("CHF", "Swiss Franc",           ["10", "20", "50", "100", "200", "1000"]),
    ("SEK", "Swedish Krona",         ["20", "50", "100", "200", "500", "1000"]),
    ("NOK", "Norwegian Krone",       ["50", "100", "200", "500", "1000"]),
    ("DKK", "Danish Krone",          ["50", "100", "200", "500", "1000"]),
    ("RUB", "Russian Ruble",         ["10", "50", "100", "200", "500", "1000", "2000", "5000"]),
    ("TRY", "Turkish Lira",          ["5", "10", "20", "50", "100", "200"]),
    # ── Americas ──────────────────────────────────────────────────────────────
    ("USD", "US Dollar",             ["1", "5", "10", "20", "50", "100"]),
    ("CAD", "Canadian Dollar",       ["5", "10", "20", "50", "100"]),
    ("BRL", "Brazilian Real",        ["2", "5", "10", "20", "50", "100", "200"]),
    ("MXN", "Mexican Peso",          ["20", "50", "100", "200", "500", "1000"]),
    # ── Middle East & Africa ──────────────────────────────────────────────────
    ("AED", "UAE Dirham",            ["5", "10", "20", "50", "100", "200", "500", "1000"]),
    ("SAR", "Saudi Riyal",           ["1", "5", "10", "20", "50", "100", "500"]),
    ("QAR", "Qatari Riyal",          ["1", "5", "10", "50", "100", "500"]),
    ("KWD", "Kuwaiti Dinar",         ["250", "500", "1", "5", "10", "20"]),
    ("ZAR", "South African Rand",    ["10", "20", "50", "100", "200"]),
    # ── Oceania ───────────────────────────────────────────────────────────────
    ("NZD", "New Zealand Dollar",    ["5", "10", "20", "50", "100"]),
]

# Project team — seeded on first run. Operators can edit / add via the
# Administration page after they sign in as admin.
#
# These are the actual PBL team members. The seed routine reconciles this
# list against the database on every startup so that USNs, roles, and
# contributions stay in sync with the source of truth (this file) without
# wiping any extra members an admin may have added through the UI.
DEFAULT_TEAM = [
    {
        "name": "Dhanush",
        "role": "Team Lead & Backend Engineer — USN 4SO23CD013",
        "contribution": (
            "Project lead, FastAPI service, JWT authentication, SQLite/SQLAlchemy "
            "persistence, scan history, and the admin-controlled settings "
            "and currency catalogue endpoints."
        ),
        "github": "",
        "photo_url": "",
        "order_index": 0,
    },
    {
        "name": "Alvita Lenora Corda",
        "role": "CV Pipeline & Architecture — USN 4SO23CD005",
        "contribution": (
            "System architecture and CV pipeline design — "
            "owns image enhancement (CLAHE + gamma) and the seven-technique "
            "ensemble that produces the authenticity score."
        ),
        "github": "",
        "photo_url": "",
        "order_index": 1,
    },
    {
        "name": "Isabel Carina",
        "role": "Computer Vision & Classifier — USN 4SO23CD023",
        "contribution": (
            "CIE Lab colour fingerprints, histogram + frequency-domain "
            "analysis, morphological security-thread detection, and the "
            "currency / denomination classifier."
        ),
        "github": "",
        "photo_url": "",
        "order_index": 2,
    },
    {
        "name": "Viona Vijay Noronha",
        "role": "Web & Mobile UI — USN 4SO23CD059",
        "contribution": (
            "Next.js inspector console (Scan, History, Administration, "
            "Settings) and the Expo / React-Native APK that talks to the "
            "same backend — including the dark-mode design system."
        ),
        "github": "",
        "photo_url": "",
        "order_index": 3,
    },
]

DEFAULT_SETTINGS = [
    ("authentic_threshold",  settings.authentic_threshold),
    ("suspicious_threshold", settings.suspicious_threshold),
    ("organization_name",    "VeriCash — Office of Currency Authentication"),
    ("mission_statement",    "Detect counterfeit banknotes through transparent, "
                              "auditable image-processing on the same backend that "
                              "powers our field inspector APK."),
]


async def seed_defaults():
    async with AsyncSessionLocal() as db:
        # ── Admin account ─────────────────────────────────────────────────────
        # Seeded on first run; credentials are intentionally hardcoded here as
        # this is an academic project with no production email service.
        admin_email = "admin@gmail.com"
        admin_row = (
            await db.execute(select(User).where(User.email == admin_email))
        ).scalar_one_or_none()
        if admin_row is None:
            db.add(User(
                email=admin_email,
                full_name="Administrator",
                hashed_password=hash_password("admin"),
                role="admin",
            ))
            await db.commit()

        # Currencies — upsert on every startup so new currencies are added
        # without wiping operator customisations (enabled flag, accuracy).
        existing_cur = {
            c.code: c
            for c in (await db.execute(select(CurrencyConfig))).scalars().all()
        }
        for code, name, denoms in DEFAULT_CURRENCIES:
            row = existing_cur.get(code)
            if row is None:
                db.add(CurrencyConfig(
                    code=code, name=name, denominations=denoms,
                    enabled=True, accuracy=0.0,
                ))
            else:
                # Keep enabled/accuracy as set by operator; refresh name+denoms
                row.name = name
                row.denominations = denoms
        await db.commit()

        # Team — reconcile against DEFAULT_TEAM on every startup so the
        # canonical PBL roster stays in sync. Members the admin added by
        # hand (names not in DEFAULT_TEAM) are preserved untouched.
        canonical = {m["name"]: m for m in DEFAULT_TEAM}
        existing_members = (await db.execute(select(TeamMember))).scalars().all()
        existing_by_name = {m.name: m for m in existing_members}

        # Update existing rows whose name matches a canonical entry.
        for name, payload in canonical.items():
            row = existing_by_name.get(name)
            if row is None:
                db.add(TeamMember(**payload))
            else:
                row.role = payload["role"]
                row.contribution = payload["contribution"]
                row.order_index = payload["order_index"]
                if not row.github:
                    row.github = payload.get("github", "")
                if not row.photo_url:
                    row.photo_url = payload.get("photo_url", "")

        # Drop legacy placeholder rows from previous seeds so the public
        # roster stays clean. Add any stale placeholder names here.
        legacy_names = {
            "Project Director", "Computer-Vision Lead", "Backend Engineer",
            "Web Engineer", "Mobile Engineer", "Quality & Datasets",
            # Earlier scaffolding placeholder
            "Add your team",
        }
        for row in existing_members:
            if row.name in legacy_names and row.name not in canonical:
                await db.delete(row)

        await db.commit()

        # Settings
        existing_settings = {
            s.key for s in (await db.execute(select(AppSetting))).scalars().all()
        }
        for key, value in DEFAULT_SETTINGS:
            if key not in existing_settings:
                db.add(AppSetting(key=key, value=value))
        await db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    await seed_defaults()
    import asyncio
    loop = asyncio.get_event_loop()
    # Pre-warm EasyOCR so first scan doesn't pay model-load penalty.
    from .cv_pipeline import ocr_classifier
    await loop.run_in_executor(None, ocr_classifier.prewarm)
    # Pre-warm BankNote-Net + MobileNetV2 classifiers (TF cold-load is 20-40s).
    # Run in background so startup isn't blocked — models ready before first real scan.
    async def _prewarm_ml():
        import numpy as np
        from .cv_pipeline import classifier
        dummy = np.zeros((224, 224, 3), dtype=np.uint8)
        await loop.run_in_executor(None, lambda: classifier.predict(dummy))
    asyncio.create_task(_prewarm_ml())
    yield


app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        ["*"]
        if settings.cors_origins == "*"
        else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    ),
    allow_credentials=False,  # we use bearer tokens, not cookies — `*` origins ok
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(scan_routes.router)
app.include_router(member_routes.router)
app.include_router(currency_routes.router)
app.include_router(setting_routes.router)


@app.get("/")
async def root():
    return {"app": settings.app_name, "version": __version__, "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
