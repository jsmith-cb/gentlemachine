begin; create extension if not exists pgtap with schema extensions; set local search_path=public,extensions; select plan(18);
select has_table('public','sick_reports','sick reports exists');
insert into auth.users(id,aud,role,email) values
('a1000000-0000-0000-0000-000000000001','authenticated','authenticated','sm@example.invalid'),
('a1000000-0000-0000-0000-000000000002','authenticated','authenticated','se@example.invalid'),
('a1000000-0000-0000-0000-000000000003','authenticated','authenticated','other@example.invalid');
insert into public.businesses(id,name) values('a2000000-0000-0000-0000-000000000001','Sick A'),('a2000000-0000-0000-0000-000000000002','Sick B');
insert into public.business_memberships values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','manager',now());
insert into public.employees(id,business_id,employee_number,status,first_name,last_name,weekly_target_minutes,max_days_per_week,availability) values
('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','A','active','Sick','Employee',1200,5,'{"days":[1]}'),
('a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000002','B','active','Other','Employee',1200,5,'{"days":[1]}');
insert into public.employee_access(employee_id,business_id,auth_user_id,access_enabled) values
('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',true),
('a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003',true);
set local role authenticated; select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.report_my_sickness('2026-10-05','2026-10-06','Unwell')$$,'active employee reports sickness');
select is(jsonb_array_length(public.get_my_sick_reports()),1,'employee reads own report');
select is(public.get_my_sick_reports()->0->>'status','reported','sickness is canonical before acknowledgement');
select throws_ok($$select public.report_my_sickness('2026-10-06','2026-10-07',null)$$,'23514','These dates overlap an existing sickness report.','overlap is rejected');
select lives_ok($$select public.report_my_sickness('2026-10-07','2026-10-07',null)$$,'adjacent sickness remains separate');
select is((select count(*) from public.sick_reports),0::bigint,'employee has no direct sickness table access');
select throws_ok($$select public.acknowledge_sick_report((select id from public.sick_reports limit 1))$$,'42501',null,'employee cannot acknowledge');
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
select is(jsonb_array_length(public.get_my_sick_reports()),0,'other employee sees no reports');
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.sick_reports),2::bigint,'manager sees own business reports');
select lives_ok($$select public.acknowledge_sick_report((select id from public.sick_reports order by start_date limit 1))$$,'manager acknowledges report');
select is((select status from public.sick_reports order by start_date limit 1),'acknowledged','acknowledgement records status');
select ok((select acknowledged_at is not null and acknowledged_by='a1000000-0000-0000-0000-000000000001' from public.sick_reports order by start_date limit 1),'acknowledgement records manager and time');
select lives_ok($$select public.acknowledge_sick_report((select id from public.sick_reports order by start_date limit 1))$$,'acknowledgement is idempotent');
select is((select count(*) from public.sick_reports),2::bigint,'acknowledgement creates no duplicate');
select throws_ok($$select public.acknowledge_sick_report('a4000000-0000-0000-0000-000000000001')$$,'42501',null,'unknown or cross-business report cannot be acknowledged');
reset role;
select throws_ok($$insert into public.sick_reports(business_id,employee_id,start_date,end_date)
 values('a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','2026-10-06','2026-10-08')$$,
 '23P01',null,'database constraint independently rejects overlapping sickness');
select lives_ok($$insert into public.sick_reports(business_id,employee_id,start_date,end_date)
 values('a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','2026-10-08','2026-10-09')$$,
 'database constraint allows a period adjacent to existing sickness');
select * from finish(); rollback;
