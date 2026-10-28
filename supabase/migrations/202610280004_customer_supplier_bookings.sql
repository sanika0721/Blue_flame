alter type public.booking_status add value if not exists 'booked';
alter type public.booking_status add value if not exists 'accepted';
alter type public.booking_status add value if not exists 'preparing_for_dispatch';

alter table public.bookings
  add column if not exists gas_provider text not null default 'Indane'
    check (gas_provider in ('Indane', 'HP Gas', 'Bharatgas'));

drop policy bookings_create on public.bookings;
create policy bookings_create on public.bookings
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.has_tenant_role(tenant_id, array['owner','counter_staff']::public.member_role[])
      or (
        public.has_tenant_role(tenant_id, array['customer']::public.member_role[])
        and exists (
          select 1
          from public.customers c
          where c.id = customer_id
            and c.tenant_id = bookings.tenant_id
            and c.auth_user_id = auth.uid()
        )
      )
    )
  );

create or replace function public.advance_supplier_booking(p_booking uuid, p_next_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
  v_current_status text;
  v_allowed boolean := false;
begin
  select b.tenant_id, b.status::text
    into v_tenant, v_current_status
  from public.bookings b
  where b.id = p_booking
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if not public.has_tenant_role(v_tenant, array['supplier','owner']::public.member_role[]) then
    raise exception 'Supplier authorization required';
  end if;

  v_allowed := (v_current_status = 'pending' and p_next_status = 'accepted')
    or (v_current_status = 'booked' and p_next_status = 'accepted')
    or (v_current_status = 'accepted' and p_next_status = 'preparing_for_dispatch')
    or (v_current_status = 'preparing_for_dispatch' and p_next_status = 'dispatched')
    or (v_current_status = 'dispatched' and p_next_status = 'delivered');

  if not v_allowed then
    raise exception 'Invalid booking status transition: % to %', v_current_status, p_next_status;
  end if;

  update public.bookings
  set status = p_next_status::public.booking_status
  where id = p_booking and tenant_id = v_tenant;
end
$$;

revoke all on function public.advance_supplier_booking(uuid, text) from public;
grant execute on function public.advance_supplier_booking(uuid, text) to authenticated;
