create table public.time_off_requests (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null,
    employee_id uuid not null,
    start_date date not null,
    end_date date not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
    employee_note text,
    manager_note text,
    decided_at timestamptz,
    decided_by uuid references auth.users(id) on delete restrict,
    vacation_id uuid references public.vacations(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint time_off_requests_employee_business_fk
        foreign key (business_id, employee_id)
        references public.employees (business_id, id) on delete restrict,
    constraint time_off_requests_date_order check (start_date <= end_date),
    constraint time_off_requests_decision_shape check (
        (status = 'pending' and decided_at is null and decided_by is null and vacation_id is null)
        or (status = 'declined' and decided_at is not null and decided_by is not null and vacation_id is null)
        or (status = 'approved' and decided_at is not null and decided_by is not null and vacation_id is not null)
    )
);

create index time_off_requests_business_status_idx
on public.time_off_requests (business_id, status, created_at);

create index time_off_requests_employee_created_idx
on public.time_off_requests (employee_id, created_at desc);

create trigger time_off_requests_set_updated_at
before update on public.time_off_requests
for each row execute function public.set_updated_at();

alter table public.time_off_requests enable row level security;

create policy "Managers can read time off requests in their businesses"
on public.time_off_requests for select to authenticated
using (public.is_manager_of_business(business_id));

revoke all on table public.time_off_requests from public, anon;
grant select on table public.time_off_requests to authenticated;

create function public.submit_my_time_off_request(
    requested_start_date date,
    requested_end_date date,
    requested_note text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare access_record record; request_id uuid;
begin
    if requested_start_date is null or requested_end_date is null or requested_start_date > requested_end_date then
        raise exception 'The requested date range is invalid.' using errcode = '22023';
    end if;
    select access.business_id, access.employee_id into access_record
    from public.employee_access access
    join public.employees employee on employee.id = access.employee_id and employee.business_id = access.business_id
    where access.auth_user_id = (select auth.uid()) and access.access_enabled and employee.status = 'active';
    if access_record.employee_id is null then
        raise exception 'Employee portal access is unavailable.' using errcode = '42501';
    end if;
    insert into public.time_off_requests (business_id, employee_id, start_date, end_date, employee_note)
    values (access_record.business_id, access_record.employee_id, requested_start_date, requested_end_date,
        nullif(btrim(requested_note), '')) returning id into request_id;
    return request_id;
end;
$$;

create function public.get_my_time_off_requests()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare access_record record;
begin
    select access.business_id, access.employee_id into access_record
    from public.employee_access access
    join public.employees employee on employee.id = access.employee_id and employee.business_id = access.business_id
    where access.auth_user_id = (select auth.uid()) and access.access_enabled and employee.status = 'active';
    if access_record.employee_id is null then
        raise exception 'Employee portal access is unavailable.' using errcode = '42501';
    end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', request.id, 'startDate', request.start_date, 'endDate', request.end_date,
        'status', request.status, 'employeeNote', request.employee_note,
        'managerNote', request.manager_note, 'createdAt', request.created_at
    ) order by request.created_at desc)
    from public.time_off_requests request
    where request.business_id = access_record.business_id
      and request.employee_id = access_record.employee_id), '[]'::jsonb);
end;
$$;

create function public.decide_time_off_request(
    target_request_id uuid,
    decision text,
    decision_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare request_record public.time_off_requests%rowtype; created_vacation_id uuid;
begin
    if decision not in ('approved', 'declined') then
        raise exception 'The decision is invalid.' using errcode = '22023';
    end if;
    select * into request_record from public.time_off_requests
    where id = target_request_id for update;
    if request_record.id is null or not public.is_manager_of_business(request_record.business_id) then
        raise exception 'Not authorized to decide this request.' using errcode = '42501';
    end if;
    if request_record.status <> 'pending' then
        if request_record.status = decision then
            return jsonb_build_object('requestId', request_record.id, 'status', request_record.status,
                'vacationId', request_record.vacation_id);
        end if;
        raise exception 'This request has already been decided.' using errcode = '23514';
    end if;
    if decision = 'approved' then
        insert into public.vacations (business_id, employee_id, start_date, end_date)
        values (request_record.business_id, request_record.employee_id,
            request_record.start_date, request_record.end_date)
        returning id into created_vacation_id;
    end if;
    update public.time_off_requests set status = decision, manager_note = nullif(btrim(decision_note), ''),
        decided_at = now(), decided_by = (select auth.uid()), vacation_id = created_vacation_id
    where id = request_record.id;
    return jsonb_build_object('requestId', request_record.id, 'status', decision,
        'vacationId', created_vacation_id);
end;
$$;

revoke all on function public.submit_my_time_off_request(date, date, text) from public;
revoke all on function public.get_my_time_off_requests() from public;
revoke all on function public.decide_time_off_request(uuid, text, text) from public;
grant execute on function public.submit_my_time_off_request(date, date, text) to authenticated;
grant execute on function public.get_my_time_off_requests() to authenticated;
grant execute on function public.decide_time_off_request(uuid, text, text) to authenticated;

comment on table public.time_off_requests is 'Employee intent; approved absence remains canonical in vacations.';
