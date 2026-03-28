# DealFlow

> "Robinhood for your Amazon cart — an AI agent that times your purchases so you never overpay again."

Autonomous AI shopping agent for the **Insforge x Qoder AI Agent Hackathon** (Seattle, March 29 2026).

---

## What This Repo Contains

This repo owns the **backend and agent logic**. Frontend is a separate teammate.

```
insforge/functions/       Edge Function stubs — implement these
  price-scraper/          Scrape prices, write price_history
  trading-agent/          Compute signals, make BUY/WATCH/HOLD, call LLM
  buy-executor/           Record transaction, update wallet
  notification-dispatcher Push realtime events to frontend

agents/                   Agent specs (what each function should do)
docs/                     Architecture, schema, algorithm, API contracts
```

---

## Before You Start Coding

### 1. Verify InsForge auth
```bash
npx @insforge/cli whoami
npx @insforge/cli current
```

### 2. Set up the database
```bash
npx @insforge/cli db import docs/database-setup.sql
```

### 3. Add secrets (required by edge functions)
```bash
npx @insforge/cli secrets add INSFORGE_BASE_URL https://nstb9s8d.us-west.insforge.app
npx @insforge/cli secrets add ANON_KEY your_anon_key_here
```
> Get the anon key from: InsForge Dashboard → Settings → API Keys

### 4. Deploy function stubs to confirm setup works
```bash
npx @insforge/cli functions deploy price-scraper
npx @insforge/cli functions deploy trading-agent
npx @insforge/cli functions deploy buy-executor
npx @insforge/cli functions deploy notification-dispatcher
npx @insforge/cli functions list
```

---

## Implement Each Function

Work through the `// TODO` comments in each file. The agent MDs have the full spec.

| Function | Spec | File |
|----------|------|------|
| `price-scraper` | `agents/price-scraper.md` | `insforge/functions/price-scraper/index.js` |
| `trading-agent` | `agents/trading-agent.md` | `insforge/functions/trading-agent/index.js` |
| `buy-executor` | `agents/buy-executor.md` | `insforge/functions/buy-executor/index.js` |
| `notification-dispatcher` | `agents/notification-dispatcher.md` | `insforge/functions/notification-dispatcher/index.js` |

### Deploy after each change
```bash
npx @insforge/cli functions deploy <slug>

# Test it
npx @insforge/cli functions invoke <slug> --data '{"item_id": "..."}'

# Check logs if something breaks
npx @insforge/cli logs function.logs
```

---

## Key Docs

| Doc | Purpose |
|-----|---------|
| `docs/architecture.md` | Full system diagram and data flow |
| `docs/database-schema.md` | Table schemas and RLS policies |
| `docs/trading-algorithm.md` | Signal math, weights, decision thresholds |
| `docs/api-contracts.md` | Request/response shapes (share with frontend teammate) |
| `docs/database-setup.sql` | All SQL to run via InsForge CLI |

---

## InsForge SDK (inside edge functions)

```js
import { createClient } from 'npm:@insforge/sdk'

const client = createClient({
  baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
  edgeFunctionToken: req.headers.get('Authorization')?.replace('Bearer ', ''),
})

// Database
const { data, error } = await client.database.from('wishlist_items').select('*').eq('id', id)

// AI Gateway
const completion = await client.ai.chat.completions.create({
  model: 'anthropic/claude-3.5-haiku',
  messages: [{ role: 'user', content: '...' }],
})

// Realtime publish
await client.realtime.connect()
await client.realtime.subscribe('dealflow:updates')
await client.realtime.publish('dealflow:updates', 'agent_decision', { ... })

// Invoke another function
await client.functions.invoke('buy-executor', { body: { ... } })
```
