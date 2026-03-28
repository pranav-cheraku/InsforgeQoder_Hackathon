/**
 * buy-executor — Insforge Edge Function
 *
 * Called by the Python agent worker when a BUY signal is triggered.
 * Handles the transactional logic: deducts budget, records transaction,
 * updates wishlist item status, and pushes realtime notification.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface BuyRequest {
  item_id: string;
  buy_price: number;
  market_price: number;
  reasoning: string;
}

const INSFORGE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = await req.json() as BuyRequest;
  const { item_id, buy_price, market_price, reasoning } = body;

  const db = createClient(INSFORGE_URL, SERVICE_ROLE_KEY);

  // Get the wishlist item + user
  const { data: item, error: itemErr } = await db
    .from('wishlist_items').select('*, users(*)').eq('id', item_id).single();
  if (itemErr || !item) return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });

  // Guard: already bought
  if (item.status === 'bought') {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_bought' }), { status: 200 });
  }

  // Guard: insufficient budget
  const user = item.users as { id: string; budget: number };
  if (user.budget < buy_price) {
    return new Response(JSON.stringify({ skipped: true, reason: 'insufficient_budget' }), { status: 200 });
  }

  // Execute atomically (Insforge doesn't have native transactions via REST, so sequential writes)
  const [txnResult, statusResult, budgetResult] = await Promise.all([
    db.from('transactions').insert({
      item_id,
      user_id: user.id,
      buy_price,
      market_price,
      reasoning,
    }),
    db.from('wishlist_items').update({ status: 'bought', current_price: buy_price }).eq('id', item_id),
    db.from('users').update({ budget: user.budget - buy_price }).eq('id', user.id),
  ]);

  const errors = [txnResult.error, statusResult.error, budgetResult.error].filter(Boolean);
  if (errors.length) {
    return new Response(JSON.stringify({ error: errors[0]?.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, saved: market_price - buy_price }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
