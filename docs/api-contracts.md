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
- Invokes `buy-executor`
- Publishes `agent_decision` event to `dealflow:updates`

---

## `buy-executor`

Records a completed purchase. Called by `trading-agent`; can also be called directly.

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

**Event types:** `"buy_executed"` | `"price_alert"` | `"agent_decision"`

---

## Realtime Event Schemas

### `agent_decision`
```json
{
  "id": "uuid",
  "item_id": "uuid",
  "product_name": "Sony Headphones",
  "decision": "BUY",
  "composite_score": 0.89,
  "reasoning": "...",
  "timestamp": "2026-03-29T12:00:00Z",
  "buy_price": 279.99
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
