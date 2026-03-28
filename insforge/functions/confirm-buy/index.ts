/**
 * confirm-buy — InsForge Edge Function
 *
 * Called by the user to confirm a pending buy decision made by trading-agent.
 * Verifies item status is 'pending_buy', then executes the buy inline
 * (same logic as buy-executor — inter-function HTTP calls cause LOOP_DETECTED).
 *
 * Deploy: npx @insforge/cli functions deploy confirm-buy
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

function dbHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=representation',
  }
}

async function dbGetOne(table: string, query: string, token: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`DB GET ${table}: ${await res.text()}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] ?? null : null
}

async function dbInsert(table: string, data: Record<string, unknown>, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}`, {
    method: 'POST',
    headers: dbHeaders(token),
    body: JSON.stringify([data]),
  })
  if (!res.ok) throw new Error(`DB INSERT ${table}: ${await res.text()}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

async function dbPatch(table: string, query: string, data: Record<string, unknown>, token: string): Promise<void> {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, {
    method: 'PATCH',
    headers: dbHeaders(token),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`DB PATCH ${table}: ${await res.text()}`)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? Deno.env.get('ANON_KEY')!

  const { item_id } = await req.json()
  if (!item_id) return json({ error: 'item_id is required' }, 400)

  // Load item — must be pending_buy
  let item: Record<string, unknown>
  try {
    const found = await dbGetOne('wishlist_items', `id=eq.${item_id}&limit=1`, token)
    if (!found) return json({ error: 'Item not found' }, 404)
    item = found
  } catch (e: unknown) {
    return json({ error: 'Failed to load item', detail: (e as Error).message }, 500)
  }

  if (item.status !== 'pending_buy') {
    return json({ error: `Item status is '${item.status}', expected 'pending_buy'` }, 409)
  }

  const buyPrice    = parseFloat((item.current_price ?? item.target_price) as string)
  const marketPrice = item.highest_price ? parseFloat(item.highest_price as string) : buyPrice
  const reasoning   = (item.pending_reasoning as string | null)
    ?? `Purchase confirmed by user at $${buyPrice}.`
  const user_id     = item.user_id as string

  // Insert transaction — saved_amount is GENERATED ALWAYS, never include it
  let transaction: Record<string, unknown>
  try {
    transaction = await dbInsert('transactions', {
      item_id,
      user_id,
      buy_price: buyPrice,
      market_price: marketPrice,
      reasoning,
    }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to record transaction', detail: (e as Error).message }, 500)
  }

  // Update wishlist item status to bought
  try {
    await dbPatch('wishlist_items', `id=eq.${item_id}`, { status: 'bought' }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to update item status', detail: (e as Error).message }, 500)
  }

  // Deduct buy_price from user budget
  try {
    const user = await dbGetOne('users', `id=eq.${user_id}&select=budget&limit=1`, token)
    if (!user) throw new Error('User not found')
    const newBudget = parseFloat(user.budget as string) - buyPrice
    await dbPatch('users', `id=eq.${user_id}`, { budget: newBudget }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to deduct budget', detail: (e as Error).message }, 500)
  }

  // Notify — fire and forget
  fetch(`${BASE_URL()}/functions/notification-dispatcher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      user_id,
      item_id,
      event_type: 'buy_executed',
      payload: {
        buy_price:    transaction.buy_price,
        market_price: transaction.market_price,
        saved_amount: transaction.saved_amount,
        reasoning,
      },
    }),
  }).catch(() => {})

  return json({
    transaction_id: transaction.id,
    buy_price:      transaction.buy_price,
    saved_amount:   transaction.saved_amount,
    reasoning,
  })
}
