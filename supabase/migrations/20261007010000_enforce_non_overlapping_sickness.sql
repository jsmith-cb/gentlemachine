create extension if not exists btree_gist with schema extensions;

alter table public.sick_reports
add constraint sick_reports_employee_date_range_exclusion
exclude using gist (
    business_id with =,
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
);

comment on constraint sick_reports_employee_date_range_exclusion on public.sick_reports is
    'Prevents overlapping canonical sickness periods for one Employee; adjacent periods remain valid.';
