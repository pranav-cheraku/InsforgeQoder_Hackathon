# Edge Function API Contracts

All functions are deployed to `https://nstb9s8d.us-west.insforge.app/functions/{slug}`.

SDK invocation: `insforge.functions.invoke(slug, { body: {...} })`

---

## `price-scraper`

Scrapes a product URL for current price, updates the wishlist item, and writes a price_history record.

**Request**
```json
{
  "item_id": "uuid",
  "product_url": "https://amazon.com/dp/..."
}
```

**Response (200)**
```json
{
  "price": 299.99,
  "product_name": "Sony WH-1000XM4 Headphones",
  "retailer": "amazon",
  "image_url": "https://..."
}
```

**Side effects:**
- Inserts row in `price_history`
- Updates `wishlist_items.current_price`, `.product_name`, `.retailer`, `.image_url`
- Publishes `price_update` event to `dealflow:updates`

---

## `trading-agent`

Analyzes price history for a product and makes a BUY / WATCH / HOLD decision.

**Request**
```json
{
  "item_id": "uuid"
}
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
- Sets `wishlist_items.status = 'pending_buy'`
- Publishes `buy_pending` event to `dealflow:updates` — frontend must show confirmation UI

**Side effects (on WATCH / HOLD):**
- Publishes `agent_decision` event to `dealflow:updates`

**Error responses:**
- `409` — item status is not `'watching'` (e.g. already `pending_buy` or `bought`)

---

## `confirm-buy`

Executes a purchase the user has confirmed. Item must be in `pending_buy` status.

**Request**
```json
{
  "item_id": "uuid"
}
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
- Publishes `buy_executed` event to `dealflow:updates`

**Error responses:**
- `404` — item not found
- `409` — item status is not `'pending_buy'`

**To cancel a pending buy (reset to watching):**
```
PATCH /api/database/records/wishlist_items?id=eq.{item_id}
{ "status": "watching" }
```

---

## `buy-executor`

Records a completed purchase. Can be called directly for testing/demo purposes.

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

**Side effects:**
- Inserts row in `transactions`
- Sets `wishlist_items.status = 'bought'`
- Deducts `buy_price` from `users.budget`
- Invokes `notification-dispatcher`

---

## `notification-dispatcher`

Publishes an event to the realtime channel. Called by `buy-executor` and `trading-agent`.

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
  "channel": "dealflow:updates"
}
```

**Event types:** `"buy_executed"` | `"price_alert"` | `"agent_decision"` | `"buy_pending"`

---

## Realtime Event Schemas

### `buy_pending`
Fired when trading-agent decides BUY and is awaiting user confirmation.
```json
{
  "item_id": "uuid",
  "user_id": "uuid",
  "product_name": "Sony Headphones",
  "event_type": "buy_pending",
  "proposed_price": 279.99,
  "market_price": 349.99,
  "composite_score": 0.9943,
  "reasoning": "Price at $279.99 is at or below your $298 target...",
  "timestamp": "2026-03-29T12:00:00Z"
}
```

### `agent_decision`
Fired for WATCH and HOLD decisions only.
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

### `price_update`
```json
{
  "item_id": "uuid",
  "price": 279.99,
  "retailer": "amazon"
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
