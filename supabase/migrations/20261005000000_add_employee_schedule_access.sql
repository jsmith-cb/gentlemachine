create table public.employee_access (
    employee_id uuid primary key,
    business_id uuid not null,
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    access_enabled boolean not null default true,
    invited_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint employee_access_employee_in_same_business_fk
        foreign key (business_id, employee_id)
        references public.employees (business_id, id)
        on delete cascade
);

create index employee_access_business_id_idx
on public.employee_access (business_id, employee_id);

create trigger employee_access_set_updated_at
before update on public.employee_access
for each row execute function public.set_updated_at();

alter table public.employee_access enable row level security;

create policy "Managers can read employee access in their businesses"
on public.employee_access
for select
to authenticated
using (public.is_manager_of_business(business_id));

revoke all on table public.employee_access from public;
revoke all on table public.employee_access from anon;
grant select on table public.employee_access to authenticated;

create function public.disable_employee_access(target_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_business_id uuid;
begin
    select employee.business_id
    into target_business_id
    from public.employees employee
    where employee.id = target_employee_id;

    if target_business_id is null or not public.is_manager_of_business(target_business_id) then
        raise exception 'Not authorized to manage this employee.' using errcode = '42501';
    end if;

    update public.employee_access
    set access_enabled = false
    where employee_id = target_employee_id
      and business_id = target_business_id;
end;
$$;

revoke all on function public.disable_employee_access(uuid) from public;
grant execute on function public.disable_employee_access(uuid) to authenticated;

create function public.disable_access_for_inactive_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status = 'inactive' and old.status is distinct from new.status then
        update public.employee_access
        set access_enabled = false
        where employee_id = new.id;
    end if;
    return new;
end;
$$;

create trigger employees_disable_portal_access_when_inactive
after update of status on public.employees
for each row execute function public.disable_access_for_inactive_employee();

create function public.get_my_schedule(schedule_year integer, schedule_month integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    access_record record;
    period_start date;
    period_end date;
begin
    if schedule_year < 2000 or schedule_year > 9999 or schedule_month < 1 or schedule_month > 12 then
        raise exception 'Invalid schedule period.' using errcode = '22023';
    end if;

    select
        employee.id as employee_id,
        employee.first_name,
        employee.last_name,
        business.name as business_name
    into access_record
    from public.employee_access access
    join public.employees employee
      on employee.id = access.employee_id
     and employee.business_id = access.business_id
    join public.businesses business on business.id = access.business_id
    where access.auth_user_id = (select auth.uid())
      and access.access_enabled
      and employee.status = 'active';

    if access_record.employee_id is null then
        raise exception 'Employee schedule access is unavailable.' using errcode = '42501';
    end if;

    period_start := make_date(schedule_year, schedule_month, 1);
    period_end := (period_start + interval '1 month')::date;

    return jsonb_build_object(
        'businessName', access_record.business_name,
        'employee', jsonb_build_object(
            'id', access_record.employee_id,
            'firstName', access_record.first_name,
            'lastName', access_record.last_name
        ),
        'year', schedule_year,
        'month', schedule_month,
        'shifts', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', shift.id,
                'date', shift.shift_date,
                'start', to_char(shift.start_time, 'HH24:MI'),
                'end', to_char(shift.end_time, 'HH24:MI')
            ) order by shift.shift_date, shift.start_time, shift.id)
            from public.shifts shift
            where shift.business_id = (
                select employee.business_id
                from public.employees employee
                where employee.id = access_record.employee_id
            )
              and shift.employee_id = access_record.employee_id
              and shift.shift_date >= period_start
              and shift.shift_date < period_end
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.get_my_schedule(integer, integer) from public;
grant execute on function public.get_my_schedule(integer, integer) to authenticated;

comment on table public.employee_access is
    'Explicit portal authorization linking one Auth identity to one Crew Employee identity.';
comment on function public.get_my_schedule(integer, integer) is
    'Returns the authenticated employee own month-scoped canonical schedule projection.';
