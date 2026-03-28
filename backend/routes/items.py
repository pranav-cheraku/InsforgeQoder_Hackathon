import uuid
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Item, PriceSnapshot
from services.identifier import identify_item
from services.scraper import scrape_item, fetch_prices
from services.alert_engine import check_price_drop

router = APIRouter()


class ItemCreate(BaseModel):
    name: str
    url: Optional[str] = None
    target_price: Optional[float] = None


def _compute_trend(best: float, avg: float) -> tuple[str, str]:
    if avg and best < avg * 0.80:
        return "deal", "Deal now"
    elif avg and best < avg:
        return "low", f"Low ${best:.0f}"
    return "avg", f"Avg ${best:.0f}"


@router.post("")
async def create_item(
    body: ItemCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    info = await identify_item(body.name)
    item = Item(
        name=info.get("name", body.name),
        subtitle=info.get("subtitle", ""),
        url=body.url,
        target_price=body.target_price or info.get("suggested_target_price") or None,
        image_emoji=info.get("image_emoji", "📦"),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    background_tasks.add_task(scrape_item, item, db)

    return {
        "id": str(item.id),
        "name": item.name,
        "subtitle": item.subtitle,
        "url": item.url,
        "target_price": float(item.target_price) if item.target_price else None,
        "image_emoji": item.image_emoji,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "sources": [],
        "best_price": None,
        "avg_price": None,
        "trend": "avg",
        "trend_label": "",
    }


@router.get("")
async def list_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item).order_by(Item.created_at.desc()))
    items = result.scalars().all()

    output = []
    for item in items:
        # Get latest snapshot per source_name
        subq = (
            select(
                PriceSnapshot.source_name,
                sql_func.max(PriceSnapshot.scraped_at).label("latest_scraped_at"),
            )
            .where(PriceSnapshot.item_id == item.id)
            .group_by(PriceSnapshot.source_name)
            .subquery()
        )
        snap_result = await db.execute(
            select(PriceSnapshot).join(
                subq,
                (PriceSnapshot.source_name == subq.c.source_name)
                & (PriceSnapshot.scraped_at == subq.c.latest_scraped_at),
            )
        )
        snapshots = snap_result.scalars().all()
        snapshots_sorted = sorted(
            [s for s in snapshots if s.price is not None],
            key=lambda s: float(s.price),
        )

        sources = [
            {
                "source_name": s.source_name,
                "source_url": s.source_url,
                "price": float(s.price),
                "availability": s.availability,
                "is_suspicious": s.is_suspicious,
                "scraped_at": s.scraped_at.isoformat() if s.scraped_at else None,
            }
            for s in snapshots_sorted
        ]

        prices = [float(s.price) for s in snapshots_sorted]
        best_price = min(prices) if prices else None
        avg_price = sum(prices) / len(prices) if prices else None
        trend, trend_label = _compute_trend(best_price, avg_price) if best_price and avg_price else ("avg", "")

        output.append({
            "id": str(item.id),
            "name": item.name,
            "subtitle": item.subtitle,
            "url": item.url,
            "target_price": float(item.target_price) if item.target_price else None,
            "image_emoji": item.image_emoji,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "sources": sources,
            "best_price": best_price,
            "avg_price": avg_price,
            "trend": trend,
            "trend_label": trend_label,
        })

    return output


@router.delete("/{item_id}")
async def delete_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item).where(Item.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


@router.post("/{item_id}/scrape")
async def trigger_scrape(
    item_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Item).where(Item.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    background_tasks.add_task(scrape_item, item, db)
    return {"status": "scraping", "item_id": item_id}


async def _build_item_response(item, db):
    """Build a full item response dict with sources and computed price fields."""
    subq = (
        select(
            PriceSnapshot.source_name,
            sql_func.max(PriceSnapshot.scraped_at).label("latest_scraped_at"),
        )
        .where(PriceSnapshot.item_id == item.id)
        .group_by(PriceSnapshot.source_name)
        .subquery()
    )
    snap_result = await db.execute(
        select(PriceSnapshot).join(
            subq,
            (PriceSnapshot.source_name == subq.c.source_name)
            & (PriceSnapshot.scraped_at == subq.c.latest_scraped_at),
        )
    )
    snapshots = snap_result.scalars().all()
    snapshots_sorted = sorted(
        [s for s in snapshots if s.price is not None],
        key=lambda s: float(s.price),
    )
    sources = [
        {
            "source_name": s.source_name,
            "source_url": s.source_url,
            "price": float(s.price),
            "availability": s.availability,
            "is_suspicious": s.is_suspicious,
            "scraped_at": s.scraped_at.isoformat() if s.scraped_at else None,
        }
        for s in snapshots_sorted
    ]
    prices = [float(s.price) for s in snapshots_sorted]
    best_price = min(prices) if prices else None
    avg_price = sum(prices) / len(prices) if prices else None
    trend, trend_label = _compute_trend(best_price, avg_price) if best_price and avg_price else ("avg", "")
    return {
        "id": str(item.id),
        "name": item.name,
        "subtitle": item.subtitle,
        "url": item.url,
        "target_price": float(item.target_price) if item.target_price else None,
        "image_emoji": item.image_emoji,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "sources": sources,
        "best_price": best_price,
        "avg_price": avg_price,
        "trend": trend,
        "trend_label": trend_label,
    }


@router.post("/{item_id}/scan")
async def scan_item(item_id: str, db: AsyncSession = Depends(get_db)):
    """Synchronous scan — fetches prices now and returns the updated item."""
    result = await db.execute(select(Item).where(Item.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    price_results = await fetch_prices(item.name)
    for r in price_results:
        price = r.get("price")
        if price is None:
            continue
        try:
            price = float(price)
        except (TypeError, ValueError):
            continue
        snapshot = PriceSnapshot(
            item_id=item.id,
            source_name=r.get("source_name", "Unknown"),
            source_url=r.get("source_url", ""),
            price=price,
            availability=r.get("availability", "unknown"),
            is_suspicious=False,
        )
        db.add(snapshot)
        await db.commit()
        await check_price_drop(item, price, r.get("source_name", "Unknown"), r.get("source_url", ""), db)

    return await _build_item_response(item, db)
