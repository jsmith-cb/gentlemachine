alter table public.time_off_requests
    drop constraint time_off_requests_status_check,
    drop constraint time_off_requests_decision_shape,
    drop constraint time_off_requests_vacation_id_fkey;

alter table public.time_off_requests
    add column superseded_at timestamptz,
    add column superseded_by_request_id uuid references public.time_off_requests(id) on delete restrict,
    add constraint time_off_requests_status_check
        check (status in ('pending', 'approved', 'declined', 'superseded')),
    add constraint time_off_requests_vacation_id_fkey
        foreign key (vacation_id) references public.vacations(id) on delete set null,
    add constraint time_off_requests_decision_shape check (
        (status = 'pending' and decided_at is null and decided_by is null
            and vacation_id is null and superseded_at is null and superseded_by_request_id is null)
        or (status = 'declined' and decided_at is not null and decided_by is not null
            and vacation_id is null and superseded_at is null and superseded_by_request_id is null)
        or (status = 'approved' and decided_at is not null and decided_by is not null
            and vacation_id is not null and superseded_at is null and superseded_by_request_id is null)
        or (status = 'superseded' and decided_at is not null and decided_by is not null
            and vacation_id is null and superseded_at is not null and superseded_by_request_id is not null)
    );

create or replace function public.get_my_time_off_requests()
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
        'managerNote', request.manager_note, 'createdAt', request.created_at,
        'supersededByRequestId', request.superseded_by_request_id
    ) order by request.created_at desc)
    from public.time_off_requests request
    where request.business_id = access_record.business_id
      and request.employee_id = access_record.employee_id), '[]'::jsonb);
end;
$$;

create or replace function public.decide_time_off_request(
    target_request_id uuid,
    decision text,
    decision_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    request_record public.time_off_requests%rowtype;
    overlapping_vacation record;
    created_vacation_id uuid;
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
        for overlapping_vacation in
            select vacation.id, vacation.start_date, vacation.end_date,
                prior_request.id as prior_request_id
            from public.vacations vacation
            left join public.time_off_requests prior_request
              on prior_request.vacation_id = vacation.id
             and prior_request.status = 'approved'
             and prior_request.business_id = vacation.business_id
             and prior_request.employee_id = vacation.employee_id
            where vacation.business_id = request_record.business_id
              and vacation.employee_id = request_record.employee_id
              and request_record.start_date <= vacation.end_date
              and vacation.start_date <= request_record.end_date
            for update of vacation
        loop
            if overlapping_vacation.start_date <= current_date
                or overlapping_vacation.prior_request_id is null
                or overlapping_vacation.start_date < request_record.start_date
                or overlapping_vacation.end_date > request_record.end_date then
                raise exception 'This request conflicts with existing time off and cannot supersede it automatically.'
                    using errcode = '23514';
            end if;
        end loop;

        update public.time_off_requests prior_request
        set status = 'superseded', vacation_id = null, superseded_at = now(),
            superseded_by_request_id = request_record.id
        where prior_request.status = 'approved'
          and prior_request.business_id = request_record.business_id
          and prior_request.employee_id = request_record.employee_id
          and prior_request.vacation_id in (
              select vacation.id from public.vacations vacation
              where vacation.business_id = request_record.business_id
                and vacation.employee_id = request_record.employee_id
                and vacation.start_date > current_date
                and request_record.start_date <= vacation.start_date
                and vacation.end_date <= request_record.end_date
          );

        delete from public.vacations vacation
        where vacation.business_id = request_record.business_id
          and vacation.employee_id = request_record.employee_id
          and vacation.start_date > current_date
          and request_record.start_date <= vacation.start_date
          and vacation.end_date <= request_record.end_date;

        insert into public.vacations (business_id, employee_id, start_date, end_date)
        values (request_record.business_id, request_record.employee_id,
            request_record.start_date, request_record.end_date)
        returning id into created_vacation_id;
    end if;

    update public.time_off_requests set status = decision,
        manager_note = nullif(btrim(decision_note), ''), decided_at = now(),
        decided_by = (select auth.uid()), vacation_id = created_vacation_id
    where id = request_record.id;
    return jsonb_build_object('requestId', request_record.id, 'status', decision,
        'vacationId', created_vacation_id);
end;
$$;
