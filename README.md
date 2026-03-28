# Snag

> "Robinhood for your Amazon cart — an AI agent that times your purchases so you never overpay again."

**Snag** is an autonomous AI shopping agent built for the **Insforge x Qoder AI Agent Hackathon** (Seattle, March 29 2026). It monitors product prices across retailers using stock-market-style trading algorithms and auto-executes purchases when prices hit optimal lows.

---

## How It Works

1. **Add a product** — paste a URL or type a product name. Claude identifies it and suggests a target price.
2. **Snag watches prices** — the FastAPI backend scrapes live prices across Amazon, eBay, Best Buy, Walmart, and Target using Claude + web search.
3. **AI makes trading decisions** — a composite scoring engine (price vs target, moving average, trend, volatility) evaluates whether to BUY, WATCH, or HOLD.
4. **You confirm, Snag executes** — when the score crosses the buy threshold, you get a notification. One tap confirms the purchase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo) + TypeScript |
| Backend | Python FastAPI + SQLAlchemy + asyncpg |
| BaaS | InsForge (PostgreSQL, Auth, Edge Functions, Realtime, AI Gateway) |
| Edge Functions | Deno (deployed to InsForge) |
| LLM | Anthropic Claude Haiku 4.5 — price extraction, product ID, trading reasoning |
| Scraping | Claude + `web_search_20250305` tool |

---

## Repository Structure

```
backend/                        Python FastAPI — price scraping + alert engine
  main.py                       App entry, table setup, router mounts
  services/scraper.py           Claude + web_search for live prices across retailers
  services/alert_engine.py      Price drop detection, buy alert creation
  services/identifier.py        Claude normalizes free-form product names
  services/search.py            Claude-powered product discovery
  routes/items.py               POST/GET/DELETE items, POST scan
  routes/alerts.py              GET alerts, POST dismiss/approve
  routes/prices.py              GET price history
  routes/search.py              POST product search

<<<<<<< HEAD
mobile/                   React Native (Expo) — "snag." app
  src/api/client.ts       All API calls to FastAPI backend
  src/screens/            Wishlist, Deals, Activity, ItemDetail, Search
=======
insforge/functions/             InsForge Edge Functions (Deno) — trading agent pipeline
  trading-agent/                4-signal composite scoring + LLM reasoning → BUY/WATCH/HOLD
  confirm-buy/                  User-triggered purchase execution
  buy-executor/                 Record transaction, update wallet
  notification-dispatcher/      Realtime event publishing
>>>>>>> e3103593a5a5ef49f17de68a17f0ec664359eff2

mobile/                         React Native (Expo) app
  src/screens/                  Wishlist, Deals, Activity, ItemDetail, Auth, Profile
  src/services/api.ts           All calls to FastAPI backend + InsForge SDK
  src/components/ItemCard.tsx   Watchlist item component

agent/                          Python distributed scraper worker (code complete, not deployed)
  src/scraper/price_extractor.py  crawl4ai + Claude for any retailer URL
  src/trading/signals.py          4-indicator signal computation
  src/trading/decision.py         BUY/WATCH/HOLD decision engine
  src/reasoning/explainer.py      Claude generates plain-English reasoning

agent_plans/                    Agent spec docs for each edge function
docs/                           Architecture, DB schema, trading algorithm, API contracts
```

---

## Trading Algorithm

The `trading-agent` edge function scores each item using 4 weighted signals:

| Signal | Weight | Logic |
|--------|--------|-------|
| Price vs Target | **40%** | 1.0 if at/below target; scales down proportionally above |
| 7-day Moving Average | **25%** | 1.0 if current < MA (dip signal) |
| Trend Direction | **20%** | 1.0 declining · 0.5 flat · 0.0 rising |
| Volatility (CV) | **15%** | Low volatility = safe to buy |

**Decision thresholds:**
- **BUY** — composite ≥ 0.75 AND current price ≤ target
- **WATCH** — composite ≥ 0.50
- **HOLD** — composite < 0.50

After scoring, Claude Haiku generates a 2-3 sentence plain-English explanation citing specific numbers.

---

## Running Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY + DATABASE_URL
uvicorn main:app --reload
# → http://localhost:8000
```

### Mobile App

```bash
cd mobile
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_API_URL + InsForge keys
npx expo start
```

---

## InsForge Edge Functions

### Deploy

```bash
# Database (run once)
npx @insforge/cli db import docs/database-setup.sql

# Secrets
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here

# Deploy functions (order matters)
npx @insforge/cli functions deploy notification-dispatcher
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions deploy confirm-buy

npx @insforge/cli functions list
```

### Test

```bash
# Run the trading agent on an item
npx @insforge/cli functions invoke trading-agent \
  --data '{"item_id": "your-item-uuid"}'

# Confirm a pending buy
npx @insforge/cli functions invoke confirm-buy \
  --data '{"item_id": "your-item-uuid"}'

# Cancel a pending buy (reset to watching)
npx @insforge/cli db query \
  "UPDATE wishlist_items SET status='watching' WHERE id='your-item-uuid'"

# View logs
npx @insforge/cli logs function.logs
```

---

## Demo Flow

1. Start backend and mobile app
2. Add a product (e.g., "Sony WH-1000XM5") with a target price
3. Tap **Scan** — live prices appear from multiple retailers
4. Invoke `trading-agent` — watch the composite score and decision appear
5. Seed a price point to trigger a BUY live during the demo:

```sql
INSERT INTO price_history (item_id, price, retailer)
VALUES ('your-item-uuid', 278.50, 'amazon');

UPDATE wishlist_items SET current_price = 278.50
WHERE id = 'your-item-uuid';
```

Then invoke `trading-agent` — composite crosses 0.75, BUY fires, Activity screen updates.

---

## Key Docs

| Doc | Purpose |
|-----|---------|
| `docs/architecture.md` | Full system diagram and data flow |
| `docs/trading-algorithm.md` | Signal math, weights, decision thresholds |
| `docs/database-schema.md` | Table schemas, RLS policies, realtime channels |
| `docs/api-contracts.md` | FastAPI + InsForge request/response shapes |
| `docs/database-setup.sql` | All SQL — run once via InsForge CLI |
| `plan.md` | Implementation status and known issues |

---

Built with InsForge + Anthropic Claude for the Insforge x Qoder AI Agent Hackathon, Seattle 2026.
