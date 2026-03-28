-- Snag Database Schema
-- Run this in your Insforge SQL editor to initialize the database.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Extends Insforge auth.users with app-specific data
create table public.users (
  id            uuid primary key default uuid_generate_v4(),
  email         varchar unique not null,
  display_name  varchar,
  budget        decimal default 500.00,
  created_at    timestamp with time zone default now()
);

alter table public.users enable row level security;
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- ─── Wishlist Items ───────────────────────────────────────────────────────────
create type wishlist_status as enum ('watching', 'bought', 'paused');

create table public.wishlist_items (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  product_url    text not null,
  product_name   varchar,
  retailer       varchar,
  image_url      text,
  target_price   decimal not null,
  current_price  decimal default 0,
  highest_price  decimal default 0,
  status         wishlist_status default 'watching',
  created_at     timestamp with time zone default now()
);

alter table public.wishlist_items enable row level security;
create policy "Users can manage own wishlist" on public.wishlist_items
  for all using (auth.uid() = user_id);

-- Allow edge functions (service role) to update prices
create policy "Service role full access on wishlist" on public.wishlist_items
  for all using (auth.role() = 'service_role');

-- ─── Price History ────────────────────────────────────────────────────────────
create table public.price_history (
  id          uuid primary key default uuid_generate_v4(),
  item_id     uuid not null references public.wishlist_items(id) on delete cascade,
  price       decimal not null,
  retailer    varchar,
  scraped_at  timestamp with time zone default now()
);

alter table public.price_history enable row level security;
create policy "Users can view price history for own items" on public.price_history
  for select using (
    exists (
      select 1 from public.wishlist_items
      where id = price_history.item_id and user_id = auth.uid()
    )
  );
create policy "Service role full access on price_history" on public.price_history
  for all using (auth.role() = 'service_role');

-- ─── Transactions ─────────────────────────────────────────────────────────────
create table public.transactions (
  id            uuid primary key default uuid_generate_v4(),
  item_id       uuid not null references public.wishlist_items(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  buy_price     decimal not null,
  market_price  decimal,
  saved_amount  decimal generated always as (coalesce(market_price, 0) - buy_price) stored,
  reasoning     text,
  decided_at    timestamp with time zone default now()
);

alter table public.transactions enable row level security;
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);
create policy "Service role full access on transactions" on public.transactions
  for all using (auth.role() = 'service_role');

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime on these tables so the mobile app gets live updates
alter publication supabase_realtime add table public.price_history;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.wishlist_items;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index idx_wishlist_user on public.wishlist_items(user_id);
create index idx_wishlist_status on public.wishlist_items(status);
create index idx_price_history_item on public.price_history(item_id, scraped_at desc);
create index idx_transactions_user on public.transactions(user_id, decided_at desc);
