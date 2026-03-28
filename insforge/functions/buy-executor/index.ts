/**
 * buy-executor — InsForge Edge Function
 *
 * Executes a confirmed buy decision:
 * 1. Inserts a transaction record
 * 2. Sets wishlist_items.status to 'bought'
 * 3. Deducts buy_price from users.budget
 * 4. Invokes notification-dispatcher
 *
 * Called automatically by trading-agent on a BUY decision.
 * Can also be invoked directly for demo/testing.
 *
 * See: agents/buy-executor.md for full spec
 * Deploy: npx @insforge/cli functions deploy buy-executor
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

async function dbGet(table: string, query: string, token: string) {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DB GET ${table} failed: ${err}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] ?? null : null
}

async function dbInsert(table: string, data: Record<string, unknown>, token: string) {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}`, {
    method: 'POST',
    headers: dbHeaders(token),
    body: JSON.stringify([data]),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DB INSERT ${table} failed: ${err}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] ?? null : null
}

async function dbUpdate(table: string, query: string, data: Record<string, unknown>, token: string) {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, {
    method: 'PATCH',
    headers: dbHeaders(token),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DB UPDATE ${table} failed: ${err}`)
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? Deno.env.get('ANON_KEY')!

  const { item_id, user_id, buy_price, market_price, reasoning } = await req.json()
  if (!item_id || !user_id || !buy_price || !reasoning) {
    return json({ error: 'item_id, user_id, buy_price, and reasoning are required' }, 400)
  }

  // Insert transaction — saved_amount is GENERATED ALWAYS, do not include it
  let transaction: Record<string, unknown>
  try {
    transaction = await dbInsert('transactions', {
      item_id,
      user_id,
      buy_price,
      market_price: market_price ?? null,
      reasoning,
    }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to record transaction', detail: (e as Error).message }, 500)
  }

  // Update wishlist item status to bought
  try {
    await dbUpdate('wishlist_items', `id=eq.${item_id}`, { status: 'bought' }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to update item status', detail: (e as Error).message }, 500)
  }

  // Deduct buy_price from user budget
  try {
    const user = await dbGet('users', `id=eq.${user_id}&select=budget&limit=1`, token)
    if (!user) throw new Error('User not found')
    const newBudget = parseFloat(user.budget) - parseFloat(buy_price)
    await dbUpdate('users', `id=eq.${user_id}`, { budget: newBudget }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to deduct budget', detail: (e as Error).message }, 500)
  }

  // Invoke notification-dispatcher — fire and forget
  fetch(`${BASE_URL()}/functions/notification-dispatcher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      user_id,
      item_id,
      event_type: 'buy_executed',
      payload: {
        buy_price: transaction.buy_price,
        market_price: transaction.market_price,
        saved_amount: transaction.saved_amount,
        reasoning,
      },
    }),
  }).catch(() => {})

  return json({
    transaction_id: transaction.id,
    buy_price: transaction.buy_price,
    saved_amount: transaction.saved_amount,
    reasoning,
  })
}
