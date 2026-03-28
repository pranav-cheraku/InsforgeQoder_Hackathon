-- ============================================================
-- DealFlow Database Setup
-- Run via: npx @insforge/cli db import docs/database-setup.sql
-- ============================================================

-- ─── 1. Users (extends auth.users) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         VARCHAR        NOT NULL,
  display_name  VARCHAR,
  budget        DECIMAL(10,2)  NOT NULL DEFAULT 500.00,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── 2. Wishlist Items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlist_items (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_url   TEXT           NOT NULL,
  product_name  VARCHAR(200),
  retailer      VARCHAR(50),
  image_url     TEXT,
  target_price  DECIMAL(10,2)  NOT NULL,
  current_price DECIMAL(10,2),
  highest_price DECIMAL(10,2),
  status        VARCHAR(20)    NOT NULL DEFAULT 'watching'
                               CHECK (status IN ('watching', 'bought', 'paused')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_crud_own" ON wishlist_items
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_status ON wishlist_items(status);


-- ─── 3. Price History ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_history (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID           NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  price       DECIMAL(10,2)  NOT NULL,
  retailer    VARCHAR(50),
  scraped_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Users can read price history for their own items
CREATE POLICY "price_history_read_own" ON price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wishlist_items
      WHERE id = price_history.item_id
        AND user_id = auth.uid()
    )
  );

-- Edge Functions (service role) can insert price history
CREATE POLICY "price_history_insert_service" ON price_history
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped ON price_history(scraped_at DESC);


-- ─── 4. Transactions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID           NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  user_id       UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buy_price     DECIMAL(10,2)  NOT NULL,
  market_price  DECIMAL(10,2),
  saved_amount  DECIMAL(10,2)  GENERATED ALWAYS AS (
                  CASE WHEN market_price IS NOT NULL
                  THEN GREATEST(0, market_price - buy_price)
                  ELSE 0 END
                ) STORED,
  reasoning     TEXT,
  decided_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_read_own" ON transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "transactions_insert_service" ON transactions
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_decided ON transactions(decided_at DESC);


-- ─── 5. Realtime Channel Patterns ─────────────────────────────────────────────

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES
  ('dealflow:updates',    'Global DealFlow agent events and price updates', true),
  ('dealflow:user:%',     'Per-user notification channel',                  true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;


-- ─── 6. Demo Seed Data ─────────────────────────────────────────────────────────
-- Run this section manually to populate demo data for the hackathon presentation.
-- Replace 'DEMO_USER_ID' with the actual UUID from auth.users after signing up.

/*

-- Seed wishlist items (replace DEMO_USER_ID)
INSERT INTO wishlist_items (id, user_id, product_url, product_name, retailer, target_price, current_price, highest_price, status)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'DEMO_USER_ID', 'https://amazon.com/dp/B08N5KWB9H', 'Sony WH-1000XM4 Headphones', 'amazon', 280.00, 299.99, 349.99, 'watching'),
  ('11111111-0000-0000-0000-000000000002', 'DEMO_USER_ID', 'https://amazon.com/dp/B09G9BHH2K', 'iPad Air 5th Gen 64GB', 'amazon', 499.00, 519.00, 599.00, 'watching'),
  ('11111111-0000-0000-0000-000000000003', 'DEMO_USER_ID', 'https://walmart.com/ip/123456', 'Dyson V11 Vacuum', 'walmart', 400.00, 389.00, 499.00, 'bought'),
  ('11111111-0000-0000-0000-000000000004', 'DEMO_USER_ID', 'https://target.com/p/-/A-12345', 'Nintendo Switch OLED', 'target', 320.00, 349.00, 349.00, 'watching'),
  ('11111111-0000-0000-0000-000000000005', 'DEMO_USER_ID', 'https://bestbuy.com/site/12345', 'LG 27" 4K Monitor', 'bestbuy', 300.00, 279.00, 399.00, 'bought');

-- Seed 30 days of price history for Sony headphones (declining trend → triggers buy)
INSERT INTO price_history (item_id, price, retailer, scraped_at)
SELECT
  '11111111-0000-0000-0000-000000000001',
  349.99 - (gs.day * 1.7) + (sin(gs.day * 0.5) * 5),
  'amazon',
  NOW() - ((30 - gs.day) * INTERVAL '1 day')
FROM generate_series(0, 29) AS gs(day);

-- Seed price history for iPad (volatile then stabilizing)
INSERT INTO price_history (item_id, price, retailer, scraped_at)
SELECT
  '11111111-0000-0000-0000-000000000002',
  599.00 - (gs.day * 2.0) + (cos(gs.day * 0.8) * 15),
  'amazon',
  NOW() - ((30 - gs.day) * INTERVAL '1 day')
FROM generate_series(0, 29) AS gs(day);

*/
