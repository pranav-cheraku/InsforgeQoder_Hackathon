/**
 * notification-dispatcher — InsForge Edge Function
 *
 * Publishes realtime events to WebSocket channels, enriched with product_name.
 * Called by trading-agent and buy-executor after significant events.
 *
 * Events:
 *   buy_ready      — agent flagged item for user approval
 *   buy_executed   — purchase completed
 *   agent_decision — WATCH / HOLD decision
 *   price_alert    — price dropped below target
 *
 * Channels:
 *   snag:updates        — global feed
 *   snag:user:{user_id} — per-user private channel
 */

import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const BASE_URL = () => Deno.env.get('INSFORGE_BASE_URL')!
const ANON_KEY = () => Deno.env.get('ANON_KEY')!

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { user_id, item_id, event_type, payload } = await req.json()
  if (!user_id || !item_id || !event_type) {
    return json({ error: 'user_id, item_id, and event_type are required' }, 400)
  }

  // Enrich with product_name from DB if not already provided
  let product_name = payload?.product_name ?? null
  if (!product_name) {
    try {
      const res = await fetch(`${BASE_URL()}/api/database/records/wishlist_items?id=eq.${item_id}&select=product_name&limit=1`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY()}` },
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows?.[0]?.product_name) product_name = rows[0].product_name
      }
    } catch (_) {}
  }

  const event = {
    event_type,
    item_id,
    user_id,
    product_name,
    timestamp: new Date().toISOString(),
    ...(payload ?? {}),
  }

  // Publish to realtime channels
  try {
    const client = createClient({
      baseUrl: BASE_URL(),
      anonKey: ANON_KEY(),
    })
    await client.realtime.connect()
    await Promise.all([
      client.realtime.publish('snag:updates', event_type, event),
      client.realtime.publish(`snag:user:${user_id}`, event_type, event),
    ])
  } catch (e: unknown) {
    console.error('[notification-dispatcher] realtime publish failed:', (e as Error).message)
  }

  console.log(`[notification-dispatcher] ${event_type} → snag:user:${user_id}`, product_name)

  return json({
    dispatched: true,
    event_type,
    channels: ['snag:updates', `snag:user:${user_id}`],
    payload: event,
  })
}
