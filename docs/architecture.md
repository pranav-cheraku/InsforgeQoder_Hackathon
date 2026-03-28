# System Architecture

## Overview

Snag is an autonomous AI shopping agent that monitors product prices using stock-market-style trading algorithms and auto-"buys" when prices hit optimal lows.

```
┌─────────────────────────────────────────────────────────────────┐
│                  Mobile App (React Native/Expo)                  │
│   "Snag" — talks to FastAPI backend at localhost:8000           │
└──────────────────────┬──────────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────────┐
│                  FastAPI Backend (Python)                         │
│                                                                  │
│  POST /items          — add product, Claude identifies it        │
│  POST /items/{id}/scan — fetch live prices via Claude web_search │
│  GET  /alerts         — surface agent buy recommendations        │
│  POST /alerts/{id}/approve — user confirms buy                   │
│  POST /search         — search for products via Claude           │
│                                                                  │
│  services/scraper.py  — Claude + web_search for live prices      │
│  services/alert_engine.py — price drop detection, buy alerts     │
│  services/identifier.py   — Claude normalizes product names      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ asyncpg / SQLAlchemy
┌──────────────────────▼──────────────────────────────────────────┐
│                  InsForge Backend                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  PostgreSQL   │  │     Auth      │  │      Realtime         │  │
│  │  (4 tables)   │  │  (email/pw)   │  │  (WebSockets)         │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              InsForge Edge Functions (Deno)               │   │
│  │                                                           │   │
│  │  trading-agent  →  [pending_buy]                          │   │
│  │                         │                                 │   │
│  │           user confirms → confirm-buy                     │   │
│  │                         │                                 │   │
│  │               buy-executor  ←──────┘                     │   │
│  │                         │                                 │   │
│  │              notification-dispatcher                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐                                                │
│  │  AI Gateway   │  anthropic/claude-3.5-haiku (agent reasoning) │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
1. User adds product name or URL in mobile app
        │  POST /search or POST /items  (FastAPI)
        ▼
2. FastAPI scraper fetches live prices
   → Claude (claude-sonnet-4-6) + web_search tool
   → Finds prices across Amazon, eBay, Best Buy, Walmart
   → Writes PriceSnapshot rows to PostgreSQL
   → alert_engine checks for price drop vs target
        │
        ▼
3. User scans item (or auto-scan on open)
   → POST /items/{id}/scan
   → Synchronous Claude web_search — returns up to 5 retailer prices
   → check_price_drop() fires alert if price ≤ target or dropped 10%+
        │
        ▼
4. Activity screen polls GET /alerts
   → Agent surfaces buy recommendation (requires_permission = true)
   → User taps "Buy now" → POST /alerts/{id}/approve
   → Returns order confirmation
        │
        ▼ (InsForge edge functions — invoked independently)
5. trading-agent runs against price_history
   → Computes 4 weighted signals → composite score
   → Calls InsForge AI Gateway → Claude Haiku generates reasoning
   → BUY (≥0.75 + below target): sets wishlist_items.status = 'pending_buy'
   → WATCH/HOLD: publishes agent_decision event
        │
        ▼  (only on BUY — user receives buy_pending notification)
6. User confirms via confirm-buy edge function
   → Verifies status = 'pending_buy'
   → Inserts transaction, sets status = 'bought', deducts budget
   → Fires buy_executed event via notification-dispatcher
```

## Scraping: FastAPI vs InsForge

Price scraping is handled entirely by the **FastAPI backend** (`backend/services/scraper.py`).

| | FastAPI scraper | InsForge (removed) |
|---|---|---|
| Method | Claude + `web_search_20250305` tool | HTML regex parsing |
| Amazon | Works | Blocked |
| Retailers | All (5 at once) | Walmart, Target, Best Buy only |
| Fallback | Claude training knowledge | ~~Demo drift prices~~ |

The InsForge `price-scraper` edge function has been removed. All price data enters the system through the FastAPI backend.

## InsForge Feature Map

| Feature | Usage |
|---------|-------|
| **PostgreSQL** | All data storage. Auto-exposed as REST API |
| **Auth** | Email/password signup + sessions. RLS ties data to user |
| **Edge Functions** | 4 Deno functions: trading-agent, confirm-buy, buy-executor, notification-dispatcher |
| **AI Gateway** | `anthropic/claude-3.5-haiku` — generates agent reasoning text |
| **Realtime** | WebSocket push of agent decisions to frontend |

## Edge Function Chain

```
trading-agent
  ├─► reads price_history
  ├─► computes signals
  ├─► calls AI Gateway for reasoning
  ├─► (if BUY) sets status = pending_buy, publishes buy_pending
  └─► (if WATCH/HOLD) publishes agent_decision

confirm-buy  ← called by user via frontend
  └─► inlines buy-executor logic (no inter-function HTTP — LOOP_DETECTED)

buy-executor  ← called directly for testing
  ├─► inserts transaction
  ├─► updates wishlist status → bought
  ├─► deducts wallet
  └─► invokes notification-dispatcher

notification-dispatcher
  └─► logs event, returns enriched payload (WebSocket push not available via REST)
```

## Team Responsibilities

| Area | Owner |
|------|-------|
| Agent Brain (trading-agent, buy-executor) | Person 1 (AI/ML) |
| Backend Infra (FastAPI, DB, Edge Functions) | Person 2 (Backend) — this repo |
| Mobile UI (React Native) | Person 3 (Frontend) — mobile/ directory |
