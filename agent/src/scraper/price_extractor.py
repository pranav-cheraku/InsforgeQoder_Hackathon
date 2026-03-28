"""
Price extractor using crawl4ai.

crawl4ai handles JS rendering, anti-bot measures, and provides clean markdown
output that Claude can parse to extract structured price data from any retailer.
"""

import re
import json
import asyncio
from typing import Optional
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
from crawl4ai.extraction_strategy import LLMExtractionStrategy
from pydantic import BaseModel
import anthropic

from ..config import settings


class ProductData(BaseModel):
    product_name: str
    current_price: float
    original_price: Optional[float] = None
    currency: str = "USD"
    in_stock: bool = True
    retailer: str = "unknown"
    image_url: Optional[str] = None


class PriceExtractor:
    """Extracts product price and metadata from any retail URL using crawl4ai + Claude."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def extract(self, url: str) -> ProductData:
        """Scrape the URL and extract structured product data."""
        async with AsyncWebCrawler() as crawler:
            config = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,  # always get fresh price
                word_count_threshold=50,
                remove_overlay_elements=True,
                simulate_user=True,           # basic anti-bot
            )
            result = await crawler.arun(url=url, config=config)

        if not result.success:
            raise RuntimeError(f"Crawl failed for {url}: {result.error_message}")

        return await self._parse_with_claude(url, result.markdown)

    async def _parse_with_claude(self, url: str, page_markdown: str) -> ProductData:
        """Use Claude to extract structured product data from crawled markdown."""
        # Truncate to avoid massive token usage — price info is usually near the top
        content = page_markdown[:4000]

        message = self.client.messages.create(
            model="claude-haiku-4-5-20251001",  # fast + cheap for extraction
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": f"""Extract product information from this retail page content.
URL: {url}

Page content:
{content}

Return ONLY valid JSON matching this schema:
{{
  "product_name": "string",
  "current_price": number,
  "original_price": number or null,
  "currency": "USD",
  "in_stock": boolean,
  "retailer": "amazon|walmart|target|bestbuy|other",
  "image_url": "string or null"
}}

If you cannot find a price, return {{"error": "price_not_found"}}."""
            }]
        )

        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        parsed = json.loads(raw)
        if "error" in parsed:
            raise ValueError(f"Could not extract price from page: {parsed['error']}")

        return ProductData(**parsed)


# Singleton
extractor = PriceExtractor()
