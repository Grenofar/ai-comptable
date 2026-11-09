-- Informations de l'émetteur (mentions obligatoires sur devis et factures).
-- Une ligne par utilisateur. Les mentions sont figées dans le document à l'émission.

create table public.issuer_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  legal_name text not null check (length(trim(legal_name)) > 0 and length(legal_name) <= 200),
  legal_form text check (length(legal_form) <= 100),
  address text check (length(address) <= 500),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  vat_number text check (length(vat_number) <= 30),
  email text check (length(email) <= 200),
  phone text check (length(phone) <= 50),
  iban text check (length(iban) <= 50),
  payment_terms text check (length(payment_terms) <= 1000),
  legal_notice text check (length(legal_notice) <= 2000),
  updated_at timestamptz not null default now()
);

alter table public.issuer_profiles enable row level security;

create policy issuer_profiles_owner on public.issuer_profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger issuer_profiles_touch
before update on public.issuer_profiles
for each row execute function public.touch_updated_at();

-- Copie figée des mentions de l'émetteur, prise au moment de l'émission.
-- Un document émis garde ses mentions même si le profil change ensuite.
alter table public.documents add column issuer_snapshot jsonb;

-- S'exécute après documents_assign_number (ordre alphabétique des triggers) :
-- à ce stade le numéro vient d'être attribué, ce qui signale l'émission.
create or replace function public.snapshot_issuer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.issuer_snapshot := null;
  elsif old.number is not null then
    new.issuer_snapshot := old.issuer_snapshot;
  elsif new.number is not null then
    select to_jsonb(p) - 'user_id' - 'updated_at'
    into new.issuer_snapshot
    from public.issuer_profiles p
    where p.user_id = new.user_id;
  else
    new.issuer_snapshot := null;
  end if;
  return new;
end;
$$;

create trigger documents_issuer_snapshot
before insert or update on public.documents
for each row execute function public.snapshot_issuer();