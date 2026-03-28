/**
 * notification-dispatcher — InsForge Edge Function
 *
 * Publishes realtime events to the dealflow:updates WebSocket channel.
 * Called by buy-executor and trading-agent after significant events.
 *
 * Events:
 *   buy_executed   — agent completed a purchase
 *   price_alert    — price dropped below target
 *   agent_decision — any BUY / WATCH / HOLD decision
 *
 * See: agents/notification-dispatcher.md for full spec
 * Deploy: npx @insforge/cli functions deploy notification-dispatcher
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

  // Uses anon key — no user auth required for publishing
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  })

  const { user_id, item_id, event_type, payload } = await req.json()
  if (!user_id || !item_id || !event_type) {
    return json({ error: 'user_id, item_id, and event_type are required' }, 400)
  }

  // TODO: optionally fetch product_name from wishlist_items for richer payload
  // TODO: publish event to 'dealflow:updates' channel
  // TODO: publish to per-user 'dealflow:user:{user_id}' channel if it exists
  // TODO: return { dispatched: true, event_type, channel }

  return json({ message: 'not implemented' }, 501)
}
