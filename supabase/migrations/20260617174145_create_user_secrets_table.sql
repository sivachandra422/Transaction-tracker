create table if not exists public.user_secrets (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  notion_token          text,
  notion_database_id    text not null default '',
  notion_auto_sync      boolean not null default false,
  notion_database_title text,
  llm_api_key           text,
  llm_provider          text not null default 'gemini',
  llm_model             text not null default 'gemini-2.5-flash',
  updated_at            timestamptz not null default now()
);

alter table public.user_secrets enable row level security;

drop policy if exists "user_secrets_select_own" on public.user_secrets;
create policy "user_secrets_select_own"
  on public.user_secrets for select
  using (auth.uid() = user_id);

drop policy if exists "user_secrets_insert_own" on public.user_secrets;
create policy "user_secrets_insert_own"
  on public.user_secrets for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_secrets_update_own" on public.user_secrets;
create policy "user_secrets_update_own"
  on public.user_secrets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
