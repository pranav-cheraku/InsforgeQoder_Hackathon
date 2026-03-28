/**
 * price-scraper — InsForge Edge Function
 *
 * Scrapes a product URL for the current price and writes it to price_history.
 * Also updates wishlist_items with the latest price, product name, and image.
 * Falls back to a realistic demo price if scraping fails (expected for hackathon).
 *
 * See: agents/price-scraper.md for full spec
 * Deploy: npx @insforge/cli functions deploy price-scraper
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
  if (!res.ok) throw new Error(`DB GET ${table} failed: ${await res.text()}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] ?? null : null
}

async function dbInsert(table: string, data: Record<string, unknown>, token: string) {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}`, {
    method: 'POST',
    headers: dbHeaders(token),
    body: JSON.stringify([data]),
  })
  if (!res.ok) throw new Error(`DB INSERT ${table} failed: ${await res.text()}`)
}

async function dbUpdate(table: string, query: string, data: Record<string, unknown>, token: string) {
  const res = await fetch(`${BASE_URL()}/api/database/records/${table}?${query}`, {
    method: 'PATCH',
    headers: dbHeaders(token),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`DB UPDATE ${table} failed: ${await res.text()}`)
}

// ─── Retailer detection ────────────────────────────────────────────────────────

function detectRetailer(url: string): string {
  if (url.includes('amazon.com'))  return 'amazon'
  if (url.includes('walmart.com')) return 'walmart'
  if (url.includes('target.com'))  return 'target'
  if (url.includes('bestbuy.com')) return 'bestbuy'
  if (url.includes('ebay.com'))    return 'ebay'
  return 'unknown'
}

// ─── Retailer-specific parsers ─────────────────────────────────────────────────

function extractAmazonTitle(html: string): string | null {
  const m = html.match(/id="productTitle"[^>]*>\s*([^<]{5,120})\s*</)
  return m ? m[1].trim() : null
}

function parseAmazon(html: string) {
  const jsonMatch = html.match(/"priceAmount"\s*:\s*([\d.]+)/)
  if (jsonMatch) return { price: parseFloat(jsonMatch[1]), product_name: extractAmazonTitle(html), image_url: null }
  const spanMatch = html.match(/class="a-offscreen">\$?([\d,]+\.[\d]{2})</)
  if (spanMatch) return { price: parseFloat(spanMatch[1].replace(',', '')), product_name: extractAmazonTitle(html), image_url: null }
  return null
}

function parseWalmart(html: string) {
  const m = html.match(/"price"\s*:\s*([\d.]+)/)
  return m ? { price: parseFloat(m[1]), product_name: null, image_url: null } : null
}

function parseTarget(html: string) {
  const m = html.match(/"current_retail"\s*:\s*([\d.]+)/)
  return m ? { price: parseFloat(m[1]), product_name: null, image_url: null } : null
}

function parseBestBuy(html: string) {
  const m = html.match(/"regularPrice"\s*:\s*([\d.]+)/)
  return m ? { price: parseFloat(m[1]), product_name: null, image_url: null } : null
}

// ─── Demo fallback ─────────────────────────────────────────────────────────────

const DEMO_NAMES: Record<string, string> = {
  amazon:  'Sony WH-1000XM4 Headphones',
  walmart: 'Dyson V11 Vacuum Cleaner',
  target:  'Nintendo Switch OLED',
  bestbuy: 'LG 27" 4K Monitor',
  ebay:    'Apple AirPods Pro 2nd Gen',
  unknown: 'Product',
}

function generateDemoPrice(existingPrice: number | null): number {
  const base = existingPrice ?? 299.99
  const drift = base * (0.003 + Math.random() * 0.012)
  const jitter = (Math.random() - 0.5) * base * 0.005
  return Math.max(1, parseFloat((base - drift + jitter).toFixed(2)))
}

// ─── Scraper ───────────────────────────────────────────────────────────────────

async function scrapePrice(product_url: string, retailer: string) {
  try {
    const res = await fetch(product_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    switch (retailer) {
      case 'amazon':  return parseAmazon(html)
      case 'walmart': return parseWalmart(html)
      case 'target':  return parseTarget(html)
      case 'bestbuy': return parseBestBuy(html)
      default:        return null
    }
  } catch (_) {
    return null
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? Deno.env.get('ANON_KEY')!

  const { item_id, product_url } = await req.json()
  if (!item_id || !product_url) {
    return json({ error: 'item_id and product_url are required' }, 400)
  }

  // Fetch existing item
  let wishlistItem: Record<string, unknown>
  try {
    const item = await dbGet('wishlist_items', `id=eq.${item_id}&select=current_price,product_name,retailer,user_id&limit=1`, token)
    if (!item) return json({ error: 'Item not found' }, 404)
    wishlistItem = item
  } catch (e: unknown) {
    return json({ error: 'Failed to fetch item', detail: (e as Error).message }, 500)
  }

  // Scrape — fall back to demo price
  const retailer = detectRetailer(product_url)
  const scraped = await scrapePrice(product_url, retailer)

  const existingPrice = wishlistItem.current_price ? parseFloat(wishlistItem.current_price as string) : null
  const price        = scraped?.price        ?? generateDemoPrice(existingPrice)
  const product_name = scraped?.product_name ?? (wishlistItem.product_name as string) ?? DEMO_NAMES[retailer]
  const image_url    = scraped?.image_url    ?? null

  // Write to price_history
  try {
    await dbInsert('price_history', { item_id, price, retailer }, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to write price history', detail: (e as Error).message }, 500)
  }

  // Update wishlist item
  const updatePayload: Record<string, unknown> = { current_price: price, retailer }
  if (product_name) updatePayload.product_name = product_name
  if (image_url)    updatePayload.image_url = image_url

  try {
    await dbUpdate('wishlist_items', `id=eq.${item_id}`, updatePayload, token)
  } catch (e: unknown) {
    return json({ error: 'Failed to update wishlist item', detail: (e as Error).message }, 500)
  }

  // Notify — fire and forget
  fetch(`${BASE_URL()}/functions/notification-dispatcher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      user_id: wishlistItem.user_id,
      item_id,
      event_type: 'price_update',
      payload: { price, retailer, product_name },
    }),
  }).catch(() => {})

  return json({ price, product_name, retailer, image_url })
}
