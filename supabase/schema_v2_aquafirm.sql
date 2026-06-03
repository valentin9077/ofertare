-- ============================================================
-- AquaFirm / AquaOffer — Schema v2 modulară
-- Pentru Supabase / Postgres
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. COMPANIES / USERS
-- ============================================================

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cui text,
  reg_com text,
  address text,
  phone text,
  email text,
  iban text,
  bank text,
  logo_url text,
  slogan text,
  vat_rate numeric(5,2) not null default 21,
  default_warranty_months int not null default 24,
  default_offer_valid_days int not null default 30,
  default_advance_percent numeric(5,2) not null default 30,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

-- ============================================================
-- 2. BENEFICIARI / ȘANTIERE
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  cui text,
  reg_com text,
  address text,
  phone text,
  email text,
  contact_name text,
  contact_phone text,
  contact_email text,
  vat_status text,
  anaf_raw jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_company_idx on public.clients(company_id);
create index if not exists clients_cui_idx on public.clients(cui);

create table if not exists public.client_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  address text,
  contact_name text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. CATALOG MANOPERĂ + ALIASURI
-- ============================================================

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text,
  domain_code text,
  domain_name text,
  category text,
  subcategory text,
  name text not null,
  description text,
  unit text not null default 'buc',
  labor_price numeric(14,2),
  vat_rate numeric(5,2) not null default 21,
  item_type text not null default 'componenta', -- componenta / pachet / serviciu / proba / auxiliar
  normative text,
  active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_catalog_company_idx on public.product_catalog(company_id);
create index if not exists product_catalog_name_idx on public.product_catalog using gin(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.product_catalog(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'manual', -- manual / import_confirmed / ai
  confidence numeric(5,2),
  created_at timestamptz not null default now(),
  unique(company_id, normalized_alias)
);

-- ============================================================
-- 4. IMPORT LISTE BENEFICIAR
-- ============================================================

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.client_sites(id) on delete set null,
  source_type text not null, -- excel / pdf / image / text / whatsapp
  file_name text,
  file_url text,
  status text not null default 'parsed', -- uploaded / parsed / reviewed / converted_to_offer
  raw_text text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_no int,
  original_name text not null,
  original_description text,
  original_unit text,
  original_qty numeric(14,3),
  matched_product_id uuid references public.product_catalog(id) on delete set null,
  matched_name text,
  match_confidence numeric(5,2),
  status text not null default 'needs_review', -- matched_auto / needs_review / missing_catalog_item / ignored / manual_added
  final_name text,
  final_description text,
  final_unit text,
  final_qty numeric(14,3),
  final_price numeric(14,2),
  domain_code text,
  domain_name text,
  metadata jsonb not null default '{}'
);

-- ============================================================
-- 5. OFERTE + CIORNĂ EDITABILĂ
-- ============================================================

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.client_sites(id) on delete set null,
  import_id uuid references public.imports(id) on delete set null,
  offer_number text not null,
  offer_date date not null default current_date,
  valid_until date,
  status text not null default 'draft', -- draft / sent / accepted / rejected / expired / converted_to_project
  subject text,
  payment_terms jsonb not null default '{}',
  warranty_months int,
  notes text,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  export_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, offer_number)
);

create index if not exists offers_company_idx on public.offers(company_id);
create index if not exists offers_client_idx on public.offers(client_id);

create table if not exists public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  product_id uuid references public.product_catalog(id) on delete set null,
  import_row_id uuid references public.import_rows(id) on delete set null,
  line_no int,
  domain_code text,
  domain_name text,
  name text not null,
  description text,
  unit text not null default 'buc',
  qty numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 21,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  match_status text,
  match_confidence numeric(5,2),
  include_in_export boolean not null default true,
  metadata jsonb not null default '{}'
);

-- ============================================================
-- 6. PROIECTE / CONTRACTE DIN OFERTE ACCEPTATE
-- ============================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.client_sites(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  project_number text,
  name text not null,
  status text not null default 'nou', -- nou / in_lucru / partial_decontat / finalizat / facturat / inchis
  start_date date,
  reception_date date,
  contract_total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  offer_item_id uuid references public.offer_items(id) on delete set null,
  product_id uuid references public.product_catalog(id) on delete set null,
  line_no int,
  domain_code text,
  domain_name text,
  name text not null,
  description text,
  unit text not null default 'buc',
  contracted_qty numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 21,
  contracted_total numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'
);

-- ============================================================
-- 7. SITUAȚII DE LUCRĂRI / DECONTĂRI
-- ============================================================

create table if not exists public.work_situations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  situation_number int not null,
  period_label text,
  status text not null default 'draft', -- draft / trimisa / aprobata / facturata / platita / anulata
  situation_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, situation_number)
);

create table if not exists public.work_situation_items (
  id uuid primary key default gen_random_uuid(),
  situation_id uuid not null references public.work_situations(id) on delete cascade,
  project_item_id uuid not null references public.project_items(id) on delete cascade,
  contracted_qty numeric(14,3) not null default 0,
  previously_settled_qty numeric(14,3) not null default 0,
  current_qty numeric(14,3) not null default 0,
  remaining_qty numeric(14,3) not null default 0,
  unit_price numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text
);

-- ============================================================
-- 8. GARANȚII
-- ============================================================

create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.client_sites(id) on delete set null,
  warranty_months int not null default 24,
  reception_date date not null,
  expires_at date not null,
  status text not null default 'activa', -- activa / expira_curand / expirata / interventie_deschisa / inchisa
  notify_90 boolean not null default false,
  notify_30 boolean not null default false,
  notify_7 boolean not null default false,
  notify_expired boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warranty_events (
  id uuid primary key default gen_random_uuid(),
  warranty_id uuid not null references public.warranties(id) on delete cascade,
  event_date date not null default current_date,
  event_type text not null, -- notificare / interventie / inchidere / observatie
  description text,
  cost numeric(14,2) not null default 0,
  status text,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. PONTAJ IMPORTAT / SALARII
-- ============================================================

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  external_id text,
  name text not null,
  email text,
  phone text,
  daily_rate numeric(14,2),
  status text not null default 'active',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null, -- workforce_app_api / excel / csv / manual
  source_file text,
  period_start date,
  period_end date,
  status text not null default 'imported',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_rows (
  id uuid primary key default gen_random_uuid(),
  attendance_import_id uuid references public.attendance_imports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  location_name text,
  work_date date not null,
  status text not null, -- present / absent / concediu / extra
  hours numeric(8,2),
  day_cost numeric(14,2),
  metadata jsonb not null default '{}'
);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  label text not null,
  status text not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  daily_rate numeric(14,2) not null default 0,
  work_days numeric(8,2) not null default 0,
  extra_days numeric(8,2) not null default 0,
  vacation_days numeric(8,2) not null default 0,
  absences numeric(8,2) not null default 0,
  per_diem numeric(14,2) not null default 0,
  bonus numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'
);

-- ============================================================
-- 10. CHELTUIELI / SMARTBILL / FISCAL / AI
-- ============================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  expense_date date not null default current_date,
  supplier text,
  category text,
  amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  source text not null default 'manual', -- manual / ocr / smartbill / excel / payroll
  receipt_url text,
  status text not null default 'verificata',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.smartbill_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  situation_id uuid references public.work_situations(id) on delete set null,
  smartbill_id text,
  document_type text,
  document_number text,
  issue_date date,
  due_date date,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  status text,
  spv_status text,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  vat_collected numeric(14,2) not null default 0,
  vat_deductible numeric(14,2) not null default 0,
  vat_to_pay numeric(14,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  expenses numeric(14,2) not null default 0,
  payroll numeric(14,2) not null default 0,
  estimated_profit numeric(14,2) not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  memory_type text not null, -- rule / alias / preference / note
  key text not null,
  value jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, memory_type, key)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null,
  content text not null,
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 11. RLS
-- ============================================================

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_sites enable row level security;
alter table public.product_catalog enable row level security;
alter table public.product_aliases enable row level security;
alter table public.imports enable row level security;
alter table public.import_rows enable row level security;
alter table public.offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.work_situations enable row level security;
alter table public.work_situation_items enable row level security;
alter table public.warranties enable row level security;
alter table public.warranty_events enable row level security;
alter table public.employees enable row level security;
alter table public.attendance_imports enable row level security;
alter table public.attendance_rows enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_items enable row level security;
alter table public.expenses enable row level security;
alter table public.smartbill_documents enable row level security;
alter table public.fiscal_snapshots enable row level security;
alter table public.ai_memory enable row level security;
alter table public.ai_messages enable row level security;

-- Helper pentru acces pe company_id
create or replace function public.is_company_member(cid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active'
  ) or exists (
    select 1 from public.companies c
    where c.id = cid and c.owner_id = auth.uid()
  );
$$;

-- Politici generice: fiecare membru vede datele firmei lui.
-- Pentru tabele cu company_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','client_sites','product_catalog','product_aliases','imports','offers','projects','work_situations','warranties','employees','attendance_imports','attendance_rows','payroll_periods','expenses','smartbill_documents','fiscal_snapshots','ai_memory','ai_messages'
  ] loop
    execute format('drop policy if exists "%s_company_access" on public.%I', t, t);
    execute format('create policy "%s_company_access" on public.%I for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', t, t);
  end loop;
end $$;

-- RLS pentru companies / members.
drop policy if exists "companies_owner_or_member" on public.companies;
create policy "companies_owner_or_member" on public.companies
  for all using (owner_id = auth.uid() or public.is_company_member(id))
  with check (owner_id = auth.uid());

drop policy if exists "members_company_access" on public.company_members;
create policy "members_company_access" on public.company_members
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Tabele copil fără company_id direct.
drop policy if exists "import_rows_access" on public.import_rows;
create policy "import_rows_access" on public.import_rows
  for all using (exists (select 1 from public.imports i where i.id = import_id and public.is_company_member(i.company_id)))
  with check (exists (select 1 from public.imports i where i.id = import_id and public.is_company_member(i.company_id)));

drop policy if exists "offer_items_access" on public.offer_items;
create policy "offer_items_access" on public.offer_items
  for all using (exists (select 1 from public.offers o where o.id = offer_id and public.is_company_member(o.company_id)))
  with check (exists (select 1 from public.offers o where o.id = offer_id and public.is_company_member(o.company_id)));

drop policy if exists "project_items_access" on public.project_items;
create policy "project_items_access" on public.project_items
  for all using (exists (select 1 from public.projects p where p.id = project_id and public.is_company_member(p.company_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.is_company_member(p.company_id)));

drop policy if exists "work_situation_items_access" on public.work_situation_items;
create policy "work_situation_items_access" on public.work_situation_items
  for all using (exists (select 1 from public.work_situations s where s.id = situation_id and public.is_company_member(s.company_id)))
  with check (exists (select 1 from public.work_situations s where s.id = situation_id and public.is_company_member(s.company_id)));

drop policy if exists "warranty_events_access" on public.warranty_events;
create policy "warranty_events_access" on public.warranty_events
  for all using (exists (select 1 from public.warranties w where w.id = warranty_id and public.is_company_member(w.company_id)))
  with check (exists (select 1 from public.warranties w where w.id = warranty_id and public.is_company_member(w.company_id)));

drop policy if exists "payroll_items_access" on public.payroll_items;
create policy "payroll_items_access" on public.payroll_items
  for all using (exists (select 1 from public.payroll_periods p where p.id = payroll_period_id and public.is_company_member(p.company_id)))
  with check (exists (select 1 from public.payroll_periods p where p.id = payroll_period_id and public.is_company_member(p.company_id)));
