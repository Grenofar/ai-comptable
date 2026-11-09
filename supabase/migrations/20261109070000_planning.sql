-- Planning partagé : un calendrier commun à toute l'organisation. N'importe quel membre peut
-- créer un événement et y ajouter d'autres membres ("ajouter qqn dans son planning"). Tous les
-- membres de l'organisation voient tous les événements (planning commun) ; les participants
-- ajoutés apparaissent sur l'événement.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 200),
  description text check (description is null or length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
alter table public.events enable row level security;
create index on public.events (organization_id, starts_at);

create table public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (event_id, user_id)
);
alter table public.event_attendees enable row level security;
create index on public.event_attendees (user_id);

-- Planning commun : tout membre de l'organisation voit tous les événements de l'organisation.
create policy events_org_read on public.events
  for select to authenticated using (public.is_org_member(organization_id));

create policy events_org_insert on public.events
  for insert to authenticated with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- Modifier/supprimer : le créateur de l'événement, ou owner/admin.
create policy events_update on public.events
  for update to authenticated
  using (created_by = auth.uid() or public.is_org_admin(organization_id))
  with check (public.is_org_member(organization_id));

create policy events_delete on public.events
  for delete to authenticated
  using (created_by = auth.uid() or public.is_org_admin(organization_id));

create policy event_attendees_read on public.event_attendees
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_attendees.event_id and public.is_org_member(e.organization_id)));

-- Le créateur de l'événement gère ses participants (ajoute n'importe quel membre de son
-- organisation) ; un membre peut aussi se retirer lui-même d'un événement.
create policy event_attendees_manage on public.event_attendees
  for insert to authenticated
  with check (exists (
    select 1 from public.events e
    where e.id = event_attendees.event_id
      and (e.created_by = auth.uid() or public.is_org_admin(e.organization_id))
      and public.is_org_member(e.organization_id)
  ));

create policy event_attendees_remove on public.event_attendees
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_attendees.event_id and (e.created_by = auth.uid() or public.is_org_admin(e.organization_id))
    )
  );
