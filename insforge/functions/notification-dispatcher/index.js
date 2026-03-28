/**
 * notification-dispatcher — InsForge Edge Function
 *
 * Publishes realtime events to WebSocket channels.
 * Called by buy-executor after a purchase.
 *
 * Channels:
 *   dealflow:updates        — global agent activity feed
 *   dealflow:user:{user_id} — per-user private notifications
 *
 * Deploy: npx @insforge/cli functions deploy notification-dispatcher
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
    anonKey: Deno.env.get('ANON_KEY'),
  })

  const { user_id, item_id, event_type, payload } = await req.json()
  if (!user_id || !item_id || !event_type) {
    return json({ error: 'user_id, item_id, and event_type are required' }, 400)
  }

  const event = {
    event_type,
    item_id,
    user_id,
    timestamp: new Date().toISOString(),
    ...(payload ?? {}),
  }

  await client.realtime.connect()
  await Promise.all([
    client.realtime.publish('dealflow:updates', event_type, event),
    client.realtime.publish(`dealflow:user:${user_id}`, event_type, event),
  ])

  return json({
    dispatched: true,
    event_type,
    channels: ['dealflow:updates', `dealflow:user:${user_id}`],
  })
}
