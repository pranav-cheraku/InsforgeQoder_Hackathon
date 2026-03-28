/**
 * buy-executor — InsForge Edge Function
 *
 * Executes a confirmed buy decision:
 * 1. Inserts a transaction record
 * 2. Sets wishlist_items.status to 'bought'
 * 3. Deducts buy_price from users.budget
 * 4. Invokes notification-dispatcher
 *
 * Called automatically by trading-agent on a BUY decision.
 * Can also be invoked directly for demo/testing.
 *
 * See: agents/buy-executor.md for full spec
 * Deploy: npx @insforge/cli functions deploy buy-executor
 */

import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: req.headers.get('Authorization')?.replace('Bearer ', '') ?? null,
  })

  const { item_id, user_id, buy_price, market_price, reasoning } = await req.json()
  if (!item_id || !user_id || !buy_price || !reasoning) {
    return json({ error: 'item_id, user_id, buy_price, and reasoning are required' }, 400)
  }

  // TODO: insert row into transactions (item_id, user_id, buy_price, market_price, reasoning)
  // TODO: update wishlist_items.status = 'bought' where id = item_id
  // TODO: deduct buy_price from users.budget where id = user_id
  // TODO: invoke 'notification-dispatcher' with event_type 'buy_executed'
  // TODO: return { transaction_id, buy_price, saved_amount, reasoning }

  return json({ message: 'not implemented' }, 501)
}
