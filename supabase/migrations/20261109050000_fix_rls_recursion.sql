-- BUG CRITIQUE : les policies RLS qui font un sous-select sur organization_members
-- depuis une policy d'organization_members (ou depuis profiles/conversation_participants
-- sur elles-mêmes) déclenchent "infinite recursion detected in policy for relation" :
-- évaluer la policy ré-applique la RLS sur la table elle-même, qui ré-applique la policy...
-- Comme organization_members est référencée par presque toutes les autres tables, cette
-- erreur cassait tout le site (clients, documents, profils, organisations...).
--
-- Correctif standard : des fonctions SECURITY DEFINER (qui contournent la RLS) pour faire
-- les vérifications d'appartenance, utilisées par toutes les policies à la place des
-- sous-requêtes directes.

create or replace function public.is_org_member(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.organization_members m where m.organization_id = p_org and m.user_id = p_user);
$$;

create or replace function public.is_org_admin(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = p_user and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = p_user and m.role = 'owner'
  );
$$;

create or replace function public.org_owner_count(p_org uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from public.organization_members where organization_id = p_org and role = 'owner';
$$;

create or replace function public.org_has_other_owner(p_org uuid, p_excluding uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m2
    where m2.organization_id = p_org and m2.role = 'owner' and m2.user_id <> p_excluding
  );
$$;

create or replace function public.shares_org_with(p_other uuid, p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m1
    join public.organization_members m2 on m2.organization_id = m1.organization_id
    where m1.user_id = p_user and m2.user_id = p_other
  );
$$;

create or replace function public.is_conversation_participant(p_conv uuid, p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.conversation_participants p where p.conversation_id = p_conv and p.user_id = p_user);
$$;

revoke all on function public.is_org_member(uuid, uuid) from public, anon;
revoke all on function public.is_org_admin(uuid, uuid) from public, anon;
revoke all on function public.is_org_owner(uuid, uuid) from public, anon;
revoke all on function public.org_owner_count(uuid) from public, anon;
revoke all on function public.org_has_other_owner(uuid, uuid) from public, anon;
revoke all on function public.shares_org_with(uuid, uuid) from public, anon;
revoke all on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.is_org_admin(uuid, uuid) to authenticated;
grant execute on function public.is_org_owner(uuid, uuid) to authenticated;
grant execute on function public.org_owner_count(uuid) to authenticated;
grant execute on function public.org_has_other_owner(uuid, uuid) to authenticated;
grant execute on function public.shares_org_with(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

-- ===================== organizations =====================
drop policy organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select to authenticated using (public.is_org_member(id));

drop policy organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));

drop policy organizations_owner_delete on public.organizations;
create policy organizations_owner_delete on public.organizations
  for delete to authenticated using (public.is_org_owner(id));

-- ===================== organization_members =====================
drop policy org_members_read on public.organization_members;
create policy org_members_read on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));

drop policy org_members_leave on public.organization_members;
create policy org_members_leave on public.organization_members
  for delete to authenticated
  using (user_id = auth.uid() and (role <> 'owner' or public.org_owner_count(organization_id) > 1));

drop policy org_members_admin_remove on public.organization_members;
create policy org_members_admin_remove on public.organization_members
  for delete to authenticated
  using (
    public.is_org_admin(organization_id)
    and (role <> 'owner' or public.org_owner_count(organization_id) > 1)
  );

drop policy org_members_admin_update_role on public.organization_members;
create policy org_members_admin_update_role on public.organization_members
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (
    role in ('owner', 'admin', 'member')
    and (role = 'owner' or public.org_has_other_owner(organization_id, user_id))
  );

-- ===================== profiles =====================
drop policy profiles_orgmates_read on public.profiles;
create policy profiles_orgmates_read on public.profiles
  for select to authenticated using (public.shares_org_with(user_id));

-- ===================== clients / products / expenses =====================
drop policy clients_org_member on public.clients;
create policy clients_org_member on public.clients
  for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy products_org_member on public.products;
create policy products_org_member on public.products
  for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy expenses_org_member on public.expenses;
create policy expenses_org_member on public.expenses
  for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

-- ===================== documents / document_lines / payments =====================
drop policy documents_org_member on public.documents;
create policy documents_org_member on public.documents
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.clients c where c.id = documents.client_id and c.organization_id = documents.organization_id)
  );

drop policy document_lines_org_member on public.document_lines;
create policy document_lines_org_member on public.document_lines
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.documents d where d.id = document_lines.document_id and d.organization_id = document_lines.organization_id)
  );

drop policy payments_org_member on public.payments;
create policy payments_org_member on public.payments
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.documents d where d.id = payments.document_id and d.organization_id = payments.organization_id)
  );

-- ===================== issuer_profiles =====================
drop policy issuer_profiles_org_read on public.issuer_profiles;
create policy issuer_profiles_org_read on public.issuer_profiles
  for select to authenticated using (public.is_org_member(organization_id));

drop policy issuer_profiles_org_insert on public.issuer_profiles;
create policy issuer_profiles_org_insert on public.issuer_profiles
  for insert to authenticated with check (public.is_org_admin(organization_id));

drop policy issuer_profiles_org_update on public.issuer_profiles;
create policy issuer_profiles_org_update on public.issuer_profiles
  for update to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

-- ===================== tasks =====================
drop policy tasks_org_read on public.tasks;
create policy tasks_org_read on public.tasks
  for select to authenticated using (public.is_org_member(organization_id));

drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (assigned_to is null or assigned_to = auth.uid() or public.is_org_admin(organization_id))
  );

drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (assigned_to = auth.uid() or assigned_by = auth.uid() or public.is_org_admin(organization_id))
  with check (public.is_org_member(organization_id));

drop policy tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (assigned_by = auth.uid() or public.is_org_admin(organization_id));

-- ===================== conversations / conversation_participants / messages =====================
drop policy conversations_participant_read on public.conversations;
create policy conversations_participant_read on public.conversations
  for select to authenticated using (public.is_conversation_participant(id));

drop policy conversation_participants_read on public.conversation_participants;
create policy conversation_participants_read on public.conversation_participants
  for select to authenticated using (public.is_conversation_participant(conversation_id));

drop policy messages_participant_read on public.messages;
create policy messages_participant_read on public.messages
  for select to authenticated using (public.is_conversation_participant(conversation_id));

drop policy messages_participant_write on public.messages;
create policy messages_participant_write on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

-- ===================== Rattrapage : organisations créées avant la messagerie =====================
-- (ex. avant l'ajout du canal de groupe automatique) n'ont pas de conversation "Général".
do $$
declare
  org record;
  conv_id uuid;
begin
  for org in
    select o.id from public.organizations o
    where not exists (select 1 from public.conversations c where c.organization_id = o.id and c.kind = 'group')
  loop
    insert into public.conversations (organization_id, kind, name) values (org.id, 'group', 'Général') returning id into conv_id;
    insert into public.conversation_participants (conversation_id, user_id)
    select conv_id, m.user_id from public.organization_members m where m.organization_id = org.id
    on conflict (conversation_id, user_id) do nothing;
  end loop;
end $$;
