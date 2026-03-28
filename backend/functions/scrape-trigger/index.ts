/**
 * scrape-trigger — Insforge Edge Function
 *
 * Called by the mobile app when a user adds a new wishlist item,
 * or on a schedule to refresh all 'watching' items.
 *
 * It sends a job to the Python agent worker via HTTP POST.
 * The worker scrapes the price, writes to price_history, and evaluates the trading signal.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AGENT_WORKER_URL = Deno.env.get('AGENT_WORKER_URL')!;
const INSFORGE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { item_id } = await req.json() as { item_id?: string };
  const db = createClient(INSFORGE_URL, SERVICE_ROLE_KEY);

  // If item_id is provided, scrape just that item. Otherwise scrape all watching items.
  let items: { id: string; product_url: string; user_id: string }[] = [];

  if (item_id) {
    const { data, error } = await db.from('wishlist_items').select('id, product_url, user_id').eq('id', item_id).single();
    if (error || !data) return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
    items = [data];
  } else {
    const { data, error } = await db.from('wishlist_items').select('id, product_url, user_id').eq('status', 'watching');
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    items = data ?? [];
  }

  // Fan out scrape jobs to the Python agent worker
  const jobs = items.map(item =>
    fetch(`${AGENT_WORKER_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, url: item.product_url }),
    }).then(r => r.json()).catch(e => ({ error: e.message, item_id: item.id }))
  );

  const results = await Promise.allSettled(jobs);
  const summary = results.map((r, i) => ({
    item_id: items[i].id,
    status: r.status,
    value: r.status === 'fulfilled' ? r.value : r.reason,
  }));

  return new Response(JSON.stringify({ dispatched: items.length, results: summary }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
