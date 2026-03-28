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
            "apikey": settings.service_key,
            "Authorization": f"Bearer {settings.service_key}",
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
                "apikey": settings.service_key,
                "Authorization": f"Bearer {settings.service_key}",
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

    # 5. On BUY signal: execute purchase autonomously
    if decision.action == Action.BUY:
        reasoning = explainer.explain(decision, product.product_name, len(history))
        buy_price = product.current_price

        # Fetch user_id and highest_price for transaction
        async with httpx.AsyncClient() as client:
            item_res = await client.get(
                f"{settings.insforge_url}/rest/v1/wishlist_items"
                f"?id=eq.{job.item_id}&select=user_id,highest_price",
                headers={"apikey": settings.service_key, "Authorization": f"Bearer {settings.service_key}"},
            )
        item_meta = item_res.json()
        user_id = item_meta[0]["user_id"] if item_meta else None
        market_price = float(item_meta[0]["highest_price"]) if item_meta and item_meta[0].get("highest_price") else buy_price

        headers_rw = {
            "apikey": settings.service_key,
            "Authorization": f"Bearer {settings.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

        # 1. Insert transaction (saved_amount is GENERATED ALWAYS — never include it)
        transaction: dict = {}
        async with httpx.AsyncClient() as client:
            tx_res = await client.post(
                f"{settings.insforge_url}/rest/v1/transactions",
                headers=headers_rw,
                json={
                    "item_id": job.item_id,
                    "user_id": user_id,
                    "buy_price": buy_price,
                    "market_price": market_price,
                    "reasoning": reasoning,
                },
            )
            if tx_res.is_success:
                rows = tx_res.json()
                transaction = rows[0] if isinstance(rows, list) else rows

        # 2. Mark item as bought
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{settings.insforge_url}/rest/v1/wishlist_items?id=eq.{job.item_id}",
                headers=headers_rw,
                json={"status": "bought"},
            )

        # 3. Deduct buy_price from user budget
        if user_id:
            async with httpx.AsyncClient() as client:
                user_res = await client.get(
                    f"{settings.insforge_url}/rest/v1/users?id=eq.{user_id}&select=budget",
                    headers={"apikey": settings.service_key, "Authorization": f"Bearer {settings.service_key}"},
                )
                users = user_res.json()
                if users:
                    new_budget = float(users[0]["budget"]) - buy_price
                    await client.patch(
                        f"{settings.insforge_url}/rest/v1/users?id=eq.{user_id}",
                        headers=headers_rw,
                        json={"budget": new_budget},
                    )

        # 4. Notify buy_executed via notification-dispatcher
        if user_id:
            notification_url = settings.buy_executor_url.replace("/buy-executor", "/notification-dispatcher")
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        notification_url,
                        headers={"Authorization": f"Bearer {settings.service_key}", "Content-Type": "application/json"},
                        json={
                            "user_id": user_id,
                            "item_id": job.item_id,
                            "event_type": "buy_executed",
                            "payload": {
                                "product_name": product.product_name,
                                "buy_price": buy_price,
                                "market_price": market_price,
                                "saved_amount": transaction.get("saved_amount", 0),
                                "reasoning": reasoning,
                            },
                        },
                    )
            except Exception:
                pass  # non-fatal

    return ScrapeResult(
        item_id=job.item_id,
        product_name=product.product_name,
        price=product.current_price,
        action=decision.action.value,
        score=round(decision.score, 3),
        reasoning=reasoning,
    )


class IdentifyRequest(BaseModel):
    query: str


class IdentifyResult(BaseModel):
    product_name: str
    product_url: str
    retailer: str
    price_estimate: float | None = None


@app.post("/identify", response_model=IdentifyResult)
async def identify_product(req: IdentifyRequest):
    """
    Given a natural-language query (e.g. "Nike Air Max size 10"),
    return the single best product URL and metadata to monitor.
    Uses Claude Haiku to pick the most likely retailer listing.
    """
    import anthropic
    import re
    import json as _json

    client_ai = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client_ai.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": (
                "Given this shopping query, return the single best product to monitor for price drops.\n"
                "Pick from major retailers: amazon.com, walmart.com, target.com, bestbuy.com.\n\n"
                f"Query: {req.query}\n\n"
                "Return ONLY this JSON object (no markdown fences, no extra text):\n"
                '{"product_name":"<name>","product_url":"<url>","retailer":"<retailer>","price_estimate":<number or null>}'
            ),
        }],
    )

    raw = message.content[0].text.strip()
    # Strip any accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw).strip()

    try:
        parsed = _json.loads(raw)
    except _json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Claude returned invalid JSON: {e} — raw: {raw[:200]}")

    # Only pass known fields to avoid Pydantic validation errors on extra keys
    return IdentifyResult(
        product_name=parsed.get("product_name", req.query),
        product_url=parsed.get("product_url", ""),
        retailer=parsed.get("retailer", "other"),
        price_estimate=parsed.get("price_estimate"),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
