import os
import re
import json
from anthropic import AsyncAnthropic

PRICE_EXTRACTION_SYSTEM = """You are a price extraction agent.
Given raw text scraped from a retail product page, return ONLY a valid
JSON object with no explanation, no markdown, no code fences:
{
  "title": "string",
  "price": number or null,
  "currency": "USD",
  "availability": "in_stock" or "out_of_stock" or "unknown",
  "is_suspicious": boolean,
  "suspicion_reason": "string or null"
}
If you cannot find a price, return price as null."""


async def extract_price_from_html(html: str, item_name: str) -> dict:
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()[:8000]
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        system=PRICE_EXTRACTION_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Item we are looking for: {item_name}\n\nPage text:\n{text}"
        }]
    )
    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {
            "title": item_name,
            "price": None,
            "currency": "USD",
            "availability": "unknown",
            "is_suspicious": False,
            "suspicion_reason": None,
        }
