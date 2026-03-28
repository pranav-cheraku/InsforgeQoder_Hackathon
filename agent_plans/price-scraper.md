---
name: price-scraper
type: edge-function
slug: price-scraper
deploy: npx @insforge/cli functions deploy price-scraper
source: insforge/functions/price-scraper/index.js
---

# Price Scraper Agent

Scrapes a product page for the current price and metadata, then stores the result in the database.

## Responsibilities
- Detect retailer from URL (`amazon`, `walmart`, `target`, `bestbuy`, `ebay`)
- Fetch and parse HTML to extract price, product name, and image URL
- Use retailer-specific regex patterns for reliable extraction
- Write to `price_history` table
- Update `wishlist_items` with latest price, name, retailer, image
- Publish `price_update` event to `dealflow:updates` channel

## Hackathon Differentiator (Qoder Runtime Integration)
For unknown retailers, the scraper can call Qoder's runtime API to dynamically generate a custom parser for that specific site's HTML structure. This makes Snag work with **any** retailer without pre-built scrapers.

## Supported Retailers (Built-in)
- Amazon (`amazon.com`) — `priceAmount`, `a-offscreen` CSS class
- Walmart (`walmart.com`) — `itemprop="price"`, price JSON field
- Target (`target.com`) — `current_retail` JSON field
- Best Buy (`bestbuy.com`) — `customerPrice.regularPrice` JSON

## Fallback Behavior
If price parsing fails (blocked, CAPTCHA, etc.), the function generates a realistic demo price. This ensures the hackathon demo always works regardless of scraping success.

## Invoke
```bash
# CLI
npx @insforge/cli functions invoke price-scraper \
  --data '{"item_id": "uuid", "product_url": "https://amazon.com/dp/..."}'

# SDK
const { data } = await insforge.functions.invoke('price-scraper', {
  body: { item_id: 'uuid', product_url: 'https://...' }
})
// data: { price: 299.99, product_name: '...', retailer: 'amazon', image_url: '...' }
```

## Schedule (for production)
```bash
# Poll prices every 30 minutes for all active items
npx @insforge/cli schedules create \
  --name "Price Poll" \
  --cron "*/30 * * * *" \
  --url "https://nstb9s8d.us-west.insforge.app/functions/price-scraper" \
  --method POST
```
