---
name: confirm-buy
type: edge-function
slug: confirm-buy
deploy: npx @insforge/cli functions deploy confirm-buy
source: insforge/functions/confirm-buy/index.ts
---

# Confirm Buy

Called by the user (via frontend) to confirm a pending buy decision from trading-agent.
The item must be in `pending_buy` status or the call returns 409.

## Responsibilities
- Verify `wishlist_items.status == 'pending_buy'`
- Insert transaction record (buy_price, market_price, reasoning)
- Set `wishlist_items.status = 'bought'`
- Deduct `buy_price` from `users.budget`
- Publish `buy_executed` event via notification-dispatcher

> **Note:** buy logic is inlined here rather than delegating to buy-executor.
> Inter-function HTTP calls on this platform cause LOOP_DETECTED errors.

## Invoke
```bash
# CLI
npx @insforge/cli functions invoke confirm-buy --data '{"item_id": "uuid"}'

# SDK (frontend)
const { data } = await insforge.functions.invoke('confirm-buy', {
  body: { item_id: 'uuid' }
})
// data: { transaction_id, buy_price, saved_amount, reasoning }
```

## Cancel a pending buy (reset to watching)
```bash
# Via REST API
PATCH /api/database/records/wishlist_items?id=eq.{item_id}
{ "status": "watching" }
```

## Environment Variables Required
- `INSFORGE_BASE_URL`
- `ANON_KEY`
