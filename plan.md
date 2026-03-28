# Snag Backend — Implementation Plan

**Deadline:** March 29 2026
**Runtime:** Deno (InsForge Edge Functions) + Python FastAPI

---

## Implementation Status — COMPLETE ✅

### FastAPI Backend
| Service | Status |
|---|---|
| scraper.py — Claude web_search for live prices | ✅ Live |
| alert_engine.py — price drop detection | ✅ Live |
| identifier.py — Claude product normalization | ✅ Live |
| routes: items, alerts, prices, search | ✅ Live |

### InsForge Edge Functions
| Function | Status | Deployed |
|---|---|---|
| notification-dispatcher | ✅ Live | 3/28/2026 11:30 AM |
| buy-executor | ✅ Live | 3/28/2026 11:41 AM |
| trading-agent | ✅ Live | 3/28/2026 (updated for confirm flow) |
| confirm-buy | ✅ Live | 3/28/2026 |
| ~~price-scraper~~ | ✅ Removed — replaced by FastAPI scraper | — |

---

## Architecture Notes

**Scraping:** FastAPI backend (`backend/services/scraper.py`) handles all price fetching using Claude + `web_search_20250305`. The InsForge `price-scraper` edge function has been removed. Price data written to the shared PostgreSQL database is then consumed by `trading-agent`.

**SDK broken:** `npm:@insforge/sdk` causes BOOT_FAILURE due to broken `@insforge/shared-schemas@1.1.46`. All edge functions use direct REST API calls:
- DB: `GET|POST|PATCH /api/database/records/{table}`
- AI: `POST /api/ai/chat/completion` → response `.text` field
- Realtime: WebSocket-only; notification-dispatcher logs events and returns success

**Inter-function calls cause LOOP_DETECTED:** `confirm-buy` inlines the buy-executor logic instead of delegating.

**User confirmation flow:** `trading-agent` sets `status = 'pending_buy'` on BUY decision. User must call `confirm-buy` to execute.

**DB schema:** `wishlist_items.status` allows `watching`, `pending_buy`, `bought`, `paused`.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| AI Gateway timeout | try/catch with deterministic fallback — never blocks response |
| `saved_amount` insert error | Never insert this column — `GENERATED ALWAYS` |
| Budget goes negative | Acceptable for hackathon demo |
| `current_price` is null | Fall back to `target_price` |
| Empty `price_history` | Window signals return 0.5 neutral — still produces a decision |
| Item not `'watching'` | Return 409 — prevents double-buy |
| `notification-dispatcher` not deployed | Deploy it first, always |

---

## Demo Setup

1. Start FastAPI: `cd backend && uvicorn main:app --reload`
2. Start mobile app: `cd mobile && npx expo start`
3. Add a product → scan → watch prices populate
4. To trigger a live BUY during demo:
   ```sql
   INSERT INTO price_history (item_id, price, retailer)
   VALUES ('11111111-0000-0000-0000-000000000001', 278.50, 'amazon');

   UPDATE wishlist_items SET current_price = 278.50
   WHERE id = '11111111-0000-0000-0000-000000000001';
   ```
   Then invoke `trading-agent` — composite crosses 0.75, BUY fires live.

5. **Demo arc:**
   - Show WATCH: invoke `trading-agent` on an item with moderate signals
   - Show BUY: invoke `trading-agent` on Sony after price manipulation
   - Show realtime: have frontend WebSocket open — `buy_executed` appears live

---

## Full Deploy Sequence

```bash
npx @insforge/cli functions deploy notification-dispatcher
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions deploy confirm-buy
npx @insforge/cli functions list
```
