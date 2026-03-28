---
name: notification-dispatcher
type: edge-function
slug: notification-dispatcher
deploy: npx @insforge/cli functions deploy notification-dispatcher
source: insforge/functions/notification-dispatcher/index.js
---

# Notification Dispatcher Agent

Publishes realtime events to InsForge WebSocket channels so the frontend updates instantly.

## Responsibilities
- Publish to `snag:updates` (global channel, all users)
- Publish to `snag:user:{user_id}` (per-user channel)
- Enrich events with product name from DB before publishing

## Events
| event_type | Triggered by | Payload |
|------------|-------------|---------|
| `buy_executed` | buy-executor | buy_price, saved_amount, reasoning |
| `price_alert` | price-scraper | new_price, previous_price |
| `agent_decision` | trading-agent | decision, composite_score, reasoning |

## Invoke
```bash
# CLI
npx @insforge/cli functions invoke notification-dispatcher --data '{
  "user_id": "uuid",
  "item_id": "uuid",
  "event_type": "buy_executed",
  "payload": { "buy_price": 279.99, "saved_amount": 70.00 }
}'

# SDK
await insforge.functions.invoke('notification-dispatcher', {
  body: {
    user_id: 'uuid',
    item_id: 'uuid',
    event_type: 'buy_executed',
    payload: { buy_price: 279.99, saved_amount: 70.00, reasoning: '...' }
  }
})
```

## Frontend Realtime Subscription
```ts
await insforge.realtime.connect()
await insforge.realtime.subscribe('snag:updates')
insforge.realtime.on('buy_executed', (payload) => { /* update UI */ })
insforge.realtime.on('agent_decision', (payload) => { /* show in feed */ })
insforge.realtime.on('price_update', (payload) => { /* refresh chart */ })
```

## Channel Setup (run once in DB)
```sql
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES
  ('snag:updates', 'Global agent events', true),
  ('snag:user:%', 'Per-user notifications', true);
```
