create function public.replace_business_shifts(
    target_business_id uuid,
    replacement_shifts jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if not public.is_manager_of_business(target_business_id) then
        raise exception 'Not authorized for this business.'
            using errcode = '42501';
    end if;

    if jsonb_typeof(replacement_shifts) <> 'array' then
        raise exception 'replacement_shifts must be a JSON array.'
            using errcode = '22023';
    end if;

    delete from public.shifts
    where business_id = target_business_id;

    insert into public.shifts (
        business_id,
        id,
        employee_id,
        shift_date,
        start_time,
        end_time
    )
    select
        target_business_id,
        replacement.id,
        replacement.employee_id,
        replacement.shift_date,
        replacement.start_time,
        replacement.end_time
    from jsonb_to_recordset(replacement_shifts) as replacement (
        id text,
        employee_id uuid,
        shift_date date,
        start_time time,
        end_time time
    );
end;
$$;

revoke all on function public.replace_business_shifts(uuid, jsonb) from public;
grant execute on function public.replace_business_shifts(uuid, jsonb) to authenticated;

comment on function public.replace_business_shifts(uuid, jsonb) is
    'Atomically replaces one authorized business workspace shift collection.';
