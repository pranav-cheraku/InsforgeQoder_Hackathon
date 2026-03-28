---
name: buy-executor
type: edge-function
slug: buy-executor
deploy: npx @insforge/cli functions deploy buy-executor
source: insforge/functions/buy-executor/index.js
---

# Buy Executor Agent

Executes a confirmed buy decision. Records the transaction, updates state, deducts from wallet, and triggers notifications.

## Responsibilities
- Insert a row into `transactions` with buy_price, market_price, reasoning
- Update `wishlist_items.status` to `'bought'`
- Deduct `buy_price` from `users.budget`
- Invoke `notification-dispatcher` with `buy_executed` event

## Called By
- `trading-agent` (automatically on BUY decision)
- Can also be invoked directly for manual override

## Invoke
```bash
# CLI
npx @insforge/cli functions invoke buy-executor --data '{
  "item_id": "uuid",
  "user_id": "uuid",
  "buy_price": 279.99,
  "market_price": 349.99,
  "reasoning": "Price dropped 18%..."
}'

# SDK
const { data } = await insforge.functions.invoke('buy-executor', {
  body: {
    item_id: 'uuid',
    user_id: 'uuid',
    buy_price: 279.99,
    market_price: 349.99,
    reasoning: 'Price dropped 18%...'
  }
})
// data: { transaction_id: 'uuid', buy_price: 279.99, saved_amount: 70.00, reasoning: '...' }
```

## saved_amount Calculation
`saved_amount = market_price - buy_price` (computed as GENERATED ALWAYS column in PostgreSQL)
