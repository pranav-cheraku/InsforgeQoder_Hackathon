/**
 * buy-executor — InsForge Edge Function
 *
 * Called by the Python agent worker on a BUY decision.
 * 1. Guard: skip if already bought or budget insufficient
 * 2. Insert transaction record
 * 3. Update wishlist_items.status → 'bought'
 * 4. Deduct buy_price from users.budget
 * 5. Invoke notification-dispatcher
 *
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
    edgeFunctionToken: Deno.env.get('SERVICE_KEY'),
  })

  const { item_id, buy_price, market_price, reasoning } = await req.json()
  if (!item_id || buy_price == null || !reasoning) {
    return json({ error: 'item_id, buy_price, and reasoning are required' }, 400)
  }

  // Load item + user
  const { data: item, error: itemErr } = await client.database
    .from('wishlist_items')
    .select('id, status, user_id, product_name')
    .eq('id', item_id)
    .single()
  if (itemErr || !item) return json({ error: 'Item not found' }, 404)

  if (item.status === 'bought') return json({ skipped: true, reason: 'already_bought' })

  const { data: user, error: userErr } = await client.database
    .from('users')
    .select('id, budget')
    .eq('id', item.user_id)
    .single()
  if (userErr || !user) return json({ error: 'User not found' }, 404)

  if (user.budget < buy_price) return json({ skipped: true, reason: 'insufficient_budget' })

  // Write transaction, update item status, deduct budget
  const [txnResult, statusResult, budgetResult] = await Promise.all([
    client.database.from('transactions').insert([{
      item_id,
      user_id: user.id,
      buy_price,
      market_price: market_price ?? buy_price,
      reasoning,
    }]),
    client.database
      .from('wishlist_items')
      .update({ status: 'bought', current_price: buy_price })
      .eq('id', item_id),
    client.database
      .from('users')
      .update({ budget: user.budget - buy_price })
      .eq('id', user.id),
  ])

  const writeError = [txnResult.error, statusResult.error, budgetResult.error].find(Boolean)
  if (writeError) return json({ error: writeError.message }, 500)

  const saved = (market_price ?? buy_price) - buy_price

  // Notify frontend — non-fatal
  await client.functions.invoke('notification-dispatcher', {
    body: {
      user_id: user.id,
      item_id,
      event_type: 'buy_executed',
      payload: { product_name: item.product_name, buy_price, saved, reasoning },
    },
  }).catch(() => {})

  return json({ success: true, saved })
}
