begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(55);

select has_table('public', 'businesses', 'businesses exists');
select has_table('public', 'business_memberships', 'business_memberships exists');
select has_table('public', 'employees', 'employees exists');
select has_table('public', 'shifts', 'shifts exists');
select has_table('public', 'vacations', 'vacations exists');
select has_table('public', 'business_settings', 'business_settings exists');
select has_table('public', 'employee_access', 'employee_access exists');
select has_index(
    'public',
    'employees',
    'employees_business_employee_number_ci_uidx',
    'employees has case-insensitive business employee-number identity protection'
);

select ok(
    (select relrowsecurity from pg_class where oid = 'public.businesses'::regclass),
    'businesses has RLS enabled'
);
select ok(
    (select relrowsecurity from pg_class where oid = 'public.business_memberships'::regclass),
    'business_memberships has RLS enabled'
);
select ok(
    (select relrowsecurity from pg_class where oid = 'public.employees'::regclass),
    'employees has RLS enabled'
);
select ok(
    (select relrowsecurity from pg_class where oid = 'public.shifts'::regclass),
    'shifts has RLS enabled'
);
select ok(
    (select relrowsecurity from pg_class where oid = 'public.vacations'::regclass),
    'vacations has RLS enabled'
);
select ok(
    (select relrowsecurity from pg_class where oid = 'public.business_settings'::regclass),
    'business_settings has RLS enabled'
);
select ok(
    (select relrowsecurity from pg_class where oid = 'public.employee_access'::regclass),
    'employee_access has RLS enabled'
);

insert into auth.users (id, aud, role, email)
values
    ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'manager-a@example.invalid'),
    ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager-b@example.invalid'),
    ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@example.invalid'),
    ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'employee-a@example.invalid'),
    ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'employee-b@example.invalid'),
    ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'employee-record@example.invalid');

insert into public.businesses (id, name)
values
    ('20000000-0000-0000-0000-000000000001', 'Business A'),
    ('20000000-0000-0000-0000-000000000002', 'Business B');

insert into public.business_memberships (business_id, auth_user_id, role)
values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'manager'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'manager');

insert into public.employees (
    id,
    business_id,
    employee_number,
    first_name,
    last_name,
    weekly_target_minutes,
    max_days_per_week,
    availability
)
values
    (
        '30000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'A-1',
        'Employee',
        'A',
        2400,
        5,
        '{"days":[1,2,3,4,5]}'
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        'B-1',
        'Employee',
        'B',
        2400,
        5,
        '{"days":[1,2,3,4,5]}'
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000001',
        'A-3',
        'Manager',
        'Employee',
        2400,
        5,
        '{"days":[1,2,3,4,5]}'
    );

update public.employees
set email = 'employee-record@example.invalid'
where id = '30000000-0000-0000-0000-000000000001';

insert into public.shifts (business_id, id, employee_id, shift_date, start_time, end_time)
values
    (
        '20000000-0000-0000-0000-000000000001',
        'shift-a',
        '30000000-0000-0000-0000-000000000001',
        '2026-10-01',
        '09:00',
        '17:00'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        'shift-b',
        '30000000-0000-0000-0000-000000000002',
        '2026-10-01',
        '09:00',
        '17:00'
    ),
    (
        '20000000-0000-0000-0000-000000000001',
        'shift-dual',
        '30000000-0000-0000-0000-000000000003',
        '2026-10-02',
        '10:00',
        '14:00'
    );

insert into public.employee_access (employee_id, business_id, auth_user_id, access_enabled)
values
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', true),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', true),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true);

insert into public.vacations (id, business_id, employee_id, start_date, end_date)
values
    (
        '40000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001',
        '2026-10-12',
        '2026-10-16'
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        '30000000-0000-0000-0000-000000000002',
        '2026-10-12',
        '2026-10-16'
    );

insert into public.business_settings (business_id, store_hours, soft_rules)
values
    (
        '20000000-0000-0000-0000-000000000001',
        '{"days":[]}',
        '{"oneWeekendOffPerMonth":false}'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '{"days":[]}',
        '{"oneWeekendOffPerMonth":false}'
    );

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
);

select is((select count(*) from public.businesses), 1::bigint, 'manager A reads only Business A');
select is((select count(*) from public.business_memberships), 1::bigint, 'manager A reads only Business A memberships');
select is((select count(*) from public.employees), 2::bigint, 'manager A reads only Business A employees');
select is((select count(*) from public.shifts), 2::bigint, 'manager A reads only Business A shifts');
select is((select count(*) from public.vacations), 1::bigint, 'manager A reads only Business A vacations');
select is((select count(*) from public.business_settings), 1::bigint, 'manager A reads only Business A settings');

select throws_ok(
    $$
        insert into public.employees (
            business_id,
            employee_number,
            first_name,
            last_name,
            weekly_target_minutes,
            max_days_per_week,
            availability
        ) values (
            '20000000-0000-0000-0000-000000000002',
            'DENIED',
            'Denied',
            'Employee',
            0,
            1,
            '{"days":[]}'
        )
    $$,
    '42501',
    null,
    'manager A cannot insert an employee into Business B'
);

select results_eq(
    $$
        update public.employees
        set first_name = 'Hidden update'
        where business_id = '20000000-0000-0000-0000-000000000002'
        returning 1
    $$,
    $$ select 1 where false $$,
    'manager A cannot update an employee in Business B'
);

select lives_ok(
    $$
        insert into public.employees (
            business_id,
            employee_number,
            first_name,
            last_name,
            weekly_target_minutes,
            max_days_per_week,
            availability
        ) values (
            '20000000-0000-0000-0000-000000000001',
            'A-2',
            'Allowed',
            'Employee',
            0,
            1,
            '{"days":[]}'
        )
    $$,
    'manager A can insert an employee into Business A'
);

select throws_ok(
    $$
        insert into public.employees (
            business_id,
            employee_number,
            first_name,
            last_name,
            weekly_target_minutes,
            max_days_per_week,
            availability
        ) values (
            '20000000-0000-0000-0000-000000000001',
            'a-2',
            'Duplicate',
            'Employee',
            0,
            1,
            '{"days":[]}'
        )
    $$,
    '23505',
    null,
    'employee numbers are unique within a business without regard to case'
);

select throws_ok(
    $$
        insert into public.shifts (
            business_id,
            id,
            employee_id,
            shift_date,
            start_time,
            end_time
        ) values (
            '20000000-0000-0000-0000-000000000001',
            'cross-business-shift',
            '30000000-0000-0000-0000-000000000002',
            '2026-10-02',
            '09:00',
            '17:00'
        )
    $$,
    '23503',
    null,
    'a shift cannot reference an employee from another business'
);

select lives_ok(
    $$
        select public.replace_business_shifts(
            '20000000-0000-0000-0000-000000000001',
            '[{
                "id":"replacement-a",
                "employee_id":"30000000-0000-0000-0000-000000000001",
                "shift_date":"2026-10-03",
                "start_time":"10:00",
                "end_time":"16:00"
            }]'::jsonb
        )
    $$,
    'manager A can atomically replace Business A shifts'
);

select is(
    (select count(*) from public.shifts where id = 'replacement-a'),
    1::bigint,
    'atomic replacement commits the planned Business A shift'
);

select throws_ok(
    $$
        select public.replace_business_shifts(
            '20000000-0000-0000-0000-000000000002',
            '[]'::jsonb
        )
    $$,
    '42501',
    null,
    'manager A cannot replace Business B shifts even with an empty collection'
);

select throws_ok(
    $$
        select public.replace_business_shifts(
            '20000000-0000-0000-0000-000000000001',
            '[{
                "id":"invalid-cross-business",
                "employee_id":"30000000-0000-0000-0000-000000000002",
                "shift_date":"2026-10-03",
                "start_time":"10:00",
                "end_time":"16:00"
            }]'::jsonb
        )
    $$,
    '23503',
    null,
    'atomic replacement preserves cross-business employee integrity'
);

select set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
);
select is((select count(*) from public.businesses), 0::bigint, 'a user without membership reads no businesses');

select set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    true
);
select is((select count(*) from public.businesses), 1::bigint, 'manager B reads only Business B');

reset role;

select throws_ok(
    $$
        insert into public.vacations (
            business_id,
            employee_id,
            start_date,
            end_date
        ) values (
            '20000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000002',
            '2026-10-19',
            '2026-10-20'
        )
    $$,
    '23503',
    null,
    'a vacation cannot reference an employee from another business even without RLS'
);

select is(
    (select pg_catalog.oidvectortypes(procedure.proargtypes)
     from pg_catalog.pg_proc procedure
     join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
     where namespace.nspname = 'public' and procedure.proname = 'get_my_schedule'),
    'integer, integer',
    'employee schedule retrieval accepts only a period and no Employee identity'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
select throws_ok(
    $$ select public.get_my_schedule(2026, 10) $$,
    '42501', null,
    'an Employee email without explicit access grants no schedule access'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select is(public.is_manager_of_business('20000000-0000-0000-0000-000000000001'), false,
    'employee access does not grant manager authorization');
select is(
    public.get_my_schedule(2026, 10) #>> '{employee,id}',
    '30000000-0000-0000-0000-000000000001',
    'employee Auth identity resolves to the intended Employee identity'
);
select is(
    public.get_my_schedule(2026, 10) #>> '{shifts,0,id}',
    'replacement-a',
    'employee reads only their own canonical schedule'
);
select is((select count(*) from public.businesses), 0::bigint,
    'employee cannot directly read businesses');
select is((select count(*) from public.employees), 0::bigint,
    'employee cannot directly read Team data');
select is((select count(*) from public.shifts), 0::bigint,
    'employee cannot directly read canonical shifts');
select is((select count(*) from public.vacations), 0::bigint,
    'employee cannot directly read vacations');
select is((select count(*) from public.business_settings), 0::bigint,
    'employee cannot directly read manager Settings');
select is((select count(*) from public.employee_access), 0::bigint,
    'employee cannot directly read employee-access records');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select is(
    public.get_my_schedule(2026, 10) #>> '{employee,id}',
    '30000000-0000-0000-0000-000000000002',
    'employee in another business resolves only to their own Employee identity'
);
select is(
    public.get_my_schedule(2026, 10) #>> '{shifts,0,id}',
    'shift-b',
    'employee in another business reads only their own business schedule'
);
select ok(
    not (public.get_my_schedule(2026, 10) ?| array['email', 'vacations', 'settings', 'employees']),
    'employee schedule projection excludes unrelated manager-facing data'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.businesses), 1::bigint,
    'manager and Employee identity retains manager authorization on manager surface');
select is(
    public.get_my_schedule(2026, 10) #>> '{employee,id}',
    '30000000-0000-0000-0000-000000000003',
    'manager and Employee identity can also use employee schedule access'
);
select lives_ok(
    $$ select public.disable_employee_access('30000000-0000-0000-0000-000000000003') $$,
    'manager can disable access for an Employee in their business'
);
select throws_ok(
    $$ select public.get_my_schedule(2026, 10) $$,
    '42501', null,
    'disabled employee access prevents schedule retrieval'
);
select throws_ok(
    $$ select public.disable_employee_access('30000000-0000-0000-0000-000000000002') $$,
    '42501', null,
    'manager cannot disable access for an Employee in another business'
);

reset role;
update public.employees set status = 'inactive'
where id = '30000000-0000-0000-0000-000000000001';
select is(
    (select access_enabled from public.employee_access where employee_id = '30000000-0000-0000-0000-000000000001'),
    false,
    'making an Employee inactive automatically disables portal access'
);
update public.employees set status = 'active'
where id = '30000000-0000-0000-0000-000000000001';
select is(
    (select access_enabled from public.employee_access where employee_id = '30000000-0000-0000-0000-000000000001'),
    false,
    'reactivating an Employee does not restore portal access'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select throws_ok(
    $$ select public.get_my_schedule(2026, 10) $$,
    '42501', null,
    'inactive-triggered access revocation prevents subsequent schedule retrieval'
);

reset role;

select * from finish();
rollback;
