-- Snag Demo Seed Data
-- Run AFTER schema.sql to populate realistic demo data for the hackathon.
-- This gives you 5 products with 30 days of price history, seeded for a compelling demo.

-- Demo user (use the actual UUID from Insforge auth after signup)
insert into public.users (id, email, display_name, budget)
values ('00000000-0000-0000-0000-000000000001', 'demo@snag.ai', 'Demo User', 1000.00)
on conflict do nothing;

-- ─── Wishlist Items ───────────────────────────────────────────────────────────
insert into public.wishlist_items (id, user_id, product_name, product_url, retailer, target_price, current_price, highest_price, status)
values
  ('item-0001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Sony WH-1000XM5 Headphones', 'https://amazon.com/dp/B09XS7JWHH',
   'amazon', 279.99, 299.99, 399.99, 'watching'),

  ('item-0002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Apple AirPods Pro (2nd Gen)', 'https://amazon.com/dp/B0BDHWDR12',
   'amazon', 199.99, 218.99, 249.00, 'watching'),

  ('item-0003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Kindle Paperwhite 16GB', 'https://amazon.com/dp/B09TMF6742',
   'amazon', 99.99, 119.99, 159.99, 'bought'),

  ('item-0004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'Instant Pot Duo 7-in-1', 'https://amazon.com/dp/B00FLYWNYQ',
   'amazon', 69.99, 89.99, 109.99, 'watching'),

  ('item-0005-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'Dyson V15 Detect Vacuum', 'https://walmart.com/ip/Dyson-V15/123456',
   'walmart', 549.99, 599.99, 749.99, 'watching');

-- ─── Price History (30 days, realistic declining trend for Sony headphones) ───
-- Sony WH-1000XM5: starts high, dips below target near end for a BUY trigger
insert into public.price_history (item_id, price, retailer, scraped_at)
select
  'item-0001-0000-0000-0000-000000000001',
  round((399.99 - (row_number() over (order by day) * 3.2) + (random() * 10 - 5))::numeric, 2),
  'amazon',
  now() - (30 - row_number() over (order by day)) * interval '1 day'
from generate_series(0, 29) as day;

-- AirPods Pro: volatile, hovering above target
insert into public.price_history (item_id, price, retailer, scraped_at)
select
  'item-0002-0000-0000-0000-000000000002',
  round((249.00 - (random() * 40))::numeric, 2),
  'amazon',
  now() - (30 - row_number() over (order by day)) * interval '1 day'
from generate_series(0, 29) as day;

-- Kindle: already bought — shows historical dip
insert into public.price_history (item_id, price, retailer, scraped_at)
select
  'item-0003-0000-0000-0000-000000000003',
  round((159.99 - (row_number() over (order by day) * 1.8) + (random() * 5 - 2.5))::numeric, 2),
  'amazon',
  now() - (30 - row_number() over (order by day)) * interval '1 day'
from generate_series(0, 29) as day;

-- ─── Transaction (Kindle already bought) ─────────────────────────────────────
insert into public.transactions (item_id, user_id, buy_price, market_price, reasoning, decided_at)
values (
  'item-0003-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  97.99,
  159.99,
  'Price dropped 38.8% over 28 days to $97.99 — $2 below your $99.99 target. The 7-day moving average confirms a sustained downtrend, not a flash sale. Volatility score is 0.12 (low), indicating price stability. Composite signal score: 0.91. Executing buy.',
  now() - interval '2 days'
);
