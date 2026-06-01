-- ============================================================
--  Ofertare Instalații — schema „seif online" (Supabase)
--  Se rulează O SINGURĂ DATĂ în: Supabase → SQL Editor → New query → Run
--  Fiecare utilizator vede DOAR datele lui (Row Level Security).
-- ============================================================

-- Setări firmă (1 rând / utilizator)
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Catalog articole (1 document / utilizator)
create table if not exists public.catalog (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Oferte (1 rând / ofertă)
create table if not exists public.oferte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create index if not exists oferte_user_idx on public.oferte(user_id);

-- ---------- Row Level Security ----------
alter table public.settings enable row level security;
alter table public.catalog  enable row level security;
alter table public.oferte   enable row level security;

-- settings
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- catalog
drop policy if exists "own catalog" on public.catalog;
create policy "own catalog" on public.catalog
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- oferte
drop policy if exists "own oferte" on public.oferte;
create policy "own oferte" on public.oferte
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
