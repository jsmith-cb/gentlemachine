begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(50);

select has_table('public', 'time_off_requests', 'time_off_requests exists');
select is((select pg_catalog.oidvectortypes(proargtypes) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='submit_my_time_off_request'),
    'date, date, text', 'employee submission accepts no Employee identity');

insert into auth.users (id,aud,role,email) values
('91000000-0000-0000-0000-000000000001','authenticated','authenticated','tor-manager-a@example.invalid'),
('91000000-0000-0000-0000-000000000002','authenticated','authenticated','tor-manager-b@example.invalid'),
('91000000-0000-0000-0000-000000000003','authenticated','authenticated','tor-employee-a@example.invalid'),
('91000000-0000-0000-0000-000000000004','authenticated','authenticated','tor-employee-b@example.invalid');
insert into public.businesses (id,name) values
('92000000-0000-0000-0000-000000000001','Request A'),('92000000-0000-0000-0000-000000000002','Request B');
insert into public.business_memberships values
('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','manager',now()),
('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','manager',now());
insert into public.employees (id,business_id,employee_number,status,first_name,last_name,weekly_target_minutes,max_days_per_week,availability) values
('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','A','active','Employee','A',1200,5,'{"days":[1]}'),
('93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','B','active','Employee','B',1200,5,'{"days":[1]}');
insert into public.employee_access (employee_id,business_id,auth_user_id,access_enabled) values
('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000003',true),
('93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000004',true);

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2026-11-02','2026-11-03','Family')$$,'active employee submits own request');
select is(jsonb_array_length(public.get_my_time_off_requests()),1,'employee reads own requests');
select is(public.get_my_time_off_requests()->0->>'status','pending','new request is pending');
select is((select count(*) from public.vacations),0::bigint,'pending request creates no vacation');
select is((select count(*) from public.time_off_requests),0::bigint,'employee has no direct table visibility');
select throws_ok($$insert into public.vacations (business_id,employee_id,start_date,end_date) values ('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','2026-11-02','2026-11-03')$$,'42501',null,'employee cannot create canonical vacation');
select throws_ok($$select public.decide_time_off_request((select id from public.time_off_requests limit 1),'approved',null)$$,'42501',null,'employee cannot decide requests');

select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000004',true);
select is(jsonb_array_length(public.get_my_time_off_requests()),0,'other employee cannot read request');

reset role;
update public.employee_access set access_enabled=false where employee_id='93000000-0000-0000-0000-000000000001';
set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.submit_my_time_off_request('2026-12-01','2026-12-01',null)$$,'42501',null,'disabled access cannot submit');
reset role; update public.employee_access set access_enabled=true where employee_id='93000000-0000-0000-0000-000000000001';
update public.employees set status='inactive' where id='93000000-0000-0000-0000-000000000001';
set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.submit_my_time_off_request('2026-12-01','2026-12-01',null)$$,'42501',null,'inactive employee cannot submit');
reset role; update public.employees set status='active' where id='93000000-0000-0000-0000-000000000001'; update public.employee_access set access_enabled=true where employee_id='93000000-0000-0000-0000-000000000001';

set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.time_off_requests),0::bigint,'other-business manager cannot see request');
select throws_ok($$select public.decide_time_off_request((select id from public.time_off_requests limit 1),'approved',null)$$,'42501',null,'other-business manager cannot decide request');

select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.time_off_requests),1::bigint,'authorized manager sees business request');
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests),'approved','Enjoy')$$,'manager approves pending request');
select is((select status from public.time_off_requests),'approved','approval marks request approved');
select is((select count(*) from public.vacations),1::bigint,'approval creates exactly one vacation');
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests),'approved','Enjoy')$$,'repeated approval is idempotent');
select is((select count(*) from public.vacations),1::bigint,'repeated approval creates no duplicate vacation');

reset role; update public.employee_access set access_enabled=true where employee_id='93000000-0000-0000-0000-000000000001';
set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2026-12-10','2026-12-10','Optional')$$,'employee submits second request');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests where status='pending'),'declined','Cannot approve')$$,'manager declines pending request');
select is((select count(*) from public.time_off_requests where status='declined'),1::bigint,'decline marks request declined');
select is((select count(*) from public.vacations),1::bigint,'decline creates no vacation');

set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2026-12-20','2026-12-20','Atomic')$$,'employee submits atomicity request');
reset role;
create function pg_temp.reject_test_vacation() returns trigger language plpgsql as $$begin
    if new.start_date = '2026-12-20' then raise exception 'test vacation rejection'; end if;
    return new;
end$$;
create trigger reject_test_vacation before insert on public.vacations
for each row execute function pg_temp.reject_test_vacation();
set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.decide_time_off_request((select id from public.time_off_requests where start_date='2026-12-20'),'approved',null)$$,
    'P0001','test vacation rejection','failed vacation creation fails approval');
select is((select status from public.time_off_requests where start_date='2026-12-20'),'pending','failed approval leaves request pending');
select is((select count(*) from public.vacations where start_date='2026-12-20'),0::bigint,'failed approval creates no vacation');
reset role; drop trigger reject_test_vacation on public.vacations;

set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2099-10-05','2099-10-05','Original')$$,'submits future original request');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests where start_date='2099-10-05'),'approved',null)$$,'approves future original request');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2099-10-02','2099-10-07','Replacement')$$,'submits encompassing request');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests where start_date='2099-10-02'),'approved',null)$$,'approves encompassing request');
select is((select status from public.time_off_requests where start_date='2099-10-05'),'superseded','old approved request becomes superseded');
select ok((select superseded_by_request_id = (select id from public.time_off_requests where start_date='2099-10-02') from public.time_off_requests where start_date='2099-10-05'),'superseded request points to replacement');
select is((select count(*) from public.vacations where start_date between '2099-10-01' and '2099-10-31'),1::bigint,'supersession leaves one canonical vacation');
select is((select end_date::text from public.vacations where start_date='2099-10-02'),'2099-10-07','canonical vacation uses replacement range');
select ok((select decided_at is not null and decided_by is not null from public.time_off_requests where start_date='2099-10-05'),'supersession preserves original decision metadata');
select is((select count(*) from public.time_off_requests where start_date='2099-10-05' and employee_note='Original'),1::bigint,'supersession preserves original request data');

select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2099-11-04','2099-11-06','Partial base')$$,'submits partial-overlap base');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests where start_date='2099-11-04'),'approved',null)$$,'approves partial-overlap base');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2099-11-02','2099-11-05','Partial replacement')$$,'submits partial overlap');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.decide_time_off_request((select id from public.time_off_requests where start_date='2099-11-02'),'approved',null)$$,'23514','This request conflicts with existing time off and cannot supersede it automatically.','partial overlap is rejected');
select is((select status from public.time_off_requests where start_date='2099-11-04'),'approved','partial conflict preserves original approval');
select is((select status from public.time_off_requests where start_date='2099-11-02'),'pending','partial conflict leaves new request pending');
select is((select count(*) from public.vacations where start_date='2099-11-04'),1::bigint,'partial conflict preserves canonical vacation');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.submit_my_time_off_request('2099-11-07','2099-11-08','Adjacent')$$,'submits adjacent request');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.decide_time_off_request((select id from public.time_off_requests where start_date='2099-11-07'),'approved',null)$$,'approves adjacent request independently');
select is((select count(*) from public.vacations where start_date between '2099-11-01' and '2099-11-30'),2::bigint,'adjacent requests remain separate vacations');

reset role;
select throws_ok($$insert into public.time_off_requests (business_id,employee_id,start_date,end_date) values ('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','2026-12-01','2026-12-02')$$,'23503',null,'cross-business Employee reference is rejected');
select throws_ok($$insert into public.time_off_requests (business_id,employee_id,start_date,end_date) values ('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','2026-12-02','2026-12-01')$$,'23514',null,'invalid date range is rejected');

select * from finish();
rollback;
