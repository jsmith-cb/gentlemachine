create table public.businesses (
    id uuid primary key default gen_random_uuid(),
    name text not null check (btrim(name) <> ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.business_memberships (
    business_id uuid not null references public.businesses(id) on delete cascade,
    auth_user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role = 'manager'),
    created_at timestamptz not null default now(),
    primary key (business_id, auth_user_id)
);

create table public.employees (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    employee_number text not null check (btrim(employee_number) <> ''),
    status text not null default 'active' check (status in ('active', 'inactive')),
    first_name text not null check (btrim(first_name) <> ''),
    last_name text not null check (btrim(last_name) <> ''),
    email text,
    telephone_number text,
    weekly_target_minutes integer not null check (weekly_target_minutes >= 0),
    maximum_paid_minutes_per_day integer check (
        maximum_paid_minutes_per_day >= 30
        and maximum_paid_minutes_per_day <= 8 * 60
        and maximum_paid_minutes_per_day % 30 = 0
    ),
    max_days_per_week integer not null check (max_days_per_week between 1 and 7),
    availability jsonb not null check (jsonb_typeof(availability) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (business_id, employee_number),
    unique (business_id, id)
);

create table public.shifts (
    business_id uuid not null references public.businesses(id) on delete cascade,
    id text not null check (btrim(id) <> ''),
    employee_id uuid not null,
    shift_date date not null,
    start_time time not null,
    end_time time not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (business_id, id),
    constraint shifts_employee_in_same_business_fk
        foreign key (business_id, employee_id)
        references public.employees (business_id, id)
        on delete restrict,
    constraint shifts_end_after_start_check check (end_time > start_time)
);

create table public.vacations (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    employee_id uuid not null,
    start_date date not null,
    end_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (business_id, id),
    constraint vacations_employee_in_same_business_fk
        foreign key (business_id, employee_id)
        references public.employees (business_id, id)
        on delete restrict,
    constraint vacations_date_order_check check (end_date >= start_date)
);

create table public.business_settings (
    business_id uuid primary key references public.businesses(id) on delete cascade,
    store_hours jsonb not null check (jsonb_typeof(store_hours) = 'object'),
    soft_rules jsonb not null check (jsonb_typeof(soft_rules) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index business_memberships_auth_user_id_idx
    on public.business_memberships (auth_user_id, business_id);

create index employees_business_status_idx
    on public.employees (business_id, status);

create index shifts_business_date_idx
    on public.shifts (business_id, shift_date);

create index shifts_business_employee_date_idx
    on public.shifts (business_id, employee_id, shift_date);

create index vacations_business_employee_dates_idx
    on public.vacations (business_id, employee_id, start_date, end_date);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create trigger shifts_set_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

create trigger vacations_set_updated_at
before update on public.vacations
for each row execute function public.set_updated_at();

create trigger business_settings_set_updated_at
before update on public.business_settings
for each row execute function public.set_updated_at();

create function public.is_manager_of_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.business_memberships membership
        where membership.business_id = target_business_id
          and membership.auth_user_id = (select auth.uid())
          and membership.role = 'manager'
    );
$$;

revoke all on function public.is_manager_of_business(uuid) from public;
grant execute on function public.is_manager_of_business(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.vacations enable row level security;
alter table public.business_settings enable row level security;

create policy "Managers can read their businesses"
on public.businesses
for select
to authenticated
using (public.is_manager_of_business(id));

create policy "Managers can update their businesses"
on public.businesses
for update
to authenticated
using (public.is_manager_of_business(id))
with check (public.is_manager_of_business(id));

create policy "Managers can read memberships in their businesses"
on public.business_memberships
for select
to authenticated
using (public.is_manager_of_business(business_id));

create policy "Managers can manage employees in their businesses"
on public.employees
for all
to authenticated
using (public.is_manager_of_business(business_id))
with check (public.is_manager_of_business(business_id));

create policy "Managers can manage shifts in their businesses"
on public.shifts
for all
to authenticated
using (public.is_manager_of_business(business_id))
with check (public.is_manager_of_business(business_id));

create policy "Managers can manage vacations in their businesses"
on public.vacations
for all
to authenticated
using (public.is_manager_of_business(business_id))
with check (public.is_manager_of_business(business_id));

create policy "Managers can manage settings in their businesses"
on public.business_settings
for all
to authenticated
using (public.is_manager_of_business(business_id))
with check (public.is_manager_of_business(business_id));

revoke all on table public.businesses from anon;
revoke all on table public.businesses from public;
revoke all on table public.business_memberships from anon;
revoke all on table public.business_memberships from public;
revoke all on table public.employees from anon;
revoke all on table public.employees from public;
revoke all on table public.shifts from anon;
revoke all on table public.shifts from public;
revoke all on table public.vacations from anon;
revoke all on table public.vacations from public;
revoke all on table public.business_settings from anon;
revoke all on table public.business_settings from public;

grant select, update on table public.businesses to authenticated;
grant select on table public.business_memberships to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.shifts to authenticated;
grant select, insert, update, delete on table public.vacations to authenticated;
grant select, insert, update, delete on table public.business_settings to authenticated;

comment on table public.businesses is
    'Tenant root for one PricePocket Crew business workspace.';
comment on table public.business_memberships is
    'Authorization link between Supabase Auth users and business workspaces.';
comment on column public.employees.id is
    'Immutable Crew-owned employee identity used by domain references.';
comment on column public.employees.employee_number is
    'Business-facing employee identifier; never a domain foreign key.';
comment on column public.business_settings.store_hours is
    'Canonical StoreHours value; semantic validation remains in the Crew domain.';
comment on column public.business_settings.soft_rules is
    'Canonical SoftRuleSettings value; semantic validation remains in the Crew domain.';
