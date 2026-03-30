/**
 * trading-agent — InsForge Edge Function
 *
 * The core agent brain. Loads price history, computes trading signals,
 * makes a BUY / WATCH / HOLD decision, generates LLM reasoning via AI Gateway,
 * and invokes buy-executor on a BUY.
 *
 * See: agents/trading-agent.md for full spec
 * See: docs/trading-algorithm.md for signal weights and thresholds
 * Deploy: npx @insforge/cli functions deploy trading-agent
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

const THRESHOLDS = { BUY: 0.75, WATCH: 0.50 }

const BASE_URL = () => Deno.env.get('INSFORGE_BASE_URL')!

// ─── DB helpers ────────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
}

async function dbGetOne(table: string, query: string, token: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, { headers: authHeader(token) })
  if (!res.ok) throw new Error(`DB GET ${table}: ${await res.text()}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] ?? null : null
}

async function dbGetMany(table: string, query: string, token: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, { headers: authHeader(token) })
  if (!res.ok) throw new Error(`DB GET ${table}: ${await res.text()}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

// ─── Signal functions ──────────────────────────────────────────────────────────

function makeDecision(current: number, target: number): string {
  if (current > 0 && current < target) return 'BUY'
  if (current > 0 && current === target) return 'BUY'
  return 'HOLD'
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? Deno.env.get('ANON_KEY')!

  const { item_id } = await req.json()
  if (!item_id) return json({ error: 'item_id is required' }, 400)

  // Load wishlist item
  let item: Record<string, unknown>
  try {
    const found = await dbGetOne('wishlist_items', `id=eq.${item_id}&limit=1`, token)
    if (!found) return json({ error: 'Item not found' }, 404)
    item = found
  } catch (e: unknown) {
    return json({ error: 'Failed to load item', detail: (e as Error).message }, 500)
  }

  if (item.status !== 'watching') {
    return json({ error: `Item status is '${item.status}', expected 'watching'` }, 409)
  }

  // Load last 30 price history records ascending
  let history: Record<string, unknown>[] = []
  try {
    history = await dbGetMany('price_history', `item_id=eq.${item_id}&order=scraped_at.asc&limit=30`, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to load price history', detail: (e as Error).message }, 500)
  }

  const prices       = history.map(h => parseFloat(h.price as string))
  const currentPrice = parseFloat((item.current_price ?? item.target_price) as string)
  const targetPrice  = parseFloat(item.target_price as string)

  const decision = makeDecision(currentPrice, targetPrice)

  const signals = {
    priceVsTarget: currentPrice > 0 && currentPrice <= targetPrice ? 1.0 : 0.0,
    composite: decision === 'BUY' ? 1.0 : 0.0,
  }

  let reasoning = ''
  if (decision === 'BUY') {
    const savings = targetPrice - currentPrice
    reasoning = `Current price ($${currentPrice.toFixed(2)}) is below your target ($${targetPrice.toFixed(2)}). You're saving $${savings.toFixed(2)} — ready to buy!`
  } else {
    reasoning = `Current price ($${currentPrice.toFixed(2)}) is above your target ($${targetPrice.toFixed(2)}). Waiting for a better deal.`
  }

  // On BUY — set pending_buy status for user confirmation instead of auto-buying
  if (decision === 'BUY') {
    try {
      await fetch(`${BASE_URL()}/api/database/records/wishlist_items?id=eq.${item_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'pending_buy', pending_reasoning: reasoning }),
      })
    } catch (_) {}

    // Notify buy_ready — fire and forget
    fetch(`${BASE_URL()}/functions/notification-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        user_id: item.user_id,
        item_id,
        event_type: 'buy_ready',
        payload: {
          product_name: item.product_name,
          buy_price:    currentPrice,
          market_price: item.highest_price ?? currentPrice,
          composite_score: signals.composite,
          reasoning,
        },
      }),
    }).catch(() => {})
  } else {
    // Publish agent_decision event for WATCH/HOLD — fire and forget
    fetch(`${BASE_URL()}/functions/notification-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        user_id: item.user_id,
        item_id,
        event_type: 'agent_decision',
        payload: { decision, composite_score: signals.composite, reasoning },
      }),
    }).catch(() => {})
  }

  return json({ decision, signals, reasoning })
}
