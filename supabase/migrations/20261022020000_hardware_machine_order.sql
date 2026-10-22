create table public.site_hardware_machine_order (
  machine text primary key check (char_length(btrim(machine)) between 1 and 60),
  position integer not null check (position > 0)
);

alter table public.site_hardware_machine_order enable row level security;

create policy "Public can read machine order"
on public.site_hardware_machine_order for select to anon, authenticated
using (true);

create policy "Authenticated users can insert machine order"
on public.site_hardware_machine_order for insert to authenticated
with check (true);

create policy "Authenticated users can update machine order"
on public.site_hardware_machine_order for update to authenticated
using (true) with check (true);

revoke all on public.site_hardware_machine_order from anon, authenticated;
grant select on public.site_hardware_machine_order to anon, authenticated;
grant insert, update on public.site_hardware_machine_order to authenticated;

create function public.hardware_machine_order_rename()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.site_hardware_machine_order (machine, position)
  select new.machine, position from public.site_hardware_machine_order
  where machine = old.machine
  on conflict (machine) do update set position = excluded.position;
  delete from public.site_hardware_machine_order where machine = old.machine;
  return new;
end;
$$;

revoke all on function public.hardware_machine_order_rename() from public;

create trigger hardware_machine_order_rename
after update of machine on public.site_hardware_devices
for each row when (old.machine is distinct from new.machine)
execute function public.hardware_machine_order_rename();
