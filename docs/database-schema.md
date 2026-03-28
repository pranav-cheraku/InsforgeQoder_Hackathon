# Database Schema

All tables are auto-exposed as REST APIs by InsForge. RLS policies ensure users only access their own data.

## Setup
```bash
npx @insforge/cli db import docs/database-setup.sql
```

---

## Table: `users`
Extends `auth.users`. Auto-created on signup via trigger.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | PK → auth.users | Unique user identifier |
| `email` | VARCHAR | — | User email |
| `display_name` | VARCHAR | null | Display name |
| `budget` | DECIMAL(10,2) | 500.00 | Simulated wallet balance |
| `created_at` | TIMESTAMPTZ | NOW() | Account creation time |

**RLS:** Users can only read/update their own row.

---

## Table: `wishlist_items`
Products being tracked by a user.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | gen_random_uuid() | Unique item ID |
| `user_id` | UUID | FK → auth.users | Owner |
| `product_url` | TEXT | NOT NULL | Source product URL |
| `product_name` | VARCHAR(200) | null | Product display name |
| `retailer` | VARCHAR(50) | null | amazon, walmart, target, etc. |
| `image_url` | TEXT | null | Product thumbnail |
| `target_price` | DECIMAL(10,2) | NOT NULL | User's limit order price |
| `current_price` | DECIMAL(10,2) | null | Latest scraped price |
| `highest_price` | DECIMAL(10,2) | null | All-time high (for savings calc) |
| `status` | VARCHAR(20) | 'watching' | watching \| pending_buy \| bought \| paused |
| `created_at` | TIMESTAMPTZ | NOW() | When added |

**RLS:** Full CRUD for item owner only.

---

## Table: `price_history`
Time series of price snapshots per product.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | gen_random_uuid() | Record ID |
| `item_id` | UUID | FK → wishlist_items | Which product |
| `price` | DECIMAL(10,2) | NOT NULL | Price at time of scrape |
| `retailer` | VARCHAR(50) | null | Source retailer |
| `scraped_at` | TIMESTAMPTZ | NOW() | When price was captured |

**RLS:** Select by item owner; insert allowed for edge functions (service role).

---

## Table: `transactions`
Completed "purchases" executed by the agent.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `item_id` | UUID | FK → wishlist_items |
| `user_id` | UUID | FK → auth.users |
| `buy_price` | DECIMAL(10,2) | Price agent paid |
| `market_price` | DECIMAL(10,2) | Original/list price |
| `saved_amount` | DECIMAL(10,2) | GENERATED: market_price - buy_price |
| `reasoning` | TEXT | AI-generated explanation |
| `decided_at` | TIMESTAMPTZ | When agent decided |

**RLS:** Select by user_id; insert allowed for edge functions.

---

## Realtime Channels

| Pattern | Purpose |
|---------|---------|
| `snag:updates` | Global agent events (BUY/WATCH/HOLD decisions, price updates) |
| `snag:user:{user_id}` | Per-user notifications |

Events published:
- `buy_pending` — agent decided BUY, awaiting user confirmation
- `agent_decision` — WATCH or HOLD trading decision
- `buy_executed` — user confirmed and purchase completed
- `price_update` — new price scraped
