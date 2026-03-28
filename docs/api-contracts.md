# API Contracts

## FastAPI Backend (Mobile App)

Base URL: `http://localhost:8000` (dev) / `EXPO_PUBLIC_API_URL`

---

### `POST /items`
Add a product to the watchlist. Claude normalizes the name and triggers a background price scrape.

**Request**
```json
{
  "name": "Sony WH-1000XM5",
  "url": "https://amazon.com/dp/B09XS7JWHH",
  "target_price": 280.00
}
```

**Response (200)**
```json
{
  "id": "uuid",
  "name": "Sony WH-1000XM5 Wireless Headphones",
  "subtitle": "Industry-leading noise canceling",
  "image_emoji": "🎧",
  "target_price": 280.00,
  "best_price": null,
  "avg_price": null,
  "trend": "avg"
}
```

---

### `GET /items`
List all watchlist items with latest prices.

**Response (200)**
```json
[
  {
    "id": "uuid",
    "name": "Sony WH-1000XM5 Wireless Headphones",
    "subtitle": "Industry-leading noise canceling",
    "image_emoji": "🎧",
    "target_price": 280.00,
    "best_price": 269.99,
    "avg_price": 299.99,
    "trend": "deal",
    "sources": [
      {
        "source_name": "Amazon",
        "source_url": "https://...",
        "price": 269.99,
        "availability": "in_stock"
      }
    ]
  }
]
```

**Trend values:** `"deal"` (best ≤ target) | `"low"` (best < avg) | `"avg"`

---

### `DELETE /items/{id}`
Remove item from watchlist.

---

### `POST /items/{id}/scan`
Synchronously fetch fresh prices via Claude web_search, run alert checks.

**Response (200)** — same shape as `GET /items` single item

---

### `GET /alerts`
List undismissed alerts.

**Response (200)**
```json
[
  {
    "id": "uuid",
    "item_id": "uuid",
    "alert_type": "target_price",
    "message": "Price dropped to $269.99 — below your $280 target on Amazon",
    "price": 269.99,
    "source_name": "Amazon",
    "source_url": "https://...",
    "requires_permission": true,
    "dismissed": false,
    "created_at": "2026-03-29T12:00:00Z"
  }
]
```

**Alert types:** `"target_price"` (price ≤ target) | `"price_drop"` (dropped ≥10% from last snapshot)

---

### `POST /alerts/{id}/dismiss`
Dismiss an alert without buying.

---

### `POST /alerts/{id}/approve`
User confirms the buy. Returns order confirmation.

**Response (200)**
```json
{
  "order_id": "DRP-4821",
  "item_name": "Sony WH-1000XM5 Wireless Headphones",
  "price": 269.99,
  "source": "Amazon",
  "estimated_delivery": "2 business days"
}
```

---

### `GET /prices/{item_id}/history`
Last 30 price snapshots grouped by source.

**Response (200)**
```json
{
  "Amazon": [
    { "price": 269.99, "scraped_at": "2026-03-29T12:00:00Z" }
  ],
  "Best Buy": [
    { "price": 279.99, "scraped_at": "2026-03-29T12:00:00Z" }
  ]
}
```

---

### `POST /search`
Search for products to add.

**Request**
```json
{ "query": "noise canceling headphones under 300" }
```

**Response (200)**
```json
[
  {
    "name": "Sony WH-1000XM5",
    "subtitle": "Industry-leading noise canceling",
    "image_emoji": "🎧",
    "price": 279.99,
    "source_name": "Amazon",
    "source_url": "https://..."
  }
]
```

---

## InsForge Edge Functions

All functions deployed to `https://nstb9s8d.us-west.insforge.app/functions/{slug}`.

> **Note:** Price scraping is handled by the FastAPI backend. The InsForge `price-scraper` function has been removed. Edge functions below operate on price data already in the database.

---

### `trading-agent`

Analyzes price history and makes a BUY / WATCH / HOLD decision.

**Request**
```json
{ "item_id": "uuid" }
```

**Response (200)**
```json
{
  "decision": "BUY",
  "signals": {
    "priceVsTarget": 0.95,
    "movingAverage": 0.82,
    "trendDirection": 1.0,
    "volatility": 0.75,
    "composite": 0.89
  },
  "reasoning": "Price dropped 18% over 5 days, now $12 below your target..."
}
```

**Decision values:** `"BUY"` | `"WATCH"` | `"HOLD"`

**Side effects (on BUY):**
- Sets `wishlist_items.status = 'bought'`
- Inserts transaction record
- Deducts `buy_price` from `users.budget`
- Publishes `buy_executed` event

**Side effects (on WATCH / HOLD):**
- Publishes `agent_decision` event

**Error responses:**
- `409` — item status is not `'watching'`

---

### `confirm-buy`

Executes a purchase the user has confirmed. Item must be in `pending_buy` status.

**Request**
```json
{ "item_id": "uuid" }
```

**Response (200)**
```json
{
  "transaction_id": "uuid",
  "buy_price": 279.99,
  "saved_amount": 70.00,
  "reasoning": "Purchase confirmed by user at $279.99."
}
```

**Side effects:**
- Inserts row in `transactions`
- Sets `wishlist_items.status = 'bought'`
- Deducts `buy_price` from `users.budget`
- Publishes `buy_executed` event

**Error responses:**
- `404` — item not found
- `409` — item status is not `'pending_buy'`

**To cancel a pending buy (reset to watching):**
```
PATCH /api/database/records/wishlist_items?id=eq.{item_id}
{ "status": "watching" }
```

---

### `buy-executor`

Records a completed purchase. Used directly for testing.

**Request**
```json
{
  "item_id": "uuid",
  "user_id": "uuid",
  "buy_price": 279.99,
  "market_price": 349.99,
  "reasoning": "Price dropped 18%..."
}
```

**Response (200)**
```json
{
  "transaction_id": "uuid",
  "buy_price": 279.99,
  "saved_amount": 70.00,
  "reasoning": "Price dropped 18%..."
}
```

---

### `notification-dispatcher`

Publishes an event to the realtime channel.

**Request**
```json
{
  "user_id": "uuid",
  "item_id": "uuid",
  "event_type": "buy_executed",
  "payload": {
    "buy_price": 279.99,
    "saved_amount": 70.00,
    "reasoning": "..."
  }
}
```

**Response (200)**
```json
{
  "dispatched": true,
  "event_type": "buy_executed",
  "channel": "snag:updates"
}
```

**Event types:** `"buy_executed"` | `"agent_decision"` | `"buy_pending"`

---

## Realtime Event Schemas

### `buy_pending`
```json
{
  "item_id": "uuid",
  "user_id": "uuid",
  "product_name": "Sony Headphones",
  "event_type": "buy_pending",
  "proposed_price": 279.99,
  "market_price": 349.99,
  "composite_score": 0.89,
  "reasoning": "Price at $279.99 is below your $298 target...",
  "timestamp": "2026-03-29T12:00:00Z"
}
```

### `agent_decision`
```json
{
  "item_id": "uuid",
  "product_name": "Sony Headphones",
  "decision": "WATCH",
  "composite_score": 0.72,
  "reasoning": "...",
  "timestamp": "2026-03-29T12:00:00Z"
}
```

### `buy_executed`
```json
{
  "id": "uuid",
  "item_id": "uuid",
  "user_id": "uuid",
  "product_name": "Sony Headphones",
  "event_type": "buy_executed",
  "buy_price": 279.99,
  "saved_amount": 70.00,
  "reasoning": "...",
  "timestamp": "2026-03-29T12:00:00Z"
}
```
