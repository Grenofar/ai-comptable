-- Numérotation séquentielle par utilisateur, type et année, sans trou.

create table public.document_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.document_type not null,
  year int not null,
  last_value int not null default 0,
  primary key (user_id, type, year)
);
alter table public.document_counters enable row level security;
-- Aucune policy : compteur accessible uniquement via fonctions security definer.

-- Le numéro est attribué à l'émission (hors brouillon), jamais avant :
-- pas de trou lié aux brouillons supprimés.
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

create trigger documents_assign_number
before insert or update of status on public.documents
for each row execute function public.assign_document_number();

create or replace function public.protect_numbered_documents()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.number is not null then
    raise exception 'Un document numéroté ne peut pas être supprimé, annulez-le.';
  end if;
  if tg_op = 'UPDATE' and old.number is not null and new.number is distinct from old.number then
    raise exception 'Le numéro d''un document ne peut pas être modifié.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger documents_protect_numbered
before update or delete on public.documents
for each row execute function public.protect_numbered_documents();

-- Totaux recalculés côté serveur à partir des lignes.
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
  where id = doc and user_id = auth.uid();
end;
$$;

create or replace function public.lines_changed()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_document_totals(coalesce(new.document_id, old.document_id));
  return coalesce(new, old);
end;
$$;

create trigger document_lines_totals
after insert or update or delete on public.document_lines
for each row execute function public.lines_changed();

-- Statut "paid" automatique quand les paiements couvrent le total d'une facture.
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
  if paid >= doc_total and doc_total > 0 then
    update public.documents set status = 'paid' where id = doc_id and status in ('sent', 'accepted');
  end if;
  return coalesce(new, old);
end;
$$;

create trigger payments_update_status
after insert or update or delete on public.payments
for each row execute function public.payments_changed();
