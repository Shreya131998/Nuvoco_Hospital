-- ============================================================
-- 0004: name the vehicle-check countersign column for what it is
-- ============================================================
-- The paper form carries two names per shift: the driver (चालक) and the
-- OHC staff member countersigning (स्टाफ के हस्ताक्षर). The column was
-- called checked_by_name and never populated; the form now captures the
-- staff name into it, so rename it to match.

alter table vehicle_check rename column checked_by_name to staff_name;

-- shift_compliance() gains the staff name so the dashboard can show it.
drop function if exists shift_compliance(date, date);

create or replace function shift_compliance(p_from date, p_to date)
returns table (
  check_date    date,
  vehicle_id    uuid,
  vehicle_no    text,
  vehicle_label text,
  shift         text,
  done          boolean,
  driver_name   text,
  staff_name    text,
  failed_count  bigint,
  remarks       text
)
language sql stable as $$
  select
    d::date,
    veh.id,
    veh.vehicle_no,
    veh.label,
    sh.shift,
    (vc.id is not null),
    vc.driver_name,
    vc.staff_name,
    coalesce((select count(*) from vehicle_check_result r
              where r.check_id = vc.id and r.is_ok = false), 0),
    vc.remarks
  from generate_series(p_from, p_to, interval '1 day') d
  cross join (select id, vehicle_no, label from vehicle where active) veh
  cross join (values ('A'),('B'),('C')) as sh(shift)
  left join vehicle_check vc
    on vc.vehicle_id = veh.id
   and vc.check_date = d::date
   and vc.shift      = sh.shift
  order by d::date desc, veh.vehicle_no, sh.shift;
$$;

grant execute on function shift_compliance(date, date) to authenticated;
