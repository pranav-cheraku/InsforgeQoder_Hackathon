import os
import json
import re
from anthropic import AsyncAnthropic

SEARCH_SYSTEM = """You are a product price search agent. Use web_search to find current retail listings for the given product query.

Search across Amazon, eBay, Best Buy, Walmart, and other major retailers. After searching, your FINAL response must be ONLY a valid JSON array — no explanation, no markdown, no code fences, just raw JSON:

[
  {
    "name": "exact clean product name",
    "subtitle": "variant details like color/size/condition, or empty string",
    "image_emoji": "single emoji representing the product category",
    "price": number or null,
    "source_name": "retailer name (e.g. Amazon, eBay, Best Buy)",
    "source_url": "direct URL to the product listing"
  }
]

Return up to 6 results. Only include results with a real price. Sort by price ascending."""

SEARCH_FALLBACK_SYSTEM = """You are a product price knowledge agent. Based on your training knowledge of typical retail prices, return a JSON array of where this product is commonly sold and at what price.

Return ONLY a valid JSON array — no explanation, no markdown, no code fences:

[
  {
    "name": "exact clean product name",
    "subtitle": "variant details like color/size/condition, or empty string",
    "image_emoji": "single emoji representing the product category",
    "price": number,
    "source_name": "retailer name",
    "source_url": "https://www.amazon.com/s?k=..."
  }
]

Return up to 6 results sorted by price ascending. Use realistic current prices."""


def _extract_json_list(text: str) -> list | None:
    """Try to extract a JSON array from text, trying various strategies."""
    text = text.strip()
    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text).strip()
    # Direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except Exception:
        pass
    # Extract first [...] block
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return result
        except Exception:
            pass
    return None


async def search_products(query: str) -> list:
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Try web search first
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            system=SEARCH_SYSTEM,
            messages=[{"role": "user", "content": f"Find current prices for: {query}"}],
        )
        # Collect all text blocks (last one is most likely the final JSON response)
        text_blocks = [b.text for b in response.content if hasattr(b, "text") and b.text]
        for text in reversed(text_blocks):
            result = _extract_json_list(text)
            if result:
                return result
    except Exception as e:
        print(f"[search] web_search failed: {e}")

    # Fallback: Claude knowledge-based prices
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SEARCH_FALLBACK_SYSTEM,
            messages=[{"role": "user", "content": f"Product: {query}"}],
        )
        text_blocks = [b.text for b in response.content if hasattr(b, "text") and b.text]
        for text in reversed(text_blocks):
            result = _extract_json_list(text)
            if result:
                return result
    except Exception as e:
        print(f"[search] fallback failed: {e}")

    return []
