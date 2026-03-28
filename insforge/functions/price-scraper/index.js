/**
 * price-scraper — InsForge Edge Function
 *
 * Entry point for the agentic loop. Called by the mobile app when a user
 * adds a wishlist item, or by price-poller on a schedule.
 *
 * Fans out scrape jobs to the Python agent worker, which handles:
 *   scrape → write price_history → evaluate signals → BUY/WATCH/HOLD → buy-executor
 *
 * Deploy: npx @insforge/cli functions deploy price-scraper
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

  // Service-role client — bypasses RLS to read all watching items
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: Deno.env.get('SERVICE_KEY'),
  })

  const body = await req.json()
  const { item_id } = body

  let items = []

  if (item_id) {
    const { data, error } = await client.database
      .from('wishlist_items')
      .select('id, product_url')
      .eq('id', item_id)
      .single()
    if (error || !data) return json({ error: 'Item not found' }, 404)
    items = [data]
  } else {
    const { data, error } = await client.database
      .from('wishlist_items')
      .select('id, product_url')
      .eq('status', 'watching')
    if (error) return json({ error: error.message }, 500)
    items = data ?? []
  }

  if (items.length === 0) return json({ dispatched: 0, results: [] })

  const agentUrl = Deno.env.get('AGENT_WORKER_URL')
  const jobs = items.map(item =>
    fetch(`${agentUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, url: item.product_url }),
    })
      .then(r => r.json())
      .catch(e => ({ error: e.message, item_id: item.id }))
  )

  const results = await Promise.allSettled(jobs)
  const summary = results.map((r, i) => ({
    item_id: items[i].id,
    status: r.status,
    value: r.status === 'fulfilled' ? r.value : r.reason,
  }))

  return json({ dispatched: items.length, results: summary })
}
