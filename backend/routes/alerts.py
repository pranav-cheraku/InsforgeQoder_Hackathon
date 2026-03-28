import uuid
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Alert, Item

router = APIRouter()


@router.get("")
async def list_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Alert)
        .where(Alert.dismissed == False)
        .order_by(Alert.created_at.desc())
    )
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "item_id": str(a.item_id),
            "alert_type": a.alert_type,
            "message": a.message,
            "price": float(a.price) if a.price else None,
            "source_name": a.source_name,
            "source_url": a.source_url,
            "requires_permission": a.requires_permission,
            "dismissed": a.dismissed,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == uuid.UUID(alert_id)))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.dismissed = True
    await db.commit()
    return {"ok": True}


@router.post("/{alert_id}/approve")
async def approve_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == uuid.UUID(alert_id)))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    item_result = await db.execute(select(Item).where(Item.id == alert.item_id))
    item = item_result.scalar_one_or_none()

    alert.dismissed = True
    await db.commit()

    return {
        "order_id": f"DRP-{random.randint(1000, 9999)}",
        "confirmed": True,
        "item_name": item.name if item else "Unknown",
        "price": float(alert.price) if alert.price else None,
        "source": alert.source_name,
        "estimated_delivery": "2 business days",
    }
