import uuid
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PriceSnapshot

router = APIRouter()


@router.get("/{item_id}/history")
async def price_history(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.item_id == uuid.UUID(item_id))
        .order_by(PriceSnapshot.scraped_at.desc())
        .limit(30)
    )
    snapshots = result.scalars().all()

    grouped: dict[str, list] = defaultdict(list)
    for s in snapshots:
        grouped[s.source_name].append({
            "id": str(s.id),
            "source_url": s.source_url,
            "price": float(s.price) if s.price else None,
            "availability": s.availability,
            "is_suspicious": s.is_suspicious,
            "scraped_at": s.scraped_at.isoformat() if s.scraped_at else None,
        })

    return {source: entries for source, entries in grouped.items()}
