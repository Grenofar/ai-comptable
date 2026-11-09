-- Test de fumée à coller dans le SQL Editor Supabase, après toutes les migrations.
-- Tout s'exécute dans une transaction annulée à la fin (rollback) : rien n'est conservé.
-- Deux utilisateurs fictifs servent à vérifier la RLS et les garde-fous.
-- Succès : message « Tous les contrôles sont passés ». Échec : l'erreur indique le contrôle fautif.
begin;

do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  yr int := extract(year from current_date)::int;
  client_a uuid;
  doc uuid;
  inv uuid;
  tmp uuid;
  t bigint;
  s text;
  num text;
  snap jsonb;
  n int;
  failed boolean;
begin
  insert into auth.users (id, email)
  values (ua, 'smoke-a@example.test'), (ub, 'smoke-b@example.test');

  -- ===== Utilisateur A =====
  perform set_config('request.jwt.claim.sub', ua::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.clients (name) values ('Client A') returning id into client_a;
  insert into public.issuer_profiles (legal_name, siret) values ('Société A', '12345678901234');

  -- Un document ne peut pas être créé déjà émis.
  failed := false;
  begin
    insert into public.documents (client_id, type, status) values (client_a, 'quote', 'sent');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : un document a pu être créé hors brouillon'; end if;

  -- Totaux calculés par la base : 2 x 100,00 € HT à 20 % = 240,00 € TTC.
  insert into public.documents (client_id, type) values (client_a, 'quote') returning id into doc;
  insert into public.document_lines (document_id, position, description, quantity, unit_price_cents, vat_rate)
  values (doc, 0, 'Prestation', 2, 10000, 20);
  select total_cents into t from public.documents where id = doc;
  if t <> 24000 then raise exception 'ECHEC : total attendu 24000, obtenu %', t; end if;

  -- Les totaux ne se forgent pas depuis le client.
  update public.documents set total_cents = 1 where id = doc;
  select total_cents into t from public.documents where id = doc;
  if t <> 24000 then raise exception 'ECHEC : total modifiable par le client (%)', t; end if;

  -- Impossible d'émettre un document sans ligne.
  insert into public.documents (client_id, type) values (client_a, 'invoice') returning id into tmp;
  failed := false;
  begin
    update public.documents set status = 'sent' where id = tmp;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : émission possible sans ligne'; end if;
  delete from public.documents where id = tmp;

  -- Émission du devis : numéro séquentiel et mentions de l'émetteur figées.
  update public.documents set status = 'sent' where id = doc;
  select number, issuer_snapshot into num, snap from public.documents where id = doc;
  if num is distinct from 'DEV-' || yr || '-0001' then raise exception 'ECHEC : numéro devis obtenu %', num; end if;
  if snap ->> 'legal_name' is distinct from 'Société A' then raise exception 'ECHEC : mentions émetteur absentes (%)', snap; end if;

  update public.issuer_profiles set legal_name = 'Nom modifié après coup';
  select issuer_snapshot into snap from public.documents where id = doc;
  if snap ->> 'legal_name' is distinct from 'Société A' then raise exception 'ECHEC : les mentions d''un document émis ont changé'; end if;

  -- Document émis : lignes figées, suppression interdite.
  failed := false;
  begin
    update public.document_lines set quantity = 5 where document_id = doc;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : lignes d''un document émis modifiables'; end if;

  failed := false;
  begin
    delete from public.documents where id = doc;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : document numéroté supprimable'; end if;

  -- Conversion : seulement depuis un devis accepté, une seule fois.
  failed := false;
  begin
    perform public.convert_quote_to_invoice(doc);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : conversion d''un devis non accepté'; end if;

  update public.documents set status = 'accepted' where id = doc;
  inv := public.convert_quote_to_invoice(doc);
  select total_cents, status into t, s from public.documents where id = inv;
  if t <> 24000 or s <> 'draft' then raise exception 'ECHEC : facture issue du devis (total %, statut %)', t, s; end if;

  failed := false;
  begin
    perform public.convert_quote_to_invoice(doc);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : devis converti deux fois'; end if;

  -- Édition atomique du brouillon : 50,00 € à 20 % + 3 x 10,00 € à 10 % = 93,00 € TTC.
  perform public.update_draft_document(inv, client_a, null, 'Note de test',
    '[{"description":"A","quantity":1,"unit_price_cents":5000,"vat_rate":20},
      {"description":"B","quantity":3,"unit_price_cents":1000,"vat_rate":10}]'::jsonb);
  select total_cents into t from public.documents where id = inv;
  if t <> 9300 then raise exception 'ECHEC : total après édition attendu 9300, obtenu %', t; end if;

  -- Facture : émission, paiements, statut « payée » automatique.
  update public.documents set status = 'sent' where id = inv;
  select number into num from public.documents where id = inv;
  if num is distinct from 'FAC-' || yr || '-0001' then raise exception 'ECHEC : numéro facture obtenu %', num; end if;

  failed := false;
  begin
    update public.documents set status = 'paid' where id = inv;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : statut payée forgeable'; end if;

  failed := false;
  begin
    insert into public.payments (document_id, amount_cents) values (inv, 9400);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'ECHEC : paiement supérieur au reste dû accepté'; end if;

  insert into public.payments (document_id, amount_cents) values (inv, 5000);
  select status into s from public.documents where id = inv;
  if s <> 'sent' then raise exception 'ECHEC : statut % après paiement partiel', s; end if;

  insert into public.payments (document_id, amount_cents) values (inv, 4300);
  select status into s from public.documents where id = inv;
  if s <> 'paid' then raise exception 'ECHEC : statut % après paiement complet', s; end if;

  delete from public.payments where document_id = inv and amount_cents = 4300;
  select status into s from public.documents where id = inv;
  if s <> 'sent' then raise exception 'ECHEC : statut % après suppression du paiement', s; end if;
