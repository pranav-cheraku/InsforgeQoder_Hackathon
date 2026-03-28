# DealFlow

> "Robinhood for your Amazon cart — an AI agent that times your purchases so you never overpay again."

Autonomous AI shopping agent for the **Insforge x Qoder AI Agent Hackathon** (Seattle, March 29 2026).

---

## What This Repo Contains

```
backend/                  Python FastAPI — what the mobile app talks to
  main.py                 App entry, table setup, router mounts
  services/scraper.py     Claude + web_search for live prices
  services/alert_engine.py Price drop detection, buy alerts
  services/identifier.py  Claude normalizes product names
  routes/                 items, alerts, prices, search

mobile/                   React Native (Expo) — "drip." app
  src/api/client.ts       All API calls to FastAPI backend
  src/screens/            Wishlist, Deals, Activity, ItemDetail, Search

insforge/functions/       InsForge Edge Functions (Deno) — trading agent pipeline
  trading-agent/          Compute signals, BUY/WATCH/HOLD, call LLM
  confirm-buy/            User-triggered purchase execution
  buy-executor/           Record transaction, update wallet
  notification-dispatcher Log and return realtime event payloads

agents/                   Agent specs for InsForge edge functions
docs/                     Architecture, schema, algorithm, API contracts
```

---

## Running the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs at http://localhost:8000
```

Requires `.env`:
```
DATABASE_URL=postgresql+asyncpg://...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Running the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL=http://localhost:8000` in `mobile/.env` (or use the default).

---

## InsForge Edge Functions

Scraping is handled by the FastAPI backend. The 4 InsForge edge functions run the trading agent pipeline independently.

### Deploy

```bash
npx @insforge/cli whoami
npx @insforge/cli current

# Set up database
npx @insforge/cli db import docs/database-setup.sql

# Secrets
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here

# Deploy
npx @insforge/cli functions deploy notification-dispatcher
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions deploy confirm-buy

npx @insforge/cli functions list
```

### Test

```bash
# Run the trading agent
npx @insforge/cli functions invoke trading-agent \
  --data '{"item_id": "uuid"}'

# Confirm a pending buy
npx @insforge/cli functions invoke confirm-buy \
  --data '{"item_id": "uuid"}'

# Cancel a pending buy
npx @insforge/cli db query "UPDATE wishlist_items SET status='watching' WHERE id='uuid'"

# Logs
npx @insforge/cli logs function.logs
```

---

## Key Docs

| Doc | Purpose |
|-----|---------|
| `docs/architecture.md` | Full system diagram and data flow |
| `docs/database-schema.md` | Table schemas and RLS policies |
| `docs/trading-algorithm.md` | Signal math, weights, decision thresholds |
| `docs/api-contracts.md` | FastAPI + InsForge request/response shapes |
| `docs/database-setup.sql` | All SQL to run via InsForge CLI |
