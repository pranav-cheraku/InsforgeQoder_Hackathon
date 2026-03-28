/**
 * price-scraper — InsForge Edge Function
 *
 * Scrapes a product URL for the current price and writes it to price_history.
 * Also updates wishlist_items with the latest price, product name, and image.
 *
 * See: agents/price-scraper.md for full spec
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

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: req.headers.get('Authorization')?.replace('Bearer ', '') ?? null,
  })

  const { item_id, product_url } = await req.json()
  if (!item_id || !product_url) {
    return json({ error: 'item_id and product_url are required' }, 400)
  }

  // TODO: scrape product_url for price, product_name, image_url
  // TODO: insert into price_history
  // TODO: update wishlist_items (current_price, product_name, retailer, image_url)
  // TODO: publish 'price_update' event to 'dealflow:updates' realtime channel

  return json({ message: 'not implemented' }, 501)
}
