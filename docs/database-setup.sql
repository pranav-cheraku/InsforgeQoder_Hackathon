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

-- Edge functions (service role) can update budget after a buy
CREATE POLICY "users_update_service" ON users
  FOR UPDATE WITH CHECK (true);

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
  current_price DECIMAL(10,2)  DEFAULT 0,
  highest_price DECIMAL(10,2)  DEFAULT 0,
  status        VARCHAR(20)    NOT NULL DEFAULT 'watching'
                               CHECK (status IN ('watching', 'bought', 'paused')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_crud_own" ON wishlist_items
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Edge functions (service role) need to update current_price, product_name, status
CREATE POLICY "wishlist_update_service" ON wishlist_items
  FOR UPDATE WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wishlist_user   ON wishlist_items(user_id);
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

CREATE POLICY "price_history_read_own" ON price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wishlist_items
      WHERE id = price_history.item_id
        AND user_id = auth.uid()
    )
  );

-- Edge functions (service role) write price snapshots
CREATE POLICY "price_history_insert_service" ON price_history
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_price_history_item    ON price_history(item_id);
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

-- Edge functions (service role) insert transactions on buy
CREATE POLICY "transactions_insert_service" ON transactions
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_decided ON transactions(decided_at DESC);


-- ─── 5. Realtime Channels ─────────────────────────────────────────────────────

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES
  ('dealflow:updates', 'Global DealFlow agent events and price updates', true),
  ('dealflow:user:%',  'Per-user notification channel',                  true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;


-- ─── 6. Demo Seed Data ─────────────────────────────────────────────────────────
-- HOW TO USE:
--   1. Sign up via the app (auth trigger auto-creates your users row)
--   2. Copy your user UUID from: InsForge dashboard → Auth → Users
--   3. Replace every DEMO_USER_ID below with your UUID
--   4. Uncomment and run this block in the InsForge SQL editor

/*

INSERT INTO wishlist_items (id, user_id, product_url, product_name, retailer, target_price, current_price, highest_price, status)
VALUES
  ('11111111-1111-1111-1111-000000000001', 'DEMO_USER_ID',
   'https://amazon.com/dp/B09XS7JWHH', 'Sony WH-1000XM5 Headphones',
   'amazon', 279.99, 299.99, 399.99, 'watching'),

  ('11111111-1111-1111-1111-000000000002', 'DEMO_USER_ID',
   'https://amazon.com/dp/B0BDHWDR12', 'Apple AirPods Pro (2nd Gen)',
   'amazon', 199.99, 218.99, 249.00, 'watching'),

  ('11111111-1111-1111-1111-000000000003', 'DEMO_USER_ID',
   'https://amazon.com/dp/B09TMF6742', 'Kindle Paperwhite 16GB',
   'amazon', 99.99, 97.99, 159.99, 'bought'),

  ('11111111-1111-1111-1111-000000000004', 'DEMO_USER_ID',
   'https://amazon.com/dp/B00FLYWNYQ', 'Instant Pot Duo 7-in-1',
   'amazon', 69.99, 89.99, 109.99, 'watching'),

  ('11111111-1111-1111-1111-000000000005', 'DEMO_USER_ID',
   'https://walmart.com/ip/Dyson-V15/123456', 'Dyson V15 Detect Vacuum',
   'walmart', 549.99, 599.99, 749.99, 'watching');


-- 30 days of price history — Sony headphones: sustained decline → triggers BUY near end
INSERT INTO price_history (item_id, price, retailer, scraped_at)
SELECT
  '11111111-1111-1111-1111-000000000001',
  ROUND((399.99 - (gs.day * 3.2) + (SIN(gs.day * 0.5) * 5))::NUMERIC, 2),
  'amazon',
  NOW() - ((30 - gs.day) * INTERVAL '1 day')
FROM generate_series(0, 29) AS gs(day);

-- AirPods: volatile, hovering above target (WATCH signal)
INSERT INTO price_history (item_id, price, retailer, scraped_at)
SELECT
  '11111111-1111-1111-1111-000000000002',
  ROUND((249.00 - (gs.day * 2.0) + (COS(gs.day * 0.8) * 15))::NUMERIC, 2),
  'amazon',
  NOW() - ((30 - gs.day) * INTERVAL '1 day')
FROM generate_series(0, 29) AS gs(day);

-- Kindle: already bought — shows completed downtrend
INSERT INTO price_history (item_id, price, retailer, scraped_at)
SELECT
  '11111111-1111-1111-1111-000000000003',
  ROUND((159.99 - (gs.day * 1.8) + (gs.day * 0.3))::NUMERIC, 2),
  'amazon',
  NOW() - ((30 - gs.day) * INTERVAL '1 day')
FROM generate_series(0, 29) AS gs(day);

-- Transaction: Kindle buy (the demo "wow moment" — agent already executed this one)
INSERT INTO transactions (item_id, user_id, buy_price, market_price, reasoning, decided_at)
VALUES (
  '11111111-1111-1111-1111-000000000003',
  'DEMO_USER_ID',
  97.99,
  159.99,
  'Price dropped 38.8% over 28 days to $97.99 — $2 below your $99.99 target. The 7-day moving average confirms a sustained downtrend, not a flash sale. Volatility score is 0.12 (low), indicating price stability. Composite signal score: 0.91. Executing buy.',
  NOW() - INTERVAL '2 days'
);

*/
