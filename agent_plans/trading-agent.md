---
name: trading-agent
type: edge-function
slug: trading-agent
deploy: npx @insforge/cli functions deploy trading-agent
source: insforge/functions/trading-agent/index.ts
---

# Trading Agent

The core agent brain. Analyzes price history for a wishlist item and makes a BUY / WATCH / HOLD decision. On BUY, it sets the item to `pending_buy` and notifies the user — the purchase only executes after the user confirms via `confirm-buy`.

## Responsibilities
- Load price history from `price_history` table (up to 30 records)
- Compute 4 signal indicators with weighted scoring
- Generate human-readable reasoning via InsForge AI Gateway (Claude Haiku)
- On BUY: set `wishlist_items.status = 'pending_buy'`, publish `buy_pending` event
- On WATCH/HOLD: publish `agent_decision` event to `dealflow:updates` realtime channel

## Signals & Weights

| Signal | Weight | Logic |
|--------|--------|-------|
| Price vs Target | 40% | 1.0 if at/below target; scales proportionally above |
| Moving Average (7d) | 25% | 1.0 if current < MA; scales down if above |
| Trend Direction | 20% | 1.0 declining, 0.5 flat, 0.0 rising (last 3 points) |
| Volatility (CV) | 15% | Inverse of coefficient of variation |

## Decision Thresholds
- **BUY**: composite ≥ 0.75 AND current_price ≤ target_price
- **WATCH**: composite ≥ 0.50
- **HOLD**: composite < 0.50

## Invoke
```bash
# CLI
npx @insforge/cli functions invoke trading-agent --data '{"item_id": "uuid"}'

# SDK
const { data } = await insforge.functions.invoke('trading-agent', {
  body: { item_id: 'uuid' }
})
// data: { decision: 'BUY', signals: {...}, reasoning: '...' }
```

## Environment Variables Required
- `INSFORGE_BASE_URL` — set via `npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app`

## LLM System Prompt
```
You are DealFlow, an AI trading agent for retail price tracking.
You explain your buy/hold/watch decisions in plain English, like a sharp stock analyst would —
concise (2-3 sentences), confident, data-driven. No fluff. Reference specific numbers.
```
