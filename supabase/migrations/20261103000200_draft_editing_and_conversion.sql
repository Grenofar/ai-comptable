-- Édition atomique des brouillons et conversion devis -> facture.
-- Fonctions en security invoker : la RLS et les garde-fous existants s'appliquent.

-- Remplace le client, l'échéance, les notes et toutes les lignes d'un brouillon, en une transaction.
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
  select * into d from public.documents where id = p_doc and user_id = auth.uid() for update;
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

  insert into public.document_lines (document_id, position, description, quantity, unit_price_cents, vat_rate)
  select
    p_doc,
    (t.ord - 1)::int,
    btrim(t.l->>'description'),
    (t.l->>'quantity')::numeric,
    (t.l->>'unit_price_cents')::bigint,
    coalesce((t.l->>'vat_rate')::numeric, 20)
  from jsonb_array_elements(p_lines) with ordinality as t(l, ord);
end;
$$;

-- Crée une facture brouillon à partir d'un devis accepté. Une seule facture active par devis.
create or replace function public.convert_quote_to_invoice(p_quote uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  q public.documents%rowtype;
  new_id uuid;
begin
  select * into q from public.documents where id = p_quote and user_id = auth.uid() for update;
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

  insert into public.documents (client_id, type, notes, source_document_id)
  values (q.client_id, 'invoice', q.notes, q.id)
  returning id into new_id;

  insert into public.document_lines (document_id, position, description, quantity, unit_price_cents, vat_rate)
  select new_id, l.position, l.description, l.quantity, l.unit_price_cents, l.vat_rate
  from public.document_lines l
  where l.document_id = p_quote
  order by l.position;

  return new_id;
end;
$$;

revoke all on function public.update_draft_document(uuid, uuid, date, text, jsonb) from public, anon;
revoke all on function public.convert_quote_to_invoice(uuid) from public, anon;
grant execute on function public.update_draft_document(uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function public.convert_quote_to_invoice(uuid) to authenticated;