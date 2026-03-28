/**
 * price-poller — Insforge Edge Function (scheduled)
 *
 * Scheduled cron job that periodically triggers scraping for all 'watching' items.
 * Set this up in Insforge as a scheduled function running every 30 minutes.
 *
 * Cron: "0,30 * * * *"
 */

const SCRAPE_TRIGGER_URL = Deno.env.get('SCRAPE_TRIGGER_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (_req: Request) => {
  const res = await fetch(SCRAPE_TRIGGER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}), // no item_id = scrape all watching items
  });

  const data = await res.json();
  console.log(`[price-poller] dispatched ${data.dispatched} scrape jobs`);

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
