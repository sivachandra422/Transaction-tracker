-- Transactions table with per-user row-level security.
-- Apply via Supabase dashboard SQL editor or `supabase db push`.

create table if not exists public.transactions (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount      numeric(14, 2) not null check (amount >= 0),
  description text not null default '',
  merchant    text not null default '',
  category    text not null check (category in (
    'Food','Groceries','Transport','Utilities','Shopping',
    'Entertainment','Housing','Income','Other'
  )),
  type        text not null check (type in ('expense', 'income')),
  date        date not null,
  labels      text[] not null default '{}',
  synced      boolean not null default false,
  notion_page_id text,
  notion_url     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Sync pull cursor scans by (user_id, updated_at)
create index if not exists transactions_user_updated_idx
  on public.transactions (user_id, updated_at);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

-- ── Row-level security: users only see their own rows ───────────────────────
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);
