create table public.sick_reports (
    id uuid primary key default gen_random_uuid(), business_id uuid not null,
    employee_id uuid not null, start_date date not null, end_date date not null,
    status text not null default 'reported' check (status in ('reported','acknowledged')),
    employee_note text, created_at timestamptz not null default now(),
    acknowledged_at timestamptz, acknowledged_by uuid references auth.users(id) on delete restrict,
    updated_at timestamptz not null default now(),
    constraint sick_reports_employee_business_fk foreign key (business_id,employee_id)
        references public.employees(business_id,id) on delete restrict,
    constraint sick_reports_date_order check (start_date <= end_date),
    constraint sick_reports_ack_shape check (
        (status='reported' and acknowledged_at is null and acknowledged_by is null) or
        (status='acknowledged' and acknowledged_at is not null and acknowledged_by is not null))
);
create index sick_reports_business_status_idx on public.sick_reports(business_id,status,created_at);
create index sick_reports_employee_dates_idx on public.sick_reports(employee_id,start_date,end_date);
create trigger sick_reports_set_updated_at before update on public.sick_reports
for each row execute function public.set_updated_at();
alter table public.sick_reports enable row level security;
create policy "Managers read sickness in their businesses" on public.sick_reports
for select to authenticated using (public.is_manager_of_business(business_id));
revoke all on public.sick_reports from public,anon;
grant select on public.sick_reports to authenticated;

create function public.report_my_sickness(reported_start date, reported_end date, reported_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare access_record record; report_id uuid;
begin
 if reported_start is null or reported_end is null or reported_start > reported_end then
   raise exception 'The sickness date range is invalid.' using errcode='22023'; end if;
 select access.business_id,access.employee_id into access_record from public.employee_access access
 join public.employees employee on employee.id=access.employee_id and employee.business_id=access.business_id
 where access.auth_user_id=(select auth.uid()) and access.access_enabled and employee.status='active';
 if access_record.employee_id is null then raise exception 'Employee portal access is unavailable.' using errcode='42501'; end if;
 if exists(select 1 from public.sick_reports report where report.business_id=access_record.business_id
   and report.employee_id=access_record.employee_id and reported_start<=report.end_date and report.start_date<=reported_end) then
   raise exception 'These dates overlap an existing sickness report.' using errcode='23514'; end if;
 insert into public.sick_reports(business_id,employee_id,start_date,end_date,employee_note)
 values(access_record.business_id,access_record.employee_id,reported_start,reported_end,nullif(btrim(reported_note),''))
 returning id into report_id; return report_id;
end$$;

create function public.get_my_sick_reports() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare access_record record;
begin
 select access.business_id,access.employee_id into access_record from public.employee_access access
 join public.employees employee on employee.id=access.employee_id and employee.business_id=access.business_id
 where access.auth_user_id=(select auth.uid()) and access.access_enabled and employee.status='active';
 if access_record.employee_id is null then raise exception 'Employee portal access is unavailable.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',report.id,'startDate',report.start_date,
  'endDate',report.end_date,'status',report.status,'employeeNote',report.employee_note,'createdAt',report.created_at)
  order by report.created_at desc) from public.sick_reports report
  where report.business_id=access_record.business_id and report.employee_id=access_record.employee_id),'[]'::jsonb);
end$$;

create function public.acknowledge_sick_report(target_report_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare report_record public.sick_reports%rowtype;
begin
 select * into report_record from public.sick_reports where id=target_report_id for update;
 if report_record.id is null or not public.is_manager_of_business(report_record.business_id) then
   raise exception 'Not authorized to acknowledge this sickness report.' using errcode='42501'; end if;
 if report_record.status='acknowledged' then return; end if;
 update public.sick_reports set status='acknowledged',acknowledged_at=now(),acknowledged_by=(select auth.uid())
 where id=report_record.id;
end$$;
revoke all on function public.report_my_sickness(date,date,text) from public;
revoke all on function public.get_my_sick_reports() from public;
revoke all on function public.acknowledge_sick_report(uuid) from public;
grant execute on function public.report_my_sickness(date,date,text) to authenticated;
grant execute on function public.get_my_sick_reports() to authenticated;
grant execute on function public.acknowledge_sick_report(uuid) to authenticated;
