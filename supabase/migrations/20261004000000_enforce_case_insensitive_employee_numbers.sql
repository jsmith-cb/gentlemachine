alter table public.employees
drop constraint employees_business_id_employee_number_key;

create unique index employees_business_employee_number_ci_uidx
on public.employees (business_id, lower(employee_number));

comment on index public.employees_business_employee_number_ci_uidx is
    'Employee numbers are unique within a business without regard to letter case.';
