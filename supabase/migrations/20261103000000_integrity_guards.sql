-- Durcissement : propriété des parents dans la RLS, garde-fous sur les documents émis,
-- les lignes et les paiements. La base fait foi pour les totaux, les numéros et les statuts.

-- 1. RLS : une ligne ne peut référencer que des parents appartenant à l'utilisateur.
drop policy documents_owner on public.documents;
drop policy document_lines_owner on public.document_lines;
drop policy payments_owner on public.payments;

create policy documents_owner on public.documents
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  );

create policy document_lines_owner on public.document_lines
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
  );

create policy payments_owner on public.payments
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
  );

-- 2. Devis -> facture : lien vers le document source, une seule facture active par devis.
alter table public.documents
  add column source_document_id uuid references public.documents(id) on delete restrict;

create unique index documents_one_invoice_per_quote
  on public.documents (source_document_id)
  where source_document_id is not null and status <> 'cancelled';

alter table public.document_lines
  add constraint document_lines_description_not_blank check (length(trim(description)) > 0);
-- 3. Garde-fous sur documents. S'exécute avant la numérotation (ordre alphabétique des triggers).
-- pg_trigger_depth() > 1 : modification déclenchée par la base (lignes, paiements), pas par le client.
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
      where s.id = new.source_document_id and s.user_id = new.user_id
    ) then
      raise exception 'Document source introuvable.';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
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
    -- Totaux et statut « payée » : uniquement recalculés par la base.
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

create trigger documents_00_guard
before insert or update on public.documents
for each row execute function public.guard_document();

-- 4. Émission : au moins une ligne, date et année d'émission = aujourd'hui, puis numéro séquentiel.
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

  insert into public.document_counters (user_id, type, year, last_value)
  values (new.user_id, new.type, new.year, 1)
  on conflict (user_id, type, year)
  do update set last_value = public.document_counters.last_value + 1
  returning last_value into next_value;

  prefix := case new.type when 'quote' then 'DEV' else 'FAC' end;
  new.number := prefix || '-' || new.year || '-' || lpad(next_value::text, 4, '0');
  return new;
end;
$$;
-- 5. Les lignes d'un document émis sont figées.
create or replace function public.guard_document_lines()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  doc_status public.document_status;
begin
  if tg_op = 'UPDATE' and new.document_id is distinct from old.document_id then
    raise exception 'Une ligne ne peut pas changer de document.';
  end if;
  select status into doc_status from public.documents where id = coalesce(new.document_id, old.document_id);
  -- Document introuvable : suppression en cascade d'un brouillon, rien à protéger.
  if found and doc_status <> 'draft' then
    raise exception 'Les lignes d''un document émis ne sont pas modifiables.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger document_lines_00_guard
before insert or update or delete on public.document_lines
for each row execute function public.guard_document_lines();

-- 6. Paiements : uniquement sur une facture émise, sans dépasser le reste dû.
create or replace function public.guard_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d public.documents%rowtype;
  already bigint;
begin
  if tg_op = 'UPDATE' and new.document_id is distinct from old.document_id then
    raise exception 'Un paiement ne peut pas changer de facture.';
  end if;
  -- Verrou sur la facture : deux paiements simultanés ne peuvent pas la dépasser ensemble.
  select * into d from public.documents where id = new.document_id for update;
  if not found then
    raise exception 'Facture introuvable.';
  end if;
  if d.type <> 'invoice' or d.status <> 'sent' then
    raise exception 'Un paiement ne s''enregistre que sur une facture émise et non soldée.';
  end if;
  select coalesce(sum(amount_cents), 0) into already
  from public.payments
  where document_id = new.document_id and (tg_op = 'INSERT' or id <> new.id);
  if already + new.amount_cents > d.total_cents then
    raise exception 'Le paiement dépasse le reste dû.';
  end if;
  return new;
end;
$$;

create trigger payments_00_guard
before insert or update on public.payments
for each row execute function public.guard_payment();
-- 7. Statut « payée » automatique, et retour à « émise » si un paiement est supprimé.
create or replace function public.payments_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  doc_id uuid := coalesce(new.document_id, old.document_id);
  paid bigint;
  doc_total bigint;
begin
  select coalesce(sum(amount_cents), 0) into paid from public.payments where document_id = doc_id;
  select total_cents into doc_total from public.documents where id = doc_id;
  if doc_total > 0 and paid >= doc_total then
    update public.documents set status = 'paid' where id = doc_id and status = 'sent';
  else
    update public.documents set status = 'sent' where id = doc_id and status = 'paid';
  end if;
  return coalesce(new, old);
end;
$$;
