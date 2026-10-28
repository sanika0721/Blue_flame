create or replace function public.has_tenant_role(p_tenant uuid,p_roles public.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = p_tenant
      and m.user_id = auth.uid()
      and m.active
      and (
        p_roles is null
        or m.role = any(p_roles)
        or (m.role = 'supplier'::public.member_role and 'owner'::public.member_role = any(p_roles))
      )
  )
$$;

alter table public.bookings
  add column if not exists expected_delivery_at timestamptz,
  add column if not exists payment_method text not null default 'cash_on_delivery'
    check (payment_method = 'cash_on_delivery');

create unique index if not exists customers_auth_user_id_unique
  on public.customers(auth_user_id)
  where auth_user_id is not null;

create or replace function public.choose_cash_on_delivery(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings b
  set payment_method = 'cash_on_delivery'
  where b.id = p_booking
    and public.has_tenant_role(b.tenant_id, array['customer']::public.member_role[])
    and exists (
      select 1
      from public.customers c
      where c.id = b.customer_id
        and c.tenant_id = b.tenant_id
        and c.auth_user_id = auth.uid()
    )
    and b.status not in ('delivered', 'cancelled');

  if not found then
    raise exception 'Booking not found or unavailable to this customer';
  end if;
end
$$;

revoke all on function public.choose_cash_on_delivery(uuid) from public;
grant execute on function public.choose_cash_on_delivery(uuid) to authenticated;

create policy profile_tenant_admin_read on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.user_id = profiles.id
        and public.has_tenant_role(m.tenant_id, array['owner']::public.member_role[])
    )
  );

drop policy memberships_read on public.memberships;
create policy memberships_read on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_tenant_role(tenant_id, array['owner']::public.member_role[])
  );

drop policy customers_access on public.customers;
create policy customers_access on public.customers
  for all to authenticated
  using (
    public.has_tenant_role(tenant_id)
    and (
      public.has_tenant_role(tenant_id, array['owner','counter_staff']::public.member_role[])
      or auth_user_id = auth.uid()
    )
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','counter_staff']::public.member_role[])
  );

drop policy villages_access on public.villages;
create policy villages_access on public.villages
  for all to authenticated
  using (
    public.has_tenant_role(tenant_id, array['owner','counter_staff','delivery_worker','storekeeper','auditor']::public.member_role[])
    or exists (
      select 1
      from public.customers c
      where c.tenant_id = villages.tenant_id
        and c.village_id = villages.id
        and c.auth_user_id = auth.uid()
    )
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','counter_staff','storekeeper']::public.member_role[])
  );

drop policy cylinder_locations_access on public.cylinder_locations;
create policy cylinder_locations_access on public.cylinder_locations
  for all to authenticated
  using (
    public.has_tenant_role(tenant_id, array['owner','counter_staff','delivery_worker','storekeeper','auditor']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','storekeeper']::public.member_role[])
  );

drop policy movements_access on public.cylinder_movements;
create policy movements_access on public.cylinder_movements
  for select to authenticated
  using (
    public.has_tenant_role(tenant_id, array['owner','storekeeper','delivery_worker','auditor']::public.member_role[])
  );

drop policy counts_access on public.inventory_counts;
create policy counts_access on public.inventory_counts
  for all to authenticated
  using (
    public.has_tenant_role(tenant_id, array['owner','storekeeper','auditor']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','storekeeper']::public.member_role[])
    and counted_by = auth.uid()
  );

drop policy discrepancies_read on public.discrepancy_cases;
create policy discrepancies_read on public.discrepancy_cases
  for select to authenticated
  using (
    public.has_tenant_role(tenant_id, array['owner','auditor']::public.member_role[])
  );
