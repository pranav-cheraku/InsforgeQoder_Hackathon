# DealFlow Backend — Implementation Plan

**Deadline:** March 29 2026
**Runtime:** Deno (InsForge Edge Functions)
**Rule:** Implement → Deploy → Test → Move on. One function at a time.

---

## Implementation Status — COMPLETE ✅

| Function | Status | Deployed |
|---|---|---|
| notification-dispatcher | ✅ Live | 3/28/2026 11:30 AM |
| buy-executor | ✅ Live | 3/28/2026 11:41 AM |
| price-scraper | ✅ Live | 3/28/2026 11:41 AM |
| trading-agent | ✅ Live | 3/28/2026 (updated for confirm flow) |
| confirm-buy | ✅ Live | 3/28/2026 |

**Critical implementation note:** `npm:@insforge/sdk` causes BOOT_FAILURE due to broken `@insforge/shared-schemas@1.1.46` dependency. All functions use direct REST API calls instead:
- DB: `GET|POST|PATCH /api/database/records/{table}`
- AI: `POST /api/ai/chat/completion` → response `.text` field
- Realtime: WebSocket-only, notification-dispatcher logs events and returns success

**Inter-function calls cause LOOP_DETECTED:** Edge functions cannot call sibling functions via HTTP fetch. `confirm-buy` inlines the buy-executor logic instead of delegating.

**User confirmation flow:** trading-agent no longer auto-executes buys. On BUY decision it sets `status = 'pending_buy'` and sends `buy_pending` notification. User must call `confirm-buy` to execute.

**DB schema change:** `wishlist_items.status` now allows `pending_buy` in addition to `watching`, `bought`, `paused`. Added `wishlist_update_service` RLS policy to allow edge function status updates.

---

## Pre-Implementation Checklist

Already verified ✅ — all of these are confirmed good:
- Auth: `pranavcheraku@gmail.com` logged in
- Project linked: `InsforgeQoder_Hackathon` (`a3c257ec`)
- Secrets: `INSFORGE_BASE_URL` and `ANON_KEY` set
- Database: all 4 tables + RLS policies in place

---

## Implementation Order (bottom-up by dependency)

```
1. notification-dispatcher   — no outgoing calls, publish-only
2. buy-executor              — calls notification-dispatcher
3. price-scraper             — calls notification-dispatcher
4. trading-agent             — calls buy-executor + notification-dispatcher, most complex
```

---

## Function 1: `notification-dispatcher`

**File:** `insforge/functions/notification-dispatcher/index.js`

No dependencies. Deploy this first — every other function calls it.

### What it does
- Optionally enriches payload with `product_name` from `wishlist_items`
- Publishes event to `dealflow:updates` (global)
- Publishes event to `dealflow:user:{user_id}` (per-user)
- Returns `{ dispatched: true, event_type, channel }`

### Key notes
- Uses `anonKey` (already in stub) — do NOT change to `edgeFunctionToken`
- Wrap the DB lookup in try/catch — a missing item must not block dispatch
- `realtime.publish(channelName, eventName, payload)` — order matters

### Test command
```bash
npx @insforge/cli functions invoke notification-dispatcher \
  --data '{"user_id":"00000000-0000-0000-0000-000000000001","item_id":"11111111-0000-0000-0000-000000000001","event_type":"agent_decision","payload":{"decision":"WATCH","composite_score":0.62}}'
```

### Expected response
```json
{ "dispatched": true, "event_type": "agent_decision", "channel": "dealflow:updates" }
```

### Verify
- HTTP 200 (not 501)
- `dispatched: true` in response
- No errors in `npx @insforge/cli logs function.logs`

---

## Function 2: `buy-executor`

**File:** `insforge/functions/buy-executor/index.js`

Depends on: `notification-dispatcher` deployed and passing.

### What it does
1. Inserts row into `transactions`
2. Sets `wishlist_items.status = 'bought'`
3. Fetches user budget, deducts `buy_price`, updates `users.budget`
4. Invokes `notification-dispatcher` via `fetch` with `buy_executed` event
5. Returns `{ transaction_id, buy_price, saved_amount, reasoning }`

### CRITICAL: Do NOT insert `saved_amount`
`saved_amount` is a `GENERATED ALWAYS` computed column in PostgreSQL. Including it in `.insert()` will throw a runtime error. Only read it back after the insert returns.

### Budget deduction pattern (no atomic increment in SDK)
```js
const { data: user } = await client.db.from('users').select('budget').eq('id', user_id).single()
const newBudget = parseFloat(user.budget) - parseFloat(buy_price)
await client.db.from('users').update({ budget: newBudget }).eq('id', user_id)
```

### Inter-function call pattern
```js
await fetch(`${Deno.env.get('INSFORGE_BASE_URL')}/functions/notification-dispatcher`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': req.headers.get('Authorization') ?? '',
  },
  body: JSON.stringify({ user_id, item_id, event_type: 'buy_executed', payload: { ... } }),
})
// fire-and-forget — don't let notification failure break the buy
```

### Test command
```bash
npx @insforge/cli functions invoke buy-executor \
  --data '{"item_id":"11111111-0000-0000-0000-000000000001","user_id":"DEMO_USER_ID","buy_price":279.99,"market_price":349.99,"reasoning":"Test buy"}'
```

### Expected response
```json
{ "transaction_id": "<uuid>", "buy_price": 279.99, "saved_amount": 70.00, "reasoning": "Test buy" }
```

### Verify
- New row in `transactions`
- `wishlist_items` status = `'bought'`
- `users.budget` decreased by 279.99
- `notification-dispatcher` logs show `buy_executed` event

---

## Function 3: `price-scraper`

**File:** `insforge/functions/price-scraper/index.js`

Depends on: `notification-dispatcher` deployed and passing.

### What it does
1. Detects retailer from URL
2. Fetches HTML with browser User-Agent, parses price using retailer-specific regex
3. **Falls back to demo price if scraping fails** (expected — Amazon blocks scrapers)
4. Inserts into `price_history`
5. Updates `wishlist_items` (current_price, product_name, retailer, image_url)
6. Invokes `notification-dispatcher` with `price_update` event
7. Returns `{ price, product_name, retailer, image_url }`

### Retailer detection
```js
function detectRetailer(url) {
  if (url.includes('amazon.com'))   return 'amazon'
  if (url.includes('walmart.com'))  return 'walmart'
  if (url.includes('target.com'))   return 'target'
  if (url.includes('bestbuy.com'))  return 'bestbuy'
  if (url.includes('ebay.com'))     return 'ebay'
  return 'unknown'
}
```

### Demo price fallback (critical for hackathon)
When scraping fails, generate a price that drifts slightly downward from the existing price:
```js
function generateDemoPrice(existingPrice) {
  const base = existingPrice ? parseFloat(existingPrice) : 299.99
  const drift = base * (0.003 + Math.random() * 0.012)
  const jitter = (Math.random() - 0.5) * base * 0.005
  return Math.max(1, parseFloat((base - drift + jitter).toFixed(2)))
}
```

### Scraping with timeout
```js
const res = await fetch(product_url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...' },
  signal: AbortSignal.timeout(8000),
})
```

### Important: fetch `user_id` from wishlist_items
The `price_update` notification needs `user_id`. Make sure the DB select includes it:
```js
.select('current_price, product_name, retailer, user_id')
```

### Test command
```bash
npx @insforge/cli functions invoke price-scraper \
  --data '{"item_id":"11111111-0000-0000-0000-000000000001","product_url":"https://amazon.com/dp/B08N5KWB9H"}'
```

### Expected response
```json
{ "price": 299.99, "product_name": "Sony WH-1000XM4 Headphones", "retailer": "amazon", "image_url": null }
```

### Verify
- Response has a numeric `price` (fallback fires almost always for Amazon — that's fine)
- New row in `price_history`
- `wishlist_items.current_price` updated
- Test with a bad URL — should still return a price (fallback path)

---

## Function 4: `trading-agent`

**File:** `insforge/functions/trading-agent/index.js`

Depends on: all three other functions deployed and passing.

### What it does
1. Loads `wishlist_item`, returns 409 if status ≠ `'watching'`
2. Loads last 30 `price_history` records (ascending by `scraped_at`)
3. Computes 4 signals + composite score
4. Makes BUY / WATCH / HOLD decision
5. Calls AI Gateway (claude-3.5-haiku) for reasoning; falls back to deterministic string on error
6. If BUY → invokes `buy-executor` via `fetch`
7. Invokes `notification-dispatcher` with `agent_decision` event
8. Returns `{ decision, signals, reasoning }`

### Signal functions (define at module scope, pure functions)

```js
function computePriceVsTarget(current, target) {
  if (current <= target) return 1.0
  return Math.max(0, 1 - (current - target) / target)
}

function computeMovingAverage(current, prices) {
  const window = prices.slice(-7)
  if (window.length === 0) return 0.5
  const ma = window.reduce((a, b) => a + b, 0) / window.length
  if (current < ma) return 1.0
  return Math.max(0, 1 - (current - ma) / ma)
}

function computeTrendDirection(prices) {
  const tail = prices.slice(-3)
  if (tail.length < 2) return 0.5
  const declining = tail.every((v, i) => i === 0 || v < tail[i - 1])
  const rising    = tail.every((v, i) => i === 0 || v > tail[i - 1])
  if (declining) return 1.0
  if (rising)    return 0.0
  return 0.5
}

function computeVolatility(prices) {
  const window = prices.slice(-7)
  if (window.length < 2) return 0.5
  const mean = window.reduce((a, b) => a + b, 0) / window.length
  if (mean === 0) return 0.5
  const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length
  const cv = Math.sqrt(variance) / mean
  if (cv < 0.02) return 1.0
  if (cv < 0.05) return 0.75
  if (cv < 0.10) return 0.5
  if (cv < 0.20) return 0.25
  return 0.0
}
```

### Decision logic
```js
// BUY requires BOTH conditions — do not check only one
if (composite >= THRESHOLDS.BUY && currentPrice <= targetPrice) return 'BUY'
if (composite >= THRESHOLDS.WATCH) return 'WATCH'
return 'HOLD'
```

### AI Gateway call + fallback
```js
let reasoning = ''
try {
  const response = await client.ai.chat({
    model: 'anthropic/claude-3.5-haiku',
    messages: [{ role: 'user', content: `...context...` }],
    system: 'You are DealFlow, an AI trading agent...',
  })
  reasoning = response.choices[0].message.content
} catch (_) {
  // Deterministic fallback — always works
  reasoning = decision === 'BUY'
    ? `Price at $${currentPrice} is at or below your $${targetPrice} target (composite: ${signals.composite}). Executing buy.`
    : `Price at $${currentPrice} vs target $${targetPrice} — composite score ${signals.composite}. ${decision === 'WATCH' ? 'Monitoring.' : 'Holding.'}`
}
```

### Current price null guard
```js
const currentPrice = parseFloat(item.current_price ?? item.target_price)
```

### market_price for buy-executor
Send `item.highest_price` as `market_price` so `saved_amount` is meaningful:
```js
market_price: item.highest_price ?? currentPrice
```

### Test command
```bash
npx @insforge/cli functions invoke trading-agent \
  --data '{"item_id":"11111111-0000-0000-0000-000000000001"}'
```

### Expected response
```json
{
  "decision": "WATCH",
  "signals": {
    "priceVsTarget": 0.93,
    "movingAverage": 0.81,
    "trendDirection": 1.0,
    "volatility": 0.75,
    "composite": 0.88
  },
  "reasoning": "Price dropped 8% over the past week..."
}
```

### Verify
- Valid `decision` string returned (not 501)
- All 5 signal fields present, values between 0 and 1
- `reasoning` is a non-empty string
- On BUY: transaction inserted, item status = `'bought'`
- On repeat call after BUY: returns 409 (item no longer `'watching'`)

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Amazon blocks scraping | Fallback price generator — expected, handled |
| AI Gateway timeout | try/catch with deterministic fallback — never blocks response |
| `saved_amount` insert error | Never insert this column — `GENERATED ALWAYS` |
| Budget goes negative | Acceptable for hackathon demo |
| `current_price` is null | Fall back to `target_price` |
| Empty `price_history` | Window signals return 0.5 neutral — still produces a decision |
| Item not `'watching'` | Return 409 — prevents double-buy |
| `notification-dispatcher` not deployed yet | Deploy it first, always |

---

## Demo Setup (after all functions pass)

1. Sign up via frontend or InsForge dashboard — get your UUID from `auth.users`
2. Uncomment seed block in `docs/database-setup.sql`, replace `DEMO_USER_ID`, run import
3. To trigger a live BUY during demo:
   ```sql
   -- Insert a below-target price point for Sony headphones
   INSERT INTO price_history (item_id, price, retailer)
   VALUES ('11111111-0000-0000-0000-000000000001', 278.50, 'amazon');

   UPDATE wishlist_items SET current_price = 278.50
   WHERE id = '11111111-0000-0000-0000-000000000001';
   ```
   Then invoke `trading-agent` — composite crosses 0.75, BUY fires live.

4. **Demo arc:**
   - Show WATCH: invoke `trading-agent` on iPad (item 002)
   - Show BUY: invoke `trading-agent` on Sony after price manipulation
   - Show realtime: have frontend WebSocket open during step 2 — `buy_executed` appears live

---

## Full Deploy Sequence

```bash
npx @insforge/cli functions deploy notification-dispatcher
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy price-scraper
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions list
```
