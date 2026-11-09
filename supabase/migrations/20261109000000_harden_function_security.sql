-- Durcissement signalé par l'advisor sécurité Supabase :
-- 1. Les fonctions ci-dessous ne doivent être déclenchées que par leurs triggers,
--    jamais appelées directement via l'API REST (/rest/v1/rpc/...). Une fonction
--    déclencheur continue de s'exécuter normalement en tant que trigger même sans
--    droit EXECUTE : seul l'appel direct est bloqué.
revoke execute on function public.assign_document_number() from public, anon, authenticated;
revoke execute on function public.payments_changed() from public, anon, authenticated;
revoke execute on function public.recompute_document_totals(uuid) from public, anon, authenticated;
revoke execute on function public.snapshot_issuer() from public, anon, authenticated;
revoke execute on function public.lines_changed() from public, anon, authenticated;
revoke execute on function public.protect_numbered_documents() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.guard_document() from public, anon, authenticated;
revoke execute on function public.guard_document_lines() from public, anon, authenticated;
revoke execute on function public.guard_payment() from public, anon, authenticated;

-- 2. search_path explicite : un search_path modifié côté session ne doit pas
--    pouvoir changer quelle table/fonction "public.x" résout vers.
alter function public.protect_numbered_documents() set search_path = public;
alter function public.lines_changed() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
