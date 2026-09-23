-- ============================================================
-- 0003: Row Level Security
-- ============================================================
-- The three field forms are PUBLIC (no login), so the anon role is
-- reachable by anyone with the URL. Therefore:
--
--   anon           -> SELECT on reference data ONLY (to render forms).
--                     No read of anybody's submissions. No writes at all.
--   authenticated  -> full SELECT (the admin dashboard).
--   service_role   -> bypasses RLS; used ONLY by server-side API routes,
--                     which are the single writer into this database.
--
-- Writes deliberately do NOT go through anon. The medicine form upserts
-- row-by-row, which would require granting anon UPDATE — and that would
-- let anyone overwrite anyone else's entries. Routing writes through the
-- server keeps anon read-only while still allowing partial saves.
-- ============================================================

alter table staff                 enable row level security;
alter table first_aid_box         enable row level security;
alter table first_aid_item        enable row level security;
alter table vehicle               enable row level security;
alter table vehicle_check_point   enable row level security;
alter table medicine              enable row level security;
alter table first_aid_check       enable row level security;
alter table first_aid_check_item  enable row level security;
alter table vehicle_check         enable row level security;
alter table vehicle_check_result  enable row level security;
alter table medicine_check        enable row level security;

-- Start from zero rather than trusting Supabase's default grants.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ------------------------------------------------------------
-- Reference data readable by the public forms
-- ------------------------------------------------------------
grant select on first_aid_item, vehicle, vehicle_check_point, medicine
  to anon, authenticated;

create policy ref_read_item   on first_aid_item
  for select to anon, authenticated using (active);
create policy ref_read_veh    on vehicle
  for select to anon, authenticated using (active);
create policy ref_read_point  on vehicle_check_point
  for select to anon, authenticated using (active);
create policy ref_read_med    on medicine
  for select to anon, authenticated using (active);

-- ------------------------------------------------------------
-- staff + first_aid_box are NOT exposed directly to anon:
-- staff.mobile is personal data and must not be readable from a
-- public form. anon reads these through narrowed views instead.
-- These two views are intentionally left SECURITY DEFINER (the
-- default) so they bypass RLS while exposing only safe columns.
-- ------------------------------------------------------------
create or replace view v_staff_public as
  select id, name, role from staff where active order by name;

create or replace view v_box_public as
  select b.id, b.box_no, b.location, s.name as first_aider_name
  from first_aid_box b
  left join staff s on s.id = b.first_aider_id
  where b.active
  order by b.box_no;

grant select on v_staff_public, v_box_public to anon, authenticated;

-- Admin still gets the full tables, mobile numbers included.
create policy admin_read_staff on staff
  for select to authenticated using (true);
create policy admin_read_box   on first_aid_box
  for select to authenticated using (true);
grant select on staff, first_aid_box to authenticated;

-- ------------------------------------------------------------
-- Submissions: readable by the admin only. anon gets no policy,
-- which means anon reads zero rows even via a view.
-- ------------------------------------------------------------
create policy admin_read_fac    on first_aid_check
  for select to authenticated using (true);
create policy admin_read_faci   on first_aid_check_item
  for select to authenticated using (true);
create policy admin_read_vc     on vehicle_check
  for select to authenticated using (true);
create policy admin_read_vcr    on vehicle_check_result
  for select to authenticated using (true);
create policy admin_read_mc     on medicine_check
  for select to authenticated using (true);

grant select on first_aid_check, first_aid_check_item,
                vehicle_check, vehicle_check_result, medicine_check
  to authenticated;

-- ------------------------------------------------------------
-- Dashboard views run as the CALLER so the policies above apply.
-- Without security_invoker these would run as the owner and leak
-- every submission to anyone granted the view.
-- ------------------------------------------------------------
alter view v_activity        set (security_invoker = on);
alter view v_medicine_status set (security_invoker = on);
alter view v_box_status      set (security_invoker = on);

grant select on v_activity, v_medicine_status, v_box_status to authenticated;

-- Reporting functions: admin only.
grant execute on function shift_compliance(date, date)          to authenticated;
grant execute on function failing_points(date, date)            to authenticated;
grant execute on function top_refilled_items(date, date)        to authenticated;
grant execute on function daily_counts(text, date, date)        to authenticated;
grant execute on function medicine_monthly_progress(integer)    to authenticated;
grant execute on function ist_date(timestamptz)                 to anon, authenticated;
grant execute on function ist_today()                           to anon, authenticated;

-- ------------------------------------------------------------
-- Names already used on submitted forms. Because the forms are open,
-- somebody not on the staff register types their name once via "Other";
-- surfacing it here means the next person picks it from the list instead
-- of retyping a variant. Exposes names only — no submission data — and is
-- intentionally SECURITY DEFINER so anon can read it.
-- ------------------------------------------------------------
create or replace view v_known_names as
  select distinct btrim(name) as name from (
    select checked_by_name as name from first_aid_check
    union all select driver_name     from vehicle_check
    union all select checked_by_name from medicine_check
  ) t
  where name is not null and btrim(name) <> ''
  order by 1;

grant select on v_known_names to anon, authenticated;
