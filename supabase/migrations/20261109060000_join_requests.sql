-- Demandes pour rejoindre une organisation : un utilisateur saisit le nom exact d'une
-- organisation, les responsables (owner/admin) voient la demande avec la bio du
-- demandeur et l'acceptent ou la refusent.

create table public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  unique (organization_id, user_id)
);
alter table public.organization_join_requests enable row level security;
create index on public.organization_join_requests (organization_id, status);

create policy join_requests_read on public.organization_join_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(organization_id));

-- Pas d'insert/update/delete directs : tout passe par les fonctions ci-dessous (qui
-- vérifient l'identité de l'organisation par son nom, et les droits du décideur).
revoke insert, update, delete on public.organization_join_requests from authenticated;

create or replace function public.request_to_join_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org record;
begin
  select id, name into org from public.organizations where lower(trim(name)) = lower(trim(p_name)) limit 1;
  if org.id is null then
    raise exception 'Aucune organisation ne porte ce nom.';
  end if;
  if public.is_org_member(org.id) then
    raise exception 'Vous êtes déjà membre de cette organisation.';
  end if;

  insert into public.organization_join_requests (organization_id, user_id, status, decided_at, decided_by)
  values (org.id, auth.uid(), 'pending', null, null)
  on conflict (organization_id, user_id) do update
    set status = 'pending', decided_at = null, decided_by = null, created_at = now()
    where public.organization_join_requests.status <> 'pending';

  return org.id;
end;
$$;
revoke all on function public.request_to_join_organization(text) from public, anon;
grant execute on function public.request_to_join_organization(text) to authenticated;

create or replace function public.decide_join_request(p_request uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.organization_join_requests%rowtype;
begin
  select * into req from public.organization_join_requests where id = p_request for update;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if req.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;
  if not public.is_org_admin(req.organization_id) then
    raise exception 'Seuls les responsables de l''organisation peuvent traiter cette demande.';
  end if;

  update public.organization_join_requests
  set status = case when p_accept then 'accepted' else 'rejected' end, decided_at = now(), decided_by = auth.uid()
  where id = p_request;

  if p_accept then
    insert into public.organization_members (organization_id, user_id, role)
    values (req.organization_id, req.user_id, 'member')
    on conflict (organization_id, user_id) do nothing;
  end if;
end;
$$;
revoke all on function public.decide_join_request(uuid, boolean) from public, anon;
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
