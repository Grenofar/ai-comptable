-- Messagerie interne : un canal de groupe automatique par organisation ("Général",
-- tous les membres y sont ajoutés/retirés automatiquement) et des conversations
-- privées à la demande entre deux membres.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('group', 'dm')),
  name text,
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_participants enable row level security;
create index on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index on public.messages (conversation_id, created_at);

create policy conversations_participant_read on public.conversations
  for select to authenticated
  using (exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conversations.id and p.user_id = auth.uid()
  ));

create policy conversation_participants_read on public.conversation_participants
  for select to authenticated
  using (exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conversation_participants.conversation_id and p.user_id = auth.uid()
  ));

create policy messages_participant_read on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
  ));

create policy messages_participant_write on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
    )
  );

-- Pas d'insertion/suppression directe de conversations ou de participants : tout passe par
-- les fonctions et triggers ci-dessous (canal de groupe automatique, get_or_create_dm).
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_participants from authenticated;

-- Retrouve (ou crée) la conversation privée entre l'utilisateur courant et un autre membre
-- de la même organisation.
create or replace function public.get_or_create_dm(p_org uuid, p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
begin
  if p_other = auth.uid() then
    raise exception 'Choisissez un autre membre.';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid()) then
    raise exception 'Vous n''êtes pas membre de cette organisation.';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org and user_id = p_other) then
    raise exception 'Ce membre ne fait pas partie de l''organisation.';
  end if;

  select c.id into conv_id
  from public.conversations c
  where c.organization_id = p_org and c.kind = 'dm'
    and exists (select 1 from public.conversation_participants p1 where p1.conversation_id = c.id and p1.user_id = auth.uid())
    and exists (select 1 from public.conversation_participants p2 where p2.conversation_id = c.id and p2.user_id = p_other)
    and (select count(*) from public.conversation_participants p3 where p3.conversation_id = c.id) = 2
  limit 1;

  if conv_id is null then
    insert into public.conversations (organization_id, kind) values (p_org, 'dm') returning id into conv_id;
    insert into public.conversation_participants (conversation_id, user_id) values (conv_id, auth.uid()), (conv_id, p_other);
  end if;

  return conv_id;
end;
$$;
revoke all on function public.get_or_create_dm(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid, uuid) to authenticated;

-- La création d'une organisation crée aussi son canal de groupe "Général".
create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  insert into public.conversations (organization_id, kind, name)
  values (new.id, 'group', 'Général');

  return new;
end;
$$;

-- Chaque nouveau membre (owner compris) est ajouté automatiquement au canal de groupe.
create or replace function public.on_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  group_conv uuid;
begin
  select id into group_conv from public.conversations
  where organization_id = new.organization_id and kind = 'group' limit 1;
  if group_conv is not null then
    insert into public.conversation_participants (conversation_id, user_id)
    values (group_conv, new.user_id)
    on conflict (conversation_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.on_member_added() from public, anon, authenticated;

create trigger organization_members_after_insert
after insert on public.organization_members
for each row execute function public.on_member_added();

-- Un membre retiré de l'organisation perd l'accès à son canal de groupe.
create or replace function public.on_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.conversation_participants cp
  using public.conversations c
  where cp.conversation_id = c.id
    and c.organization_id = old.organization_id and c.kind = 'group'
    and cp.user_id = old.user_id;
  return old;
end;
$$;
revoke all on function public.on_member_removed() from public, anon, authenticated;

create trigger organization_members_after_delete
after delete on public.organization_members
for each row execute function public.on_member_removed();
