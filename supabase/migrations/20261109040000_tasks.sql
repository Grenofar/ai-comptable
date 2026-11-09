-- Tâches : n'importe quel membre peut créer une tâche pour lui-même (todo personnel),
-- mais seuls owner/admin ("le chef") peuvent assigner une tâche à un autre membre.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 200),
  description text check (description is null or length(description) <= 2000),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_by uuid not null default auth.uid() references auth.users(id),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create index on public.tasks (organization_id, status);
create index on public.tasks (assigned_to);

create trigger tasks_touch
before update on public.tasks
for each row execute function public.touch_updated_at();

create policy tasks_org_read on public.tasks
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = tasks.organization_id and m.user_id = auth.uid()
  ));

-- Toute personne de l'organisation peut créer une tâche pour elle-même ; seuls owner/admin
-- peuvent l'assigner à un autre membre.
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    exists (select 1 from public.organization_members m where m.organization_id = tasks.organization_id and m.user_id = auth.uid())
    and (
      assigned_to is null or assigned_to = auth.uid()
      or exists (
        select 1 from public.organization_members m
        where m.organization_id = tasks.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
      )
    )
  );

-- Peut modifier une tâche : la personne assignée (ex. changer le statut), celle qui l'a
-- assignée, ou owner/admin.
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    assigned_to = auth.uid() or assigned_by = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = tasks.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  )
  with check (exists (
    select 1 from public.organization_members m where m.organization_id = tasks.organization_id and m.user_id = auth.uid()
  ));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    assigned_by = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = tasks.organization_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );
