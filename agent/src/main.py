"""
DealFlow Agent Worker — FastAPI server

Receives scrape jobs from the Insforge edge function (scrape-trigger),
scrapes prices, runs the trading algorithm, generates reasoning, and
calls the buy-executor edge function when a BUY is triggered.
"""

import httpx
import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import settings
from .scraper.price_extractor import extractor
from .trading.signals import PricePoint
from .trading.decision import evaluate, Action
from .reasoning.explainer import explainer

app = FastAPI(title="DealFlow Agent Worker")


class ScrapeJob(BaseModel):
    item_id: str
    url: str


class ScrapeResult(BaseModel):
    item_id: str
    product_name: str
    price: float
    action: str
    score: float
    reasoning: str | None = None


@app.post("/scrape", response_model=ScrapeResult)
async def handle_scrape(job: ScrapeJob):
    """
    Main agent loop for a single wishlist item:
    1. Scrape current price
    2. Write price to Insforge price_history
    3. Fetch price history for signal analysis
    4. Run trading algorithm
    5. If BUY: generate reasoning + call buy-executor
    """
    # 1. Scrape
    try:
        product = await extractor.extract(job.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Scrape failed: {e}")

    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": settings.insforge_service_role_key,
            "Authorization": f"Bearer {settings.insforge_service_role_key}",
            "Content-Type": "application/json",
        }

        # 2. Write price point to price_history
        await client.post(
            f"{settings.insforge_url}/rest/v1/price_history",
            headers=headers,
            json={
                "item_id": job.item_id,
                "price": product.current_price,
                "retailer": product.retailer,
                "scraped_at": datetime.utcnow().isoformat(),
            },
        )

        # Update current_price and product_name on the wishlist item
        await client.patch(
            f"{settings.insforge_url}/rest/v1/wishlist_items?id=eq.{job.item_id}",
            headers=headers,
            json={
                "current_price": product.current_price,
                "product_name": product.product_name,
                **({"image_url": product.image_url} if product.image_url else {}),
            },
        )

        # 3. Fetch price history for this item
        history_res = await client.get(
            f"{settings.insforge_url}/rest/v1/price_history"
            f"?item_id=eq.{job.item_id}&order=scraped_at.asc&select=price,scraped_at",
            headers=headers,
        )
        history_data = history_res.json()

    history = [PricePoint(price=p["price"], scraped_at=p["scraped_at"]) for p in history_data]

    # Also need target_price — fetch from wishlist item
    async with httpx.AsyncClient() as client:
        item_res = await client.get(
            f"{settings.insforge_url}/rest/v1/wishlist_items?id=eq.{job.item_id}&select=target_price,status",
            headers={
                "apikey": settings.insforge_service_role_key,
                "Authorization": f"Bearer {settings.insforge_service_role_key}",
            },
        )
    item_data = item_res.json()
    if not item_data:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    item = item_data[0]
    if item["status"] == "bought":
        return ScrapeResult(item_id=job.item_id, product_name=product.product_name,
                            price=product.current_price, action="SKIP", score=0.0)

    # 4. Run trading algorithm
    decision = evaluate(product.current_price, item["target_price"], history)

    reasoning = None

    # 5. Execute buy if signal is strong enough
    if decision.action == Action.BUY:
        reasoning = explainer.explain(decision, product.product_name, len(history))

        async with httpx.AsyncClient() as client:
            await client.post(
                settings.buy_executor_url,
                headers={
                    "Authorization": f"Bearer {settings.insforge_service_role_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "item_id": job.item_id,
                    "buy_price": product.current_price,
                    "market_price": product.original_price or product.current_price,
                    "reasoning": reasoning,
                },
            )

    return ScrapeResult(
        item_id=job.item_id,
        product_name=product.product_name,
        price=product.current_price,
        action=decision.action.value,
        score=round(decision.score, 3),
        reasoning=reasoning,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
