/**
 * price-poller — InsForge Edge Function (scheduled cron)
 *
 * Triggers price-scraper for all 'watching' items every 30 minutes.
 * Set up in InsForge dashboard → Schedules.
 *
 * Cron: "0,30 * * * *"
 * Deploy: npx @insforge/cli functions deploy price-poller
 */

import { createClient } from 'npm:@insforge/sdk'

export default async function handler(_req) {
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: Deno.env.get('SERVICE_KEY'),
  })

  const { data, error } = await client.functions.invoke('price-scraper', {
    body: {}, // no item_id = scrape all watching items
  })

  if (error) {
    console.error('[price-poller] failed:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`[price-poller] dispatched ${data?.dispatched ?? 0} scrape jobs`)
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
