from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from uuid import uuid4
from database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    subtitle = Column(String, default="")
    url = Column(String, nullable=True)
    target_price = Column(Numeric, nullable=True)
    image_emoji = Column(String, default="📦")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"))
    source_name = Column(String)
    source_url = Column(String)
    price = Column(Numeric, nullable=True)
    availability = Column(String, default="unknown")
    is_suspicious = Column(Boolean, default=False)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"))
    alert_type = Column(String)
    message = Column(String)
    price = Column(Numeric)
    source_name = Column(String)
    source_url = Column(String)
    requires_permission = Column(Boolean, default=False)
    dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
