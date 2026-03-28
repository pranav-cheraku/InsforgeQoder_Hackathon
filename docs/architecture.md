# System Architecture

## Overview

DealFlow is an autonomous AI shopping agent that monitors product prices using stock-market-style trading algorithms and auto-"buys" when prices hit optimal lows.

> **Note:** This repo covers the **backend and agent logic only**. Frontend is handled by a separate teammate.

```
┌─────────────────────────────────────────────────────────────────┐
│                  Frontend (separate teammate)                    │
│   @insforge/sdk — REST + WebSocket to InsForge                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ REST API + WebSockets
┌──────────────────────▼──────────────────────────────────────────┐
│                  InsForge Backend                                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  PostgreSQL   │  │     Auth      │  │      Realtime         │  │
│  │  (4 tables)   │  │  (email/pw)   │  │  (WebSockets)         │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Edge Functions (Deno)                    │   │
│  │                                                           │   │
│  │  price-scraper  →  trading-agent  →  buy-executor        │   │
│  │                                        │                  │   │
│  │                           notification-dispatcher         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────────────────────────┐     │
│  │  AI Gateway   │  │            Storage                   │     │
│  │  (Claude Haiku│  │  (product images)                    │     │
│  └──────────────┘  └──────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
1. Frontend: User adds product URL + target price
        │  POST /wishlist_items  (InsForge REST API auto-exposes this)
        ▼
2. Frontend invokes price-scraper
   → Scrapes price from retailer HTML
   → Writes price_history record
   → Updates wishlist_items.current_price, product_name, image_url
   → Publishes 'price_update' to dealflow:updates channel
        │
        ▼
3. Frontend (or schedule) invokes trading-agent
   → Loads price_history (last 30 records)
   → Computes 4 weighted signals → composite score
   → Calls InsForge AI Gateway → Claude Haiku generates reasoning
   → Decision: BUY (≥0.75 + below target) | WATCH (≥0.50) | HOLD
   → Publishes 'agent_decision' to dealflow:updates channel
        │
        ▼  (only on BUY decision)
4. trading-agent invokes buy-executor
   → Inserts transaction record
   → Sets wishlist_items.status = 'bought'
   → Deducts buy_price from users.budget
   → Invokes notification-dispatcher
        │
        ▼
5. notification-dispatcher publishes to realtime
   → 'buy_executed' event → dealflow:updates + dealflow:user:{uid}
        │
        ▼
6. Frontend (WebSocket listener) receives event
   → Updates price chart, agent feed, portfolio stats in real time
```

## InsForge Feature Map

| Feature | Usage |
|---------|-------|
| **PostgreSQL** | All data storage. Auto-exposed as REST API — zero endpoint code needed |
| **Auth** | Email/password signup + sessions. RLS ties data to user |
| **Edge Functions** | 4 Deno functions: scraper, agent, executor, notifier |
| **AI Gateway** | `anthropic/claude-3.5-haiku` — generates agent reasoning text |
| **Realtime** | WebSocket push of price updates and agent decisions to frontend |
| **Storage** | Product image thumbnails cached from scraper |

## Qoder Integration (Killer Differentiator)

Qoder is used in two ways:

**1. As a development tool:** Generates code across all layers simultaneously.

**2. As a runtime feature (unique):** When a user pastes a product URL from an unknown retailer, `price-scraper` calls Qoder's runtime API to:
- Analyze the HTML structure of the page
- Generate a custom price-extraction parser for that retailer
- Cache the parser for future use

This means DealFlow works with **any retailer** without pre-built scrapers — a feature no other team will have.

## Edge Function Chain

```
price-scraper
  └─► updates DB + publishes price_update

trading-agent
  ├─► reads price_history
  ├─► computes signals
  ├─► calls AI Gateway for reasoning
  ├─► (if BUY) invokes buy-executor
  └─► publishes agent_decision

buy-executor
  ├─► inserts transaction
  ├─► updates wishlist status
  ├─► deducts wallet
  └─► invokes notification-dispatcher

notification-dispatcher
  └─► publishes to realtime channels
```

## Team Responsibilities

| Area | Owner |
|------|-------|
| Agent Brain (trading-agent, buy-executor) | Person 1 (AI/ML) |
| Backend Infra (DB, Edge Functions, Realtime) | Person 2 (Backend) — this repo |
| Frontend UI (React Native) | Person 3 (Frontend) — separate repo |
