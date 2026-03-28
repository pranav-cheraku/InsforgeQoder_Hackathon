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

// Signal weights — see docs/trading-algorithm.md
const WEIGHTS = {
  priceVsTarget: 0.40,
  movingAverage: 0.25,
  trendDirection: 0.20,
  volatility: 0.15,
}

const THRESHOLDS = { BUY: 0.75, WATCH: 0.50 }

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: req.headers.get('Authorization')?.replace('Bearer ', '') ?? null,
  })

  const { item_id } = await req.json()
  if (!item_id) return json({ error: 'item_id is required' }, 400)

  // TODO: load wishlist_item from DB, verify status === 'watching'
  // TODO: load price_history for item (last 30 records, ascending)
  // TODO: compute signals — priceVsTarget, movingAverage, trendDirection, volatility
  // TODO: calculate composite score using WEIGHTS
  // TODO: determine decision (BUY / WATCH / HOLD) using THRESHOLDS
  // TODO: call InsForge AI Gateway (claude-3.5-haiku) to generate reasoning text
  // TODO: if BUY → invoke 'buy-executor' function
  // TODO: publish 'agent_decision' event to 'dealflow:updates' realtime channel
  // TODO: return { decision, signals, reasoning }

  return json({ message: 'not implemented' }, 501)
}
