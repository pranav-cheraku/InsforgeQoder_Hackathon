# DealFlow — CLAUDE.md

## Project Overview
DealFlow is an autonomous AI shopping agent built for the Insforge x Qoder AI Agent Hackathon (Seattle, March 29 2026). It monitors product prices across retailers using stock-market-style trading algorithms and auto-"buys" when prices hit optimal lows.

**Pitch:** "Robinhood for your Amazon cart — an AI agent that times your purchases so you never overpay again."

## Scope: Backend & Agent Logic Only
This repo owns:
- **InsForge Edge Functions** — 4 Deno serverless agent functions
- **Database schema** — PostgreSQL tables + RLS + triggers
- **Agent definitions** — trading algorithm, signal computation, LLM reasoning
- **Documentation** — architecture, API contracts, deploy instructions

Frontend (React Native) is owned by a separate team member.

## Tech Stack
- **Backend:** InsForge (PostgreSQL, Auth, Edge Functions, Realtime, Storage, AI Gateway)
- **Edge Functions:** Deno runtime — **no SDK** (direct REST API calls, see note below)
- **LLM:** InsForge AI Gateway → `anthropic/claude-3.5-haiku` via `POST /api/ai/chat/completion`
- **Dev Tool:** Qoder (dynamic scraper generation at runtime)

> **Note:** `npm:@insforge/sdk` has a broken internal dependency (`@insforge/shared-schemas@1.1.46`) that causes BOOT_FAILURE on the InsForge deployment platform. All functions use direct HTTP REST calls instead:
> - DB: `GET|POST|PATCH /api/database/records/{table}`
> - AI: `POST /api/ai/chat/completion` → response field is `text` (not `choices[0].message.content`)
> - Realtime: WebSocket/Socket.IO only — notification-dispatcher logs events but cannot push via REST
> - Inter-function HTTP calls cause `LOOP_DETECTED` — `confirm-buy` inlines buy logic instead of calling `buy-executor`

## InsForge Project
- **OSS Host:** `https://nstb9s8d.us-west.insforge.app`
- **Project ID:** `a3c257ec-9dbc-4509-ad96-59781eb5ea3b`
- **Region:** `us-west`
- Config: `.insforge/project.json` (gitignored — never commit)

## Environment Variables
See `.env.example`. Required secrets for Edge Functions:
```bash
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here
```

## Project Structure
```
insforge/functions/
  trading-agent/index.ts        — Scoring engine + LLM reasoning, sets pending_buy on BUY
  confirm-buy/index.ts          — User-triggered: executes confirmed purchase
  buy-executor/index.ts         — Records transaction, updates status, deducts wallet
  notification-dispatcher/index.ts — Logs and returns realtime event payloads

agents/
  trading-agent.md              — Agent definition, signals, deploy instructions
  confirm-buy.md                — Confirm-buy agent definition
  buy-executor.md               — Buy executor definition
  notification-dispatcher.md    — Notification agent definition

docs/
  architecture.md               — Full system design and data flow
  database-schema.md            — Table schemas + RLS policies
  api-contracts.md              — Edge Function request/response contracts
  trading-algorithm.md          — Signal indicators and decision thresholds
  database-setup.sql            — All SQL to run in InsForge
```

## Database Tables
- `users` — wallet balance, display name (auto-created on auth signup)
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
# 1. Verify auth + project link
npx @insforge/cli whoami
npx @insforge/cli current

# 2. Set up database
npx @insforge/cli db import docs/database-setup.sql

# 3. Add secrets
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here

# 4. Deploy all edge functions
npx @insforge/cli functions deploy notification-dispatcher
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions deploy confirm-buy

# 5. Verify
npx @insforge/cli functions list

# 6. Seed demo data (after sign-up — replace DEMO_USER_ID)
# Edit and run the seed section in docs/database-setup.sql
```

## Testing Functions
```bash
# 1. Run the trading agent — returns decision + signals
npx @insforge/cli functions invoke trading-agent \
  --data '{"item_id": "uuid"}'
# On BUY: item status becomes 'pending_buy', buy_pending event fired

# 3. Confirm the buy (user action)
npx @insforge/cli functions invoke confirm-buy \
  --data '{"item_id": "uuid"}'
# Status becomes 'bought', budget deducted, buy_executed event fired

# Cancel a pending buy (reset to watching)
npx @insforge/cli db query "UPDATE wishlist_items SET status='watching' WHERE id='uuid'"

# Check logs if something fails
npx @insforge/cli logs function.logs
```

## API Contracts (for frontend teammate)
See `docs/api-contracts.md` for all Edge Function request/response shapes and realtime event schemas.

## Realtime Channels (frontend needs these)
```
dealflow:updates        — Global: buy_pending, agent_decision, price_update, buy_executed
dealflow:user:{uid}     — Per-user notifications
```

Subscribe pattern (for frontend reference):
```ts
await insforge.realtime.connect()
await insforge.realtime.subscribe('dealflow:updates')
insforge.realtime.on('buy_pending', handler)     // Show confirmation UI
insforge.realtime.on('agent_decision', handler)  // WATCH/HOLD decisions
insforge.realtime.on('price_update', handler)
insforge.realtime.on('buy_executed', handler)
```
