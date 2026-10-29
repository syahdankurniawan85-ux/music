-- Jalankan di Supabase Dashboard > SQL Editor > New query.
-- Tabel menyimpan data milik user yang login saja. RLS wajib aktif.
create table if not exists public.neonwave_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorites integer[] not null default '{}',
  playlists jsonb not null default '[]'::jsonb,
  queue integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.neonwave_user_data enable row level security;

drop policy if exists "Users can read own NEONWAVE data" on public.neonwave_user_data;
create policy "Users can read own NEONWAVE data"
  on public.neonwave_user_data for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own NEONWAVE data" on public.neonwave_user_data;
create policy "Users can insert own NEONWAVE data"
  on public.neonwave_user_data for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own NEONWAVE data" on public.neonwave_user_data;
create policy "Users can update own NEONWAVE data"
  on public.neonwave_user_data for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.neonwave_user_data to authenticated;
