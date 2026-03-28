import os
import json
import re
from anthropic import AsyncAnthropic
from services.alert_engine import check_price_drop
from models import PriceSnapshot

PRICE_SEARCH_SYSTEM = """You are a product price research agent. Use web_search to find the current retail price of the given product from multiple stores.

Search Amazon, eBay, Best Buy, Walmart, and any other relevant retailers. After searching, your FINAL response must be ONLY a valid JSON array — no explanation, no markdown, no code fences:

[
  {
    "source_name": "retailer name",
    "source_url": "direct product URL",
    "price": number,
    "availability": "in_stock" or "out_of_stock" or "unknown"
  }
]

Return up to 5 results with actual prices. Only include listings with a real numeric price."""

PRICE_FALLBACK_SYSTEM = """You are a product price knowledge agent. Based on your training knowledge, return the typical current retail prices for this product across major retailers.

Return ONLY a valid JSON array — no explanation, no markdown, no code fences:

[
  {
    "source_name": "retailer name",
    "source_url": "https://www.amazon.com/s?k=...",
    "price": number,
    "availability": "in_stock"
  }
]

Return up to 5 results. Use realistic current prices based on your knowledge."""


def _extract_json_list(text: str) -> list | None:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text).strip()
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except Exception:
        pass
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return result
        except Exception:
            pass
    return None


async def fetch_prices(item_name: str) -> list:
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Try web search first
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            system=PRICE_SEARCH_SYSTEM,
            messages=[{"role": "user", "content": f"Find current prices for: {item_name}"}],
        )
        text_blocks = [b.text for b in response.content if hasattr(b, "text") and b.text]
        for text in reversed(text_blocks):
            result = _extract_json_list(text)
            if result:
                print(f"[scraper] web_search returned {len(result)} prices for '{item_name}'")
                return result
    except Exception as e:
        print(f"[scraper] web_search failed: {e}")

    # Fallback: Claude knowledge-based prices
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=PRICE_FALLBACK_SYSTEM,
            messages=[{"role": "user", "content": f"Product: {item_name}"}],
        )
        text_blocks = [b.text for b in response.content if hasattr(b, "text") and b.text]
        for text in reversed(text_blocks):
            result = _extract_json_list(text)
            if result:
                print(f"[scraper] fallback returned {len(result)} prices for '{item_name}'")
                return result
    except Exception as e:
        print(f"[scraper] fallback failed: {e}")

    return []


async def scrape_item(item, db):
    results = await fetch_prices(item.name)

    for result in results:
        price = result.get("price")
        if price is None:
            continue
        try:
            price = float(price)
        except (TypeError, ValueError):
            continue

        snapshot = PriceSnapshot(
            item_id=item.id,
            source_name=result.get("source_name", "Unknown"),
            source_url=result.get("source_url", ""),
            price=price,
            availability=result.get("availability", "unknown"),
            is_suspicious=False,
        )
        db.add(snapshot)
        await db.commit()
        await check_price_drop(
            item,
            price,
            result.get("source_name", "Unknown"),
            result.get("source_url", ""),
            db,
        )
