from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from database import engine, AsyncSessionLocal
from models import Base, Item, Alert
from routes import items as items_router
from routes import alerts as alerts_router
from routes import prices as prices_router
from routes import search as search_router

app = FastAPI(title="drip. backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(items_router.router, prefix="/items")
app.include_router(alerts_router.router, prefix="/alerts")
app.include_router(prices_router.router, prefix="/prices")
app.include_router(search_router.router, prefix="/search")


@app.on_event("startup")
async def startup():
    # Drop and recreate all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed demo data
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Item))
        existing = result.scalars().first()
        if not existing:
            item = Item(
                name="Sony WH-1000XM5",
                subtitle="Black · New",
                image_emoji="🎧",
            )
            db.add(item)
            await db.flush()

            alert = Alert(
                item_id=item.id,
                alert_type="target_price",
                message="Sony WH-1000XM5 hit your target price of $249 on eBay (new, free shipping). Lowest price in 90 days.",
                price=249.00,
                source_name="eBay",
                source_url="https://ebay.com",
                requires_permission=True,
                dismissed=False,
            )
            db.add(alert)
            await db.commit()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "db": "connected",
        "tables": ["items", "price_snapshots", "alerts"],
    }
