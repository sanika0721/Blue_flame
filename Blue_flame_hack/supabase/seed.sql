-- Synthetic sample data. First create a demo auth user and apply migrations.
-- This file is optional: the Vite demo already includes independent local sample records.
do $$ begin
 if not exists(select 1 from auth.users) then raise exception 'Create a Supabase auth user before loading SQL seed data'; end if;
end $$;
with owner as (select id from auth.users order by created_at limit 1), tenant as (
 insert into public.distributorships(id,name) values('10000000-0000-4000-8000-000000000001','Blue Flame Demo Distributorship') on conflict(id) do update set name=excluded.name returning id
), village_names(name) as (values('Rampur'),('Kothapalli'),('Bhimnagar'),('Nandipur'),('Sonapur'))
insert into public.villages(id,tenant_id,name)
select ('20000000-0000-4000-8000-'||lpad((row_number() over())::text,12,'0'))::uuid,tenant.id,village_names.name from tenant cross join village_names
on conflict(tenant_id,name) do nothing;
insert into public.profiles(id,full_name) select id,coalesce(raw_user_meta_data->>'full_name','Blue Flame Demo Owner') from auth.users order by created_at limit 1 on conflict(id) do nothing;
insert into public.memberships(tenant_id,user_id,role)
select '10000000-0000-4000-8000-000000000001'::uuid,id,'owner'::public.member_role from auth.users order by created_at limit 1
on conflict(tenant_id,user_id) do update set role='owner',active=true;
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), data as (
 select g, (array['Rampur','Kothapalli','Bhimnagar','Nandipur','Sonapur'])[((g-1)%5)+1] as village,
 (array['Lakshmi Devi','Ravi Kumar','Meena Reddy','Suresh Patil','Anita Das','Mohan Rao','Fatima Begum','Arjun Sen','Kavita Rao','Vijay Kumar','Geeta Devi','Rahul Sen','Sita Rani','Kiran Das','Naveen Rao','Priya Patil','Hari Kumar','Asha Devi','Ramesh Reddy','Nisha Sen','Sunil Das','Pooja Rao','Farhan Ali','Leela Devi','Gopal Kumar','Mala Reddy','Raju Patil','Tara Das','Imran Ali','Uma Rao'])[((g-1)%30)+1] as full_name
 from generate_series(1,30) g
)
insert into public.customers(id,tenant_id,village_id,customer_no,full_name,mobile,address)
select ('30000000-0000-4000-8000-'||lpad(data.g::text,12,'0'))::uuid,tenant.id,v.id,'C-'||lpad((1042-data.g+1)::text,4,'0'),data.full_name,'900000'||lpad(data.g::text,4,'0'),data.village||' village, demo address'
from data cross join tenant join public.villages v on v.tenant_id=tenant.id and v.name=data.village
on conflict(tenant_id,customer_no) do nothing;
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1), data as (
 select g,('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid customer_id,
 (array['pending','assigned','delivered','delivered','requires_review','pending','delivered','assigned','delivered','pending','delivered','assigned'])[((g-1)%12)+1]::public.booking_status status
 from generate_series(1,12) g
)
insert into public.bookings(id,tenant_id,customer_id,booking_ref,status,booked_at,expected_amount,idempotency_key,created_by)
select ('40000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,tenant.id,customer_id,'BK-DEMO-'||lpad(g::text,4,'0'),status,now()-((g%7)||' days')::interval,950,('50000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,owner.id
from data cross join tenant cross join owner on conflict(tenant_id,booking_ref) do nothing;
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1)
insert into public.payments(id,tenant_id,customer_id,booking_id,amount,method,reference,verification_status,collected_by,idempotency_key)
select ('60000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,tenant.id,('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,('40000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,case when g=4 then 900 else 950 end,case when g in (2,4) then 'upi' else 'cash' end,case when g in (2,4) then 'DEMO-UPI-DUP-1' else 'DEMO-CASH-'||g end,case when g in (2,4) then 'simulated_unverified' else 'recorded' end,owner.id,('70000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid
from generate_series(1,4) g cross join tenant cross join owner on conflict(tenant_id,idempotency_key) do nothing;
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1)
insert into public.cylinder_locations(id,tenant_id,name,location_type) values
('80000000-0000-4000-8000-000000000001',(select id from tenant),'Main depot','depot'),
('80000000-0000-4000-8000-000000000002',(select id from tenant),'Store A','store') on conflict(tenant_id,name) do nothing;
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1)
insert into public.discrepancy_cases(tenant_id,category,severity,linked_records,expected_value,actual_value,explanation,status)
select tenant.id,'duplicate_payment_reference','high','[{"record":"DEMO-UPI-DUP-1"}]','{"count":1}','{"count":2}','Synthetic duplicate UPI reference for reconciliation training','open' from tenant
where not exists(select 1 from public.discrepancy_cases d where d.tenant_id=tenant.id and d.category='duplicate_payment_reference');
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1)
insert into public.deliveries(tenant_id,booking_id,worker_id,delivered_at,full_cylinders_out,empty_cylinders_in,offline_client_id)
select tenant.id,b.id,owner.id,b.booked_at+interval '1 hour',1,1,gen_random_uuid()
from public.bookings b cross join tenant cross join owner where b.tenant_id=tenant.id and b.status='delivered'
on conflict(tenant_id,booking_id) do nothing;
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1), locations as (select id,name from public.cylinder_locations where tenant_id='10000000-0000-4000-8000-000000000001')
insert into public.cylinder_movements(tenant_id,cylinder_state,source_location,destination_location,quantity,reason,responsible_user,idempotency_key,confirmed_at)
select tenant.id,'full',src.id,dst.id,24,'Synthetic demo opening transfer',owner.id,'90000000-0000-4000-8000-000000000001'::uuid,now()
from tenant cross join owner join locations src on src.name='Main depot' join locations dst on dst.name='Store A'
where not exists(select 1 from public.cylinder_movements m where m.tenant_id=tenant.id and m.reason='Synthetic demo opening transfer');
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001'), owner as (select id from auth.users order by created_at limit 1), location as (select id from public.cylinder_locations where tenant_id='10000000-0000-4000-8000-000000000001' and name='Store A')
insert into public.inventory_counts(tenant_id,location_id,full_count,empty_count,defective_count,counted_by,notes)
select tenant.id,location.id,116,42,3,owner.id,'Synthetic physical count; demo ledger discrepancy'
from tenant cross join owner cross join location
where not exists(select 1 from public.inventory_counts c where c.tenant_id=tenant.id and c.notes='Synthetic physical count; demo ledger discrepancy');
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001')
insert into public.subsidy_records(tenant_id,customer_id,eligibility_status,expected_amount,recorded_amount,source,verification_status)
select tenant.id,('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,case when g%2=0 then 'pending_processing' else 'not_verified' end,300,null,'Synthetic demo entry','not_verified'
from tenant cross join generate_series(1,6) g
where not exists(select 1 from public.subsidy_records s where s.tenant_id=tenant.id and s.customer_id=('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid);
with tenant as (select id from public.distributorships where id='10000000-0000-4000-8000-000000000001')
insert into public.disputes(tenant_id,customer_id,booking_id,category,description,status)
select tenant.id,'30000000-0000-4000-8000-000000000002'::uuid,'40000000-0000-4000-8000-000000000002'::uuid,'delivery','Synthetic demo delivery timing question','open'
from tenant where not exists(select 1 from public.disputes d where d.tenant_id=tenant.id and d.category='delivery' and d.description='Synthetic demo delivery timing question');
