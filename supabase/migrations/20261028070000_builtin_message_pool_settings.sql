alter table public.site_message_pools
  drop constraint site_message_pools_id_check,
  drop constraint site_message_pools_schedule_check,
  drop constraint site_message_pools_check,
  drop constraint site_message_pools_check1,
  alter column starts_on drop not null,
  alter column ends_on drop not null;

alter table public.site_message_pools
  add constraint site_message_pools_id_check check (
    id ~ '^custom-[a-z0-9-]{1,70}$' or id = any(array[
      'new-year', 'christmas', 'halloween', 'birthday', 'valentines',
      'st-patricks', 'easter', 'earth-day', 'independence-day', 'pi-day',
      'april-fools', '404-day', 'may-fourth', 'leap-day', 'thanksgiving', 'friday-the-13th'
    ])
  ),
  add constraint site_message_pools_schedule_check check (schedule in ('automatic', 'annual', 'once')),
  add constraint site_message_pools_dates_check check (
    (schedule = 'automatic' and id not like 'custom-%' and starts_on is null and ends_on is null)
    or (
      schedule in ('annual', 'once') and starts_on is not null and ends_on is not null
      and starts_on between date '1000-01-01' and date '9999-12-31'
      and ends_on between date '1000-01-01' and date '9999-12-31'
      and (schedule = 'annual' or ends_on >= starts_on)
    )
  );

-- Disabled built-in overrides must be readable so visitors suppress the bundled rule.
-- Disabled custom pools remain private, including their messages through the existing RLS.
alter policy "Public can read enabled message pools" on public.site_message_pools
  using (enabled or id not like 'custom-%');
