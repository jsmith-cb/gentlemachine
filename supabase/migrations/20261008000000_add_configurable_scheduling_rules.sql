alter table public.business_settings
    rename column soft_rules to scheduling_rules;

update public.business_settings
set scheduling_rules = jsonb_build_object(
    'minimumGeneratedShiftMinutes', 120,
    'modes', jsonb_build_object(
        'contracted-hours', 'prefer',
        'opening-hours-coverage', 'prefer',
        'one-saturday-off-per-month', 'prefer'
    ),
    'preferredOrder', jsonb_build_array(
        'opening-hours-coverage',
        'contracted-hours',
        'overlapping-shifts',
        'one-saturday-off-per-month',
        'employee-preferred-hours',
        'minimize-fragmentation'
    )
);

comment on column public.business_settings.scheduling_rules is
    'Canonical SchedulingRuleSettings value; semantic validation remains in the Crew domain.';
