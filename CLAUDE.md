# DealFlow — CLAUDE.md

## Project Overview
DealFlow is an autonomous AI shopping agent built for the Insforge x Qoder AI Agent Hackathon (Seattle, March 29 2026). It monitors product prices across retailers using stock-market-style trading algorithms and auto-"buys" when prices hit optimal lows.

**Pitch:** "Robinhood for your Amazon cart — an AI agent that times your purchases so you never overpay again."

## Tech Stack
- **Mobile:** React Native (Expo) + TypeScript — `mobile/`
- **Backend BaaS:** InsForge (PostgreSQL, Auth, Edge Functions, Realtime, Storage, AI Gateway)
- **Edge Functions:** Deno runtime (`npm:@insforge/sdk`) — `insforge/functions/`
- **Agent/Scraper:** Python + crawl4ai + Anthropic SDK — `agent/`
- **LLM:** Anthropic claude-haiku-4-5 (price extraction + trading reasoning)

## InsForge Project
- **Host:** `https://nstb9s8d.us-west.insforge.app`
- **Project ID:** `a3c257ec-9dbc-4509-ad96-59781eb5ea3b`
- **Region:** `us-west`
- Config: `.insforge/project.json` (gitignored — never commit)

## Environment Variables
Mobile — copy `mobile/.env.example` → `mobile/.env`
Agent — copy `agent/.env.example` → `agent/.env`

Edge Function secrets:
```bash
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here
npx @insforge/cli secrets add AGENT_WORKER_URL http://your-agent-worker-url
```

## Project Structure
```
mobile/                               — Expo React Native app
  src/screens/                        — Wishlist, Deals, Activity, ItemDetail, Profile
  src/components/                     — ItemCard, shared UI
  src/theme/colors.ts                 — Design tokens

insforge/functions/                   — Deno edge functions (deployed to InsForge)
  price-scraper/index.js              — Triggers Python agent, writes price_history
  trading-agent/index.js              — Scoring engine + LLM reasoning, BUY/WATCH/HOLD
  buy-executor/index.js               — Records transaction, updates status, deducts wallet
  notification-dispatcher/index.js    — Pushes realtime events to frontend

agent/src/                            — Python distributed scraper worker
  scraper/price_extractor.py          — crawl4ai + Claude Haiku extracts price from any URL
  trading/signals.py                  — 4-indicator signal computation
  trading/decision.py                 — BUY/WATCH/HOLD decision engine
  reasoning/explainer.py              — Claude Haiku generates plain-English reasoning
  main.py                             — FastAPI worker (receives jobs, runs agentic loop)

agents/                               — Agent definition docs (specs + deploy instructions)
docs/                                 — Architecture, API contracts, DB schema, algorithm spec
  docs/database-setup.sql            — Single source of truth for DB (run this in InsForge)
```

## Database Tables
- `users` — wallet balance, display name (auto-created on auth signup via trigger)
- `wishlist_items` — product URL, target price, current price, status (watching/bought/paused)
- `price_history` — time series of price snapshots per item
- `transactions` — completed buys with AI-generated reasoning + saved_amount

## Agent Trading Algorithm
| Signal | Weight | Logic |
|--------|--------|-------|
| Price vs target | 40% | 1.0 if at/below target |
| 7-day moving average | 25% | 1.0 if current < MA |
| Trend direction | 20% | 1.0 declining, 0.5 flat, 0.0 rising |
| Volatility score | 15% | Inverse of coefficient of variation |

**BUY:** composite ≥ 0.75 AND price ≤ target
**WATCH:** composite ≥ 0.50
**HOLD:** composite < 0.50

## Quick Deploy Sequence
```bash
# 1. Database (single source of truth — run once in InsForge)
npx @insforge/cli db import docs/database-setup.sql

# 2. Edge function secrets
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here
npx @insforge/cli secrets add AGENT_WORKER_URL http://your-deployed-agent

# 3. Deploy edge functions
npx @insforge/cli functions deploy price-scraper
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy notification-dispatcher

# 4. Start Python agent worker
cd agent && pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000

# 5. Run mobile app
cd mobile && npm install && npx expo start --clear
```

## Testing Edge Functions
```bash
# Test scraper trigger
npx @insforge/cli functions invoke price-scraper \
  --data '{"item_id": "uuid", "product_url": "https://amazon.com/dp/B08N5KWB9H"}'

# Test trading agent
npx @insforge/cli functions invoke trading-agent \
  --data '{"item_id": "uuid"}'

# Logs
npx @insforge/cli logs function.logs
```

## Realtime Channels (mobile subscribes to these)
```
dealflow:updates        — Global: agent_decision, price_update, buy_executed
dealflow:user:{uid}     — Per-user notifications
```
