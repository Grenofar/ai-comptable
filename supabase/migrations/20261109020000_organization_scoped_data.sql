-- Fait passer toutes les données métier d'un rattachement "par utilisateur" à un
-- rattachement "par organisation" : plusieurs membres d'une même organisation
-- partagent désormais les mêmes clients, devis, factures, dépenses...
-- L'ancienne colonne user_id est conservée en tant que created_by (traçabilité),
-- mais n'est plus utilisée par la sécurité au niveau des lignes (RLS).

-- ===================== clients =====================
alter table public.clients add column organization_id uuid references public.organizations(id) on delete cascade;
update public.clients c set organization_id = (
  select m.organization_id from public.organization_members m where m.user_id = c.user_id and m.role = 'owner' limit 1
) where organization_id is null;
alter table public.clients alter column organization_id set not null;
alter table public.clients rename column user_id to created_by;
create index on public.clients (organization_id);

drop policy clients_owner on public.clients;
create policy clients_org_member on public.clients
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = clients.organization_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.organization_id = clients.organization_id and m.user_id = auth.uid()));

-- ===================== products =====================
alter table public.products add column organization_id uuid references public.organizations(id) on delete cascade;
update public.products p set organization_id = (
  select m.organization_id from public.organization_members m where m.user_id = p.user_id and m.role = 'owner' limit 1
) where organization_id is null;
alter table public.products alter column organization_id set not null;
alter table public.products rename column user_id to created_by;
create index on public.products (organization_id);

drop policy products_owner on public.products;
create policy products_org_member on public.products
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = products.organization_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.organization_id = products.organization_id and m.user_id = auth.uid()));

-- ===================== documents =====================
alter table public.documents add column organization_id uuid references public.organizations(id) on delete cascade;
update public.documents d set organization_id = (
  select c.organization_id from public.clients c where c.id = d.client_id
) where organization_id is null;
alter table public.documents alter column organization_id set not null;
alter table public.documents rename column user_id to created_by;
create index on public.documents (organization_id, type, year);

alter table public.documents drop constraint documents_user_id_type_number_key;
alter table public.documents add constraint documents_org_type_number_key unique (organization_id, type, number);

drop policy documents_owner on public.documents;
create policy documents_org_member on public.documents
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = documents.organization_id and m.user_id = auth.uid()))
  with check (
    exists (select 1 from public.organization_members m where m.organization_id = documents.organization_id and m.user_id = auth.uid())
    and exists (select 1 from public.clients c where c.id = documents.client_id and c.organization_id = documents.organization_id)
  );

-- ===================== document_lines =====================
alter table public.document_lines add column organization_id uuid references public.organizations(id) on delete cascade;
update public.document_lines dl set organization_id = (
  select d.organization_id from public.documents d where d.id = dl.document_id
) where organization_id is null;
alter table public.document_lines alter column organization_id set not null;
alter table public.document_lines rename column user_id to created_by;

drop policy document_lines_owner on public.document_lines;
create policy document_lines_org_member on public.document_lines
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = document_lines.organization_id and m.user_id = auth.uid()))
  with check (
    exists (select 1 from public.organization_members m where m.organization_id = document_lines.organization_id and m.user_id = auth.uid())
    and exists (select 1 from public.documents d where d.id = document_lines.document_id and d.organization_id = document_lines.organization_id)
  );

-- ===================== payments =====================
alter table public.payments add column organization_id uuid references public.organizations(id) on delete cascade;
update public.payments p set organization_id = (
  select d.organization_id from public.documents d where d.id = p.document_id
) where organization_id is null;
alter table public.payments alter column organization_id set not null;
alter table public.payments rename column user_id to created_by;

drop policy payments_owner on public.payments;
create policy payments_org_member on public.payments
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = payments.organization_id and m.user_id = auth.uid()))
  with check (
    exists (select 1 from public.organization_members m where m.organization_id = payments.organization_id and m.user_id = auth.uid())
    and exists (select 1 from public.documents d where d.id = payments.document_id and d.organization_id = payments.organization_id)
  );

-- ===================== expenses =====================
alter table public.expenses add column organization_id uuid references public.organizations(id) on delete cascade;
update public.expenses e set organization_id = (
  select m.organization_id from public.organization_members m where m.user_id = e.user_id and m.role = 'owner' limit 1
) where organization_id is null;
alter table public.expenses alter column organization_id set not null;
alter table public.expenses rename column user_id to created_by;
create index on public.expenses (organization_id, spent_on);

drop policy expenses_owner on public.expenses;
create policy expenses_org_member on public.expenses
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = expenses.organization_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.organization_id = expenses.organization_id and m.user_id = auth.uid()));

-- ===================== document_counters =====================
alter table public.document_counters add column organization_id uuid references public.organizations(id) on delete cascade;
update public.document_counters dc set organization_id = (
  select m.organization_id from public.organization_members m where m.user_id = dc.user_id and m.role = 'owner' limit 1
) where organization_id is null;
delete from public.document_counters where organization_id is null;
alter table public.document_counters alter column organization_id set not null;
alter table public.document_counters drop constraint document_counters_pkey;
alter table public.document_counters add primary key (organization_id, type, year);
alter table public.document_counters drop column user_id;

-- ===================== issuer_profiles =====================
alter table public.issuer_profiles add column organization_id uuid references public.organizations(id) on delete cascade;
update public.issuer_profiles ip set organization_id = (
  select m.organization_id from public.organization_members m where m.user_id = ip.user_id and m.role = 'owner' limit 1
) where organization_id is null;
delete from public.issuer_profiles where organization_id is null;
alter table public.issuer_profiles alter column organization_id set not null;

drop policy issuer_profiles_owner on public.issuer_profiles;
alter table public.issuer_profiles drop constraint issuer_profiles_pkey;
alter table public.issuer_profiles add primary key (organization_id);
alter table public.issuer_profiles drop column user_id;

create policy issuer_profiles_org_read on public.issuer_profiles
  for select to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = issuer_profiles.organization_id and m.user_id = auth.uid()));
create policy issuer_profiles_org_insert on public.issuer_profiles
  for insert to authenticated
  with check (exists (select 1 from public.organization_members m where m.organization_id = issuer_profiles.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));
create policy issuer_profiles_org_update on public.issuer_profiles
  for update to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = issuer_profiles.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')))
  with check (exists (select 1 from public.organization_members m where m.organization_id = issuer_profiles.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));

-- ===================== Fonctions à réécrire pour raisonner par organisation =====================

create or replace function public.assign_document_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value int;
  prefix text;
begin
  if new.number is not null or new.status = 'draft' then
    return new;
  end if;

  if not exists (select 1 from public.document_lines where document_id = new.id) then
    raise exception 'Ajoutez au moins une ligne avant d''émettre le document.';
  end if;

  new.issue_date := current_date;
  new.year := extract(year from current_date)::int;

  insert into public.document_counters (organization_id, type, year, last_value)
  values (new.organization_id, new.type, new.year, 1)
  on conflict (organization_id, type, year)
  do update set last_value = public.document_counters.last_value + 1
  returning last_value into next_value;

  prefix := case new.type when 'quote' then 'DEV' else 'FAC' end;
  new.number := prefix || '-' || new.year || '-' || lpad(next_value::text, 4, '0');
  return new;
end;
$$;

create or replace function public.guard_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  nested boolean := pg_trigger_depth() > 1;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Un nouveau document doit être créé en brouillon.';
    end if;
    new.number := null;
    new.subtotal_cents := 0;
    new.vat_cents := 0;
    new.total_cents := 0;
    if new.source_document_id is not null and not exists (
      select 1 from public.documents s
      where s.id = new.source_document_id and s.organization_id = new.organization_id
    ) then
      raise exception 'Document source introuvable.';
    end if;
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.type is distinct from old.type
     or new.source_document_id is distinct from old.source_document_id then
    raise exception 'Ce champ n''est pas modifiable.';
  end if;
  if old.number is null and new.number is not null then
    raise exception 'Le numéro est attribué automatiquement à l''émission.';
  end if;
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'Un document émis ne peut pas redevenir brouillon.';
  end if;
  if old.status = 'draft' and new.status not in ('draft', 'sent') then
    raise exception 'Un brouillon se supprime ou s''émet, il ne s''annule pas.';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Un document annulé ne peut pas être rétabli.';
  end if;
  if new.type = 'quote' and new.status = 'paid' then
    raise exception 'Un devis ne peut pas être payé.';
  end if;
  if new.type = 'invoice' and new.status in ('accepted', 'rejected') then
    raise exception 'Une facture ne peut pas être acceptée ou refusée.';
  end if;
  if not nested then
    new.subtotal_cents := old.subtotal_cents;
    new.vat_cents := old.vat_cents;
    new.total_cents := old.total_cents;
    if new.status is distinct from old.status and (new.status = 'paid' or old.status = 'paid') then
      raise exception 'Le statut « payée » est géré automatiquement par les paiements.';
    end if;
  end if;

  if old.status <> 'draft' and (
       new.client_id is distinct from old.client_id
       or new.issue_date is distinct from old.issue_date
       or new.year is distinct from old.year
     ) then
    raise exception 'Un document émis n''est plus modifiable.';
  end if;
  return new;
end;
$$;

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
    select to_jsonb(p) - 'organization_id' - 'updated_at'
    into new.issuer_snapshot
    from public.issuer_profiles p
    where p.organization_id = new.organization_id;
  else
    new.issuer_snapshot := null;
  end if;
  return new;
end;
$$;

create or replace function public.recompute_document_totals(doc uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sub bigint;
  vat bigint;
begin
  select
    coalesce(sum(round(quantity * unit_price_cents)), 0),
    coalesce(sum(round(quantity * unit_price_cents * vat_rate / 100)), 0)
  into sub, vat
  from public.document_lines
  where document_id = doc;

  update public.documents
  set subtotal_cents = sub, vat_cents = vat, total_cents = sub + vat
  where id = doc;
end;
$$;

create or replace function public.update_draft_document(
  p_doc uuid,
  p_client uuid,
  p_due date,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  d public.documents%rowtype;
begin
  select * into d from public.documents where id = p_doc for update;
  if not found then
    raise exception 'Document introuvable.';
  end if;
  if d.status <> 'draft' then
    raise exception 'Seul un brouillon peut être modifié.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Ajoutez au moins une ligne.';
  end if;

  update public.documents
  set client_id = p_client, due_date = p_due, notes = nullif(btrim(p_notes), '')
  where id = p_doc;

  delete from public.document_lines where document_id = p_doc;

  insert into public.document_lines (document_id, organization_id, position, description, quantity, unit_price_cents, vat_rate)
  select
    p_doc,
    d.organization_id,
    (t.ord - 1)::int,
    btrim(t.l->>'description'),
    (t.l->>'quantity')::numeric,
    (t.l->>'unit_price_cents')::bigint,
    coalesce((t.l->>'vat_rate')::numeric, 20)
  from jsonb_array_elements(p_lines) with ordinality as t(l, ord);
end;
$$;

create or replace function public.convert_quote_to_invoice(p_quote uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  q public.documents%rowtype;
  new_id uuid;
begin
  select * into q from public.documents where id = p_quote for update;
  if not found then
    raise exception 'Devis introuvable.';
  end if;
  if q.type <> 'quote' or q.status <> 'accepted' then
    raise exception 'Seul un devis accepté peut être converti en facture.';
  end if;
  if exists (
    select 1 from public.documents
    where source_document_id = p_quote and status <> 'cancelled'
  ) then
    raise exception 'Ce devis a déjà été converti en facture.';
  end if;

  insert into public.documents (client_id, organization_id, type, notes, source_document_id)
  values (q.client_id, q.organization_id, 'invoice', q.notes, q.id)
  returning id into new_id;

  insert into public.document_lines (document_id, organization_id, position, description, quantity, unit_price_cents, vat_rate)
  select new_id, q.organization_id, l.position, l.description, l.quantity, l.unit_price_cents, l.vat_rate
  from public.document_lines l
  where l.document_id = p_quote
  order by l.position;

  return new_id;
end;
$$;
