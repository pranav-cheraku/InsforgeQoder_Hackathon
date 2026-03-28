/**
 * trading-agent — InsForge Edge Function
 *
 * On-demand evaluation of a single wishlist item. Delegates to the Python
 * agent worker which runs the full signal computation + BUY/WATCH/HOLD loop.
 *
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

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: Deno.env.get('SERVICE_KEY'),
  })

  const { item_id } = await req.json()
  if (!item_id) return json({ error: 'item_id is required' }, 400)

  const { data: item, error } = await client.database
    .from('wishlist_items')
    .select('id, product_url, status')
    .eq('id', item_id)
    .single()

  if (error || !item) return json({ error: 'Item not found' }, 404)
  if (item.status !== 'watching') {
    return json({ skipped: true, reason: `status is '${item.status}'` })
  }

  const agentUrl = Deno.env.get('AGENT_WORKER_URL')
  const result = await fetch(`${agentUrl}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: item.id, url: item.product_url }),
  }).then(r => r.json())

  return json(result)
}
