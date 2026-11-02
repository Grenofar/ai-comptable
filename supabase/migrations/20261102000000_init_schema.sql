-- Schéma initial AI Comptable. Montants en centimes (entiers).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  address text,
  vat_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  created_at timestamptz not null default now()
);

create type public.document_type as enum ('quote', 'invoice');
create type public.document_status as enum ('draft', 'sent', 'accepted', 'rejected', 'paid', 'cancelled');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  type public.document_type not null,
  status public.document_status not null default 'draft',
  number text,
  year int not null default extract(year from now())::int,
  issue_date date not null default current_date,
  due_date date,
  notes text,
  subtotal_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, type, number)
);

create table public.document_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null default current_date,
  method text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  category text,
  amount_cents bigint not null check (amount_cents > 0),
  vat_cents bigint not null default 0 check (vat_cents >= 0),
  spent_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index on public.clients (user_id);
create index on public.products (user_id);
create index on public.documents (user_id, type, year);
create index on public.document_lines (document_id);
create index on public.payments (document_id);
create index on public.expenses (user_id, spent_on);
