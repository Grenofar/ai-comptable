-- Row Level Security : chaque utilisateur ne voit et ne modifie que ses lignes.

alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

create policy clients_owner on public.clients
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy products_owner on public.products
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy documents_owner on public.documents
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy document_lines_owner on public.document_lines
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy payments_owner on public.payments
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy expenses_owner on public.expenses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
