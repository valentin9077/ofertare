-- ============================================================
--  AquaOffer — schema de bază (Sprint 1-2): firmă, catalog (15 domenii),
--  beneficiari, șantiere, oferte, rânduri ofertă, memorie matching.
--  Modulele avansate (proiecte, situații, garanții, pontaj, salarii,
--  cheltuieli, facturi) se adaugă în sprinturile lor.
--  Rulează în Supabase → SQL Editor.
-- ============================================================

-- Profil utilizator -> firmă (pentru Row Level Security)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid,
  role text not null default 'owner' check (role in ('owner','manager','employee')),
  created_at timestamptz not null default now()
);

-- Firma
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'SCV AQUA PREMIUM INSTAL SRL',
  cui text default 'RO47989333',
  reg_com text default 'J23/2461/2023',
  address text default 'Str. Amurgului 43, Bl.3, Et.1, Ap.7, Popești-Leordeni, Ilfov',
  phone text default '0737 757 673',
  email text default 'simpteavalentin@yahoo.com',
  iban text default 'RO52BTRLRONCRT0CW5784401',
  bank text default 'Banca Transilvania',
  tagline text default 'Smart Solutions For The Future',
  vat numeric not null default 21,
  warranty_months int not null default 24,
  advance_percent int not null default 30,
  late_penalty numeric not null default 0.1,
  validity_days int not null default 30,
  created_at timestamptz not null default now()
);

-- Cele 15 domenii oficiale (A-N + Z)
create table if not exists public.domains (
  code char(1) primary key,
  name text not null,
  short text not null,
  sort_order int not null
);
insert into public.domains (code,name,short,sort_order) values
 ('A','Sanitare - conducte alimentare apă','Sanitare apă',1),
 ('B','Canalizare menajeră','Canal. menajeră',2),
 ('C','Canalizare pluvială','Canal. pluvială',3),
 ('D','Obiecte sanitare','Obiecte sanitare',4),
 ('E','Armături și accesorii','Armături',5),
 ('F','Izolații termice','Izolații',6),
 ('G','Hidranți interiori','Hidranți',7),
 ('H','Dotări mijloace tehnice PSI','Dotări PSI',8),
 ('I','Probe de presiune și funcționare','Probe',9),
 ('J','Gospodărie apă și PSI','Gospodărie apă',10),
 ('K','Radiatoare','Radiatoare',11),
 ('L','Aparate, armături, accesorii termice','Aparate termice',12),
 ('M','Instalații ventilare','Ventilare',13),
 ('N','Echipamente','Echipamente',14),
 ('Z','Diverse','Diverse',99)
on conflict (code) do nothing;

-- Catalog manoperă
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text,
  name text not null,
  description text,
  domain char(1) not null references public.domains(code),
  unit text not null default 'buc',
  price_no_vat numeric,
  type text not null default 'componenta' check (type in ('componenta','pachet')),
  keywords text default '',
  normativ text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_company_idx on public.products(company_id);
create index if not exists products_domain_idx on public.products(domain);

-- Beneficiari
create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  cui text, reg_com text, address text, phone text, email text, contact_person text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists beneficiaries_company_idx on public.beneficiaries(company_id);

-- Șantiere / puncte de lucru
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  name text not null, address text, notes text
);

-- Oferte
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number text,
  date date not null default current_date,
  valid_until date,
  beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  site_address text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  advance_percent numeric default 30,
  late_penalty numeric default 0.1,
  warranty_months int default 24,
  subject text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_company_idx on public.offers(company_id);

-- Rânduri ofertă (snapshot la momentul ofertării)
create table if not exists public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  description text,
  domain char(1) references public.domains(code),
  unit text default 'buc',
  qty numeric not null default 1,
  price_no_vat numeric not null default 0,
  vat_percent numeric not null default 21,
  order_idx int not null default 0,
  included boolean not null default true
);
create index if not exists offer_items_offer_idx on public.offer_items(offer_id);

-- Memorie matching (învață potrivirile confirmate de utilizator)
create table if not exists public.product_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  original_text text not null,
  product_id uuid references public.products(id) on delete cascade,
  confirmed_by_user boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------- Row Level Security ----------------
alter table public.profiles       enable row level security;
alter table public.companies      enable row level security;
alter table public.products       enable row level security;
alter table public.beneficiaries  enable row level security;
alter table public.sites          enable row level security;
alter table public.offers         enable row level security;
alter table public.offer_items    enable row level security;
alter table public.product_matches enable row level security;

-- helper: firma utilizatorului curent
create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

drop policy if exists p_profiles on public.profiles;
create policy p_profiles on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists p_companies on public.companies;
create policy p_companies on public.companies for all
  using (id = public.my_company()) with check (id = public.my_company());

-- tabele cu company_id
do $$ declare t text; begin
  foreach t in array array['products','beneficiaries','offers','product_matches'] loop
    execute format('drop policy if exists p_%1$s on public.%1$s;', t);
    execute format('create policy p_%1$s on public.%1$s for all using (company_id = public.my_company()) with check (company_id = public.my_company());', t);
  end loop;
end $$;

-- sites (prin beneficiar) și offer_items (prin ofertă)
drop policy if exists p_sites on public.sites;
create policy p_sites on public.sites for all
  using (exists (select 1 from public.beneficiaries b where b.id = sites.beneficiary_id and b.company_id = public.my_company()))
  with check (exists (select 1 from public.beneficiaries b where b.id = sites.beneficiary_id and b.company_id = public.my_company()));

drop policy if exists p_offer_items on public.offer_items;
create policy p_offer_items on public.offer_items for all
  using (exists (select 1 from public.offers o where o.id = offer_items.offer_id and o.company_id = public.my_company()))
  with check (exists (select 1 from public.offers o where o.id = offer_items.offer_id and o.company_id = public.my_company()));

-- domeniile sunt publice (citire)
alter table public.domains enable row level security;
drop policy if exists p_domains on public.domains;
create policy p_domains on public.domains for select using (true);
