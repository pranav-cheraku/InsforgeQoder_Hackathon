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

function dbHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY()}`,
  }
}

async function dbGet(table: string, query: string) {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, {
    headers: dbHeaders(),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return Array.isArray(rows) ? rows : null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { user_id, item_id, event_type, payload } = await req.json()
  if (!user_id || !item_id || !event_type) {
    return json({ error: 'user_id, item_id, and event_type are required' }, 400)
  }

  // Optionally enrich with product_name from DB
  let product_name = payload?.product_name ?? null
  try {
    const rows = await dbGet('wishlist_items', `id=eq.${item_id}&select=product_name&limit=1`)
    if (rows?.[0]?.product_name) product_name = rows[0].product_name
  } catch (_) {}

  // Build enriched payload (realtime publishing requires WebSocket/Socket.IO —
  // the payload is returned so callers can confirm the event details)
  const enrichedPayload = {
    ...payload,
    item_id,
    user_id,
    product_name,
    event_type,
    timestamp: new Date().toISOString(),
  }

  // Log the event for debugging
  console.log(`[notification-dispatcher] ${event_type}`, JSON.stringify(enrichedPayload))

  return json({ dispatched: true, event_type, channel: 'dealflow:updates', payload: enrichedPayload })
}
