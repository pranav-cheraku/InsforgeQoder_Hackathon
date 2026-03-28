from sqlalchemy import select, desc
from models import PriceSnapshot, Alert


async def check_price_drop(item, new_price: float, source_name: str, source_url: str, db):
    result = await db.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.item_id == item.id)
        .where(PriceSnapshot.source_name == source_name)
        .order_by(desc(PriceSnapshot.scraped_at))
        .limit(2)
    )
    snapshots = result.scalars().all()
    last_price = float(snapshots[1].price) if len(snapshots) > 1 else None
    target = float(item.target_price) if item.target_price else None

    should_alert = False
    if target and new_price <= target:
        should_alert = True
    elif last_price and new_price < last_price * 0.90:
        should_alert = True

    if should_alert:
        alert = Alert(
            item_id=item.id,
            alert_type="target_price" if (target and new_price <= target) else "price_drop",
            message=f"{item.name} dropped to ${new_price:.2f} on {source_name}",
            price=new_price,
            source_name=source_name,
            source_url=source_url,
            requires_permission=True,
            dismissed=False,
        )
        db.add(alert)
        await db.commit()
