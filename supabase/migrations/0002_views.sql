-- ============================================================
-- 0002: reporting views & functions that power the dashboard
-- ============================================================

-- ------------------------------------------------------------
-- Unified activity feed — the single source for
-- "who updated today / last 7 days / last 30 days"
-- across all three modules.
-- ------------------------------------------------------------
create or replace view v_activity as
  select
    'first_aid'::text                      as module,
    c.id                                   as record_id,
    c.checked_by_name                      as person,
    c.checked_at                           as at,
    ist_date(c.checked_at)                 as on_date,
    'Box ' || b.box_no || ' — ' || b.location as ref_label,
    c.status                               as detail,
    c.remarks                              as remarks
  from first_aid_check c
  join first_aid_box b on b.id = c.box_id

  union all

  select
    'ambulance',
    v.id,
    v.driver_name,
    v.submitted_at,
    v.check_date,   -- the shift's own day, not when it was keyed in
    veh.label || ' (' || veh.vehicle_no || ') — Shift ' || v.shift,
    'Shift ' || v.shift,
    v.remarks
  from vehicle_check v
  join vehicle veh on veh.id = v.vehicle_id

  union all

  select
    'medicine',
    m.id,
    m.checked_by_name,
    m.checked_at,
    ist_date(m.checked_at),
    med.name || ' (' || med.category || ')',
    to_char(m.period_month, 'Mon YYYY'),
    m.remarks
  from medicine_check m
  join medicine med on med.id = m.medicine_id;


-- ------------------------------------------------------------
-- Medicine stock status — expiry bucket is DERIVED, never stored.
-- A row saved as "valid" in March is wrong by December.
-- ------------------------------------------------------------
create or replace view v_medicine_status as
  with latest as (
    select distinct on (medicine_id)
      medicine_id, qty, expiry_date, stock_state,
      checked_by_name, checked_at, period_month, remarks
    from medicine_check
    order by medicine_id, period_month desc, checked_at desc
  )
  select
    med.id            as medicine_id,
    med.sort_order,
    med.category,
    med.name,
    med.unit,
    l.qty,
    l.expiry_date,
    l.stock_state,
    l.checked_by_name as last_checked_by,
    l.checked_at      as last_checked_at,
    l.period_month    as last_period,
    l.remarks,
    case
      when l.medicine_id is null                             then 'never_checked'
      when l.stock_state = 'out_of_stock'                    then 'out_of_stock'
      when l.expiry_date is null                             then 'no_expiry_recorded'
      when l.expiry_date <  ist_today()                      then 'expired'
      when l.expiry_date <= ist_today() + 30                 then 'expiring_30'
      when l.expiry_date <= ist_today() + 90                 then 'expiring_90'
      else 'valid'
    end as expiry_status,
    case when l.expiry_date is null then null
         else l.expiry_date - ist_today() end as days_to_expiry
  from medicine med
  left join latest l on l.medicine_id = med.id
  where med.active;


-- ------------------------------------------------------------
-- First aid box freshness. There is no fixed cadence, so there is
-- no "overdue" SLA — we report days since last check and let the
-- dashboard apply amber/red thresholds.
-- ------------------------------------------------------------
create or replace view v_box_status as
  with latest as (
    select distinct on (box_id)
      box_id, checked_by_name, checked_at, status, remarks
    from first_aid_check
    order by box_id, checked_at desc
  )
  select
    b.id              as box_id,
    b.box_no,
    b.location,
    s.name            as first_aider_name,
    s.mobile          as first_aider_mobile,
    l.checked_by_name as last_checked_by,
    l.checked_at      as last_checked_at,
    l.status          as last_status,
    case when l.checked_at is null then null
         else (ist_today() - ist_date(l.checked_at)) end as days_since,
    (select count(*) from first_aid_check c where c.box_id = b.id) as total_checks
  from first_aid_box b
  left join staff s on s.id = b.first_aider_id
  left join latest l on l.box_id = b.id
  where b.active;


-- ------------------------------------------------------------
-- Shift compliance grid. Cross-joins every date x vehicle x shift
-- so MISSING shifts are returned as rows, not as absent rows —
-- the whole point is seeing what was skipped.
-- ------------------------------------------------------------
create or replace function shift_compliance(p_from date, p_to date)
returns table (
  check_date   date,
  vehicle_id   uuid,
  vehicle_no   text,
  vehicle_label text,
  shift        text,
  done         boolean,
  driver_name  text,
  failed_count bigint,
  remarks      text
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


-- ------------------------------------------------------------
-- Which check points fail most often — a maintenance signal,
-- not just a compliance one.
-- ------------------------------------------------------------
create or replace function failing_points(p_from date, p_to date)
returns table (
  point_id    uuid,
  label_en    text,
  label_hi    text,
  fail_count  bigint,
  total_count bigint
)
language sql stable as $$
  select
    p.id, p.label_en, p.label_hi,
    count(*) filter (where r.is_ok = false),
    count(r.check_id)
  from vehicle_check_point p
  left join vehicle_check_result r on r.point_id = p.id
  left join vehicle_check vc on vc.id = r.check_id
                           and vc.check_date between p_from and p_to
  where p.active
  group by p.id, p.label_en, p.label_hi, p.sort_order
  having count(*) filter (where r.is_ok = false) > 0
  order by count(*) filter (where r.is_ok = false) desc, p.sort_order;
$$;


-- ------------------------------------------------------------
-- Most-refilled first aid items — drives procurement.
-- ------------------------------------------------------------
create or replace function top_refilled_items(p_from date, p_to date)
returns table (
  item_id     uuid,
  name_en     text,
  spec        text,
  total_added bigint,
  times       bigint
)
language sql stable as $$
  select
    i.id, i.name_en, i.spec,
    coalesce(sum(ci.qty_added), 0),
    count(*) filter (where ci.qty_added > 0)
  from first_aid_item i
  join first_aid_check_item ci on ci.item_id = i.id
  join first_aid_check c on c.id = ci.check_id
  where c.check_date between p_from and p_to
  group by i.id, i.name_en, i.spec, i.sr_no
  having coalesce(sum(ci.qty_added), 0) > 0
  order by coalesce(sum(ci.qty_added), 0) desc, i.sr_no;
$$;


-- ------------------------------------------------------------
-- Daily submission counts per module, for the trend bar charts.
-- Returns a continuous series so empty days render as zero
-- instead of collapsing the axis.
-- ------------------------------------------------------------
create or replace function daily_counts(p_module text, p_from date, p_to date)
returns table (day date, n bigint)
language sql stable as $$
  select d::date, coalesce(count(a.record_id), 0)
  from generate_series(p_from, p_to, interval '1 day') d
  left join v_activity a
    on a.on_date = d::date
   and a.module  = p_module
  group by d::date
  order by d::date;
$$;


-- ------------------------------------------------------------
-- Monthly medicine verification progress (mirrors the JAN..DEC
-- columns of the paper sheet): how many of the active medicines
-- were verified in each month of a given year.
-- ------------------------------------------------------------
create or replace function medicine_monthly_progress(p_year integer)
returns table (month_no integer, checked bigint, total bigint)
language sql stable as $$
  select
    m::integer,
    coalesce((select count(*) from medicine_check mc
              where mc.period_month = make_date(p_year, m::integer, 1)), 0),
    (select count(*) from medicine where active)
  from generate_series(1, 12) m
  order by m;
$$;
