-- Profils utilisateur et organisations (espaces de travail partagés).
-- Chaque inscription crée automatiquement un profil et une organisation personnelle
-- (l'utilisateur en est "owner"). Les données métier seront ensuite rattachées à
-- une organisation plutôt qu'à un seul utilisateur (migration suivante).

-- ===================== Profils =====================

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  avatar_url text check (avatar_url is null or length(avatar_url) <= 500),
  bio text check (bio is null or length(bio) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy profiles_self on public.profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger profiles_touch
before update on public.profiles
for each row execute function public.touch_updated_at();

-- ===================== Organisations =====================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0 and length(name) <= 200),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.organization_members enable row level security;
create index on public.organization_members (user_id);

-- Un membre voit les organisations et les listes de membres dont il fait partie.
create policy organizations_member_read on public.organizations
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid()
  ));

create policy organizations_create on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

-- Renommer : owner ou admin. Supprimer : owner uniquement.
create policy organizations_admin_update on public.organizations
  for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ));

create policy organizations_owner_delete on public.organizations
  for delete to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role = 'owner'
  ));

create policy org_members_read on public.organization_members
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_members.organization_id and m.user_id = auth.uid()
  ));

-- Un membre peut quitter une organisation, sauf s'il en est l'unique owner.
create policy org_members_leave on public.organization_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    and (
      role <> 'owner'
      or (
        select count(*) from public.organization_members m2
        where m2.organization_id = organization_members.organization_id and m2.role = 'owner'
      ) > 1
    )
  );

-- Owner/admin peuvent retirer un autre membre, jamais le dernier owner.
create policy org_members_admin_remove on public.organization_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
    and (
      role <> 'owner'
      or (
        select count(*) from public.organization_members m2
        where m2.organization_id = organization_members.organization_id and m2.role = 'owner'
      ) > 1
    )
  );

-- Owner/admin peuvent changer le rôle d'un membre, sans jamais laisser l'organisation sans owner.
create policy org_members_admin_update_role on public.organization_members
  for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_members.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ))
  with check (
    role in ('owner', 'admin', 'member')
    and (
      role = 'owner'
      or exists (
        select 1 from public.organization_members m2
        where m2.organization_id = organization_members.organization_id
          and m2.role = 'owner' and m2.user_id <> organization_members.user_id
      )
    )
  );

-- Pas d'insertion directe de membres : la création d'organisation ajoute l'owner
-- automatiquement (trigger ci-dessous), et invite_member_by_email() gère les invitations.
revoke insert on public.organization_members from authenticated;

create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
revoke all on function public.add_owner_membership() from public, anon, authenticated;

create trigger organizations_after_insert
after insert on public.organizations
for each row execute function public.add_owner_membership();

-- Les membres d'une même organisation peuvent voir le nom/avatar des autres (liste de membres).
create policy profiles_orgmates_read on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m1
    join public.organization_members m2 on m2.organization_id = m1.organization_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.user_id
  ));

-- Invite un utilisateur déjà inscrit à une organisation. Réservé aux owner/admin.
create or replace function public.invite_member_by_email(p_org uuid, p_email text, p_role text default 'member')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  caller_role text;
begin
  select role into caller_role from public.organization_members
  where organization_id = p_org and user_id = auth.uid();
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Seuls les responsables de l''organisation peuvent inviter des membres.';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Rôle invalide.';
  end if;

  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then
    raise exception 'Aucun compte AI Comptable n''existe avec cet e-mail. La personne doit d''abord créer un compte, puis vous pourrez l''inviter.';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (p_org, target, p_role)
  on conflict (organization_id, user_id) do update set role = excluded.role;
end;
$$;
revoke all on function public.invite_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.invite_member_by_email(uuid, text, text) to authenticated;

-- ===================== Création automatique à l'inscription =====================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Utilisateur'));

  org_name := 'Organisation de ' || coalesce(nullif(split_part(new.email, '@', 1), ''), 'mon compte');
  -- L'ajout du membre owner est géré automatiquement par le trigger organizations_after_insert.
  insert into public.organizations (name, created_by) values (org_name, new.id) returning id into org_id;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Rattrapage pour les comptes déjà créés avant cette migration.
do $$
declare
  u record;
  org_id uuid;
  org_name text;
begin
  for u in select * from auth.users where id not in (select user_id from public.profiles) loop
    insert into public.profiles (user_id, display_name)
    values (u.id, coalesce(nullif(split_part(u.email, '@', 1), ''), 'Utilisateur'));

    org_name := 'Organisation de ' || coalesce(nullif(split_part(u.email, '@', 1), ''), 'mon compte');
    insert into public.organizations (name, created_by) values (org_name, u.id) returning id into org_id;
  end loop;
end $$;

-- ===================== Avatars (Storage) =====================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy avatars_own_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
