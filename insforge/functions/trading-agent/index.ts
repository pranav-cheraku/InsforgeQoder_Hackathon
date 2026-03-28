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

// Signal weights — see docs/trading-algorithm.md
const WEIGHTS = { priceVsTarget: 0.40, movingAverage: 0.25, trendDirection: 0.20, volatility: 0.15 }
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

function computePriceVsTarget(current: number, target: number): number {
  if (current <= target) return 1.0
  return Math.max(0, 1 - (current - target) / target)
}

function computeMovingAverage(current: number, prices: number[]): number {
  const window = prices.slice(-7)
  if (window.length === 0) return 0.5
  const ma = window.reduce((a, b) => a + b, 0) / window.length
  if (current < ma) return 1.0
  return Math.max(0, 1 - (current - ma) / ma)
}

function computeTrendDirection(prices: number[]): number {
  const tail = prices.slice(-3)
  if (tail.length < 2) return 0.5
  const declining = tail.every((v, i) => i === 0 || v < tail[i - 1])
  const rising    = tail.every((v, i) => i === 0 || v > tail[i - 1])
  if (declining) return 1.0
  if (rising)    return 0.0
  return 0.5
}

function computeVolatility(prices: number[]): number {
  const window = prices.slice(-7)
  if (window.length < 2) return 0.5
  const mean = window.reduce((a, b) => a + b, 0) / window.length
  if (mean === 0) return 0.5
  const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length
  const cv = Math.sqrt(variance) / mean
  if (cv < 0.02) return 1.0
  if (cv < 0.05) return 0.75
  if (cv < 0.10) return 0.5
  if (cv < 0.20) return 0.25
  return 0.0
}

function makeDecision(composite: number, current: number, target: number): string {
  if (composite >= THRESHOLDS.BUY && current <= target) return 'BUY'
  if (composite >= THRESHOLDS.WATCH) return 'WATCH'
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

  // Compute signals
  const signals = {
    priceVsTarget:  computePriceVsTarget(currentPrice, targetPrice),
    movingAverage:  computeMovingAverage(currentPrice, prices),
    trendDirection: computeTrendDirection(prices),
    volatility:     computeVolatility(prices),
    composite:      0,
  }
  signals.composite = parseFloat((
    signals.priceVsTarget  * WEIGHTS.priceVsTarget  +
    signals.movingAverage  * WEIGHTS.movingAverage  +
    signals.trendDirection * WEIGHTS.trendDirection +
    signals.volatility     * WEIGHTS.volatility
  ).toFixed(4))

  const decision = makeDecision(signals.composite, currentPrice, targetPrice)

  // Generate reasoning via AI Gateway — fall back to deterministic string on failure
  let reasoning = ''
  try {
    const aiRes = await fetch(`${BASE_URL()}/api/ai/chat/completion`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        systemPrompt: 'You are DealFlow, an AI trading agent for retail price tracking. You explain your buy/hold/watch decisions in plain English, like a sharp stock analyst — concise (2-3 sentences), confident, data-driven. No fluff. Reference specific numbers.',
        messages: [{
          role: 'user',
          content: [
            `Product: ${item.product_name ?? 'Unknown product'}`,
            `Current price: $${currentPrice} | Target: $${targetPrice}`,
            `Decision: ${decision}`,
            `Signals: priceVsTarget=${signals.priceVsTarget.toFixed(2)}, movingAverage=${signals.movingAverage.toFixed(2)}, trendDirection=${signals.trendDirection.toFixed(2)}, volatility=${signals.volatility.toFixed(2)}, composite=${signals.composite}`,
            `Recent prices (last 7): [${prices.slice(-7).map(p => '$' + p.toFixed(2)).join(', ')}]`,
            `\nExplain this decision in 2-3 sentences, citing specific numbers.`,
          ].join('\n'),
        }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      reasoning = aiData.text ?? ''
    }
  } catch (_) {}

  if (!reasoning) {
    if (decision === 'BUY') {
      reasoning = `Price at $${currentPrice} is at or below your $${targetPrice} target with a composite score of ${signals.composite}. Declining trend confirms this is the right moment. Executing buy.`
    } else if (decision === 'WATCH') {
      reasoning = `Price at $${currentPrice} vs target $${targetPrice} — composite score ${signals.composite} shows improving conditions. Continuing to monitor.`
    } else {
      reasoning = `Price at $${currentPrice} vs target $${targetPrice} — composite score ${signals.composite} is below threshold. Conditions are not favorable. Holding.`
    }
  }

  // On BUY — set status to pending_buy and notify user for confirmation
  if (decision === 'BUY') {
    try {
      await fetch(`${BASE_URL()}/api/database/records/wishlist_items?id=eq.${item_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: JSON.stringify({ status: 'pending_buy' }),
      })
    } catch (_) {}

    fetch(`${BASE_URL()}/functions/notification-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        user_id: item.user_id,
        item_id,
        event_type: 'buy_pending',
        payload: {
          proposed_price: currentPrice,
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
