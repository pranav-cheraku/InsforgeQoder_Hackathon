import os
import json
import urllib.parse
from anthropic import AsyncAnthropic

IDENTIFY_SYSTEM = """Given a user's product wishlist input, return ONLY a valid
JSON object with no explanation, no markdown, no code fences:
{
  "name": "string - clean product name",
  "subtitle": "string - variant details like size/color/condition, empty string if unknown",
  "image_emoji": "single emoji representing the product category",
  "suggested_urls": [
    {"source": "Amazon", "url": "https://www.amazon.com/s?k=..."},
    {"source": "eBay", "url": "https://www.ebay.com/sch/i.html?_nkw=..."}
  ],
  "suggested_target_price": number
}
Use urllib-encoded search URLs. Base target price on typical street price."""


async def identify_item(user_input: str) -> dict:
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        system=IDENTIFY_SYSTEM,
        messages=[{"role": "user", "content": user_input}]
    )
    try:
        return json.loads(response.content[0].text)
    except Exception:
        encoded = urllib.parse.quote(user_input)
        return {
            "name": user_input,
            "subtitle": "",
            "image_emoji": "📦",
            "suggested_urls": [
                {"source": "Amazon", "url": f"https://www.amazon.com/s?k={encoded}"},
                {"source": "eBay", "url": f"https://www.ebay.com/sch/i.html?_nkw={encoded}"},
            ],
            "suggested_target_price": 0,
        }
