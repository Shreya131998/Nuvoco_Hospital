-- ============================================================
-- Nuvoco Sonadih OHC — Paperless Checklist System
-- 0001: core schema
-- ============================================================
-- All plant dates are IST. Supabase runs UTC, so a 02:00 IST night-shift
-- entry would fall on the PREVIOUS UTC day. Every date in this system is
-- therefore derived through these helpers, never through current_date.
-- ============================================================

create extension if not exists pgcrypto;

create or replace function ist_date(ts timestamptz)
returns date language sql stable as $$
  select (ts at time zone 'Asia/Kolkata')::date
$$;

create or replace function ist_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- ------------------------------------------------------------
-- REFERENCE TABLES (seeded from the three source workbooks)
-- ------------------------------------------------------------

create table staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  mobile      text,
  role        text not null default 'first_aider'
              check (role in ('first_aider','driver','ohc_staff','doctor')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (name, role)
);

create table first_aid_box (
  id             uuid primary key default gen_random_uuid(),
  box_no         integer not null unique,
  location       text not null,
  first_aider_id uuid references staff(id) on delete set null,
  active         boolean not null default true
);

create table first_aid_item (
  id            uuid primary key default gen_random_uuid(),
  sr_no         integer not null,
  name_en       text not null,
  name_hi       text,
  spec          text,
  standard_qty  integer not null default 1,
  active        boolean not null default true
);

create table vehicle (
  id                     uuid primary key default gen_random_uuid(),
  vehicle_no             text not null unique,
  label                  text not null,
  insurance_valid_until  date,
  active                 boolean not null default true
);

create table vehicle_check_point (
  id          uuid primary key default gen_random_uuid(),
  sort_order  integer not null,
  label_hi    text not null,
  label_en    text not null,
  active      boolean not null default true
);

create table medicine (
  id          uuid primary key default gen_random_uuid(),
  sort_order  integer not null,
  category    text not null,
  name        text not null,
  unit        text,
  active      boolean not null default true,
  unique (category, name)
);

-- ------------------------------------------------------------
-- TRANSACTION TABLES
-- ------------------------------------------------------------

-- 1. FIRST AID BOX CHECK / REFILL --------------------------------
create table first_aid_check (
  id                   uuid primary key default gen_random_uuid(),
  box_id               uuid not null references first_aid_box(id) on delete cascade,
  checked_by_name      text not null,
  checked_by_staff_id  uuid references staff(id) on delete set null,
  status               text not null default 'ok'
                       check (status in ('ok','refilled','issue')),
  remarks              text,
  checked_at           timestamptz not null default now(),
  check_date           date not null default (now() at time zone 'Asia/Kolkata')::date
);

create table first_aid_check_item (
  check_id     uuid not null references first_aid_check(id) on delete cascade,
  item_id      uuid not null references first_aid_item(id) on delete cascade,
  qty_found    integer not null default 0 check (qty_found >= 0),
  qty_added    integer not null default 0 check (qty_added >= 0),
  expiry_date  date,
  is_ok        boolean not null default true,
  primary key (check_id, item_id)
);

-- 2. AMBULANCE / VEHICLE DAILY CHECK -----------------------------
create table vehicle_check (
  id                   uuid primary key default gen_random_uuid(),
  vehicle_id           uuid not null references vehicle(id) on delete cascade,
  check_date           date not null,
  shift                text not null check (shift in ('A','B','C')),
  driver_name          text not null,
  driver_staff_id      uuid references staff(id) on delete set null,
  licence_no           text,
  licence_valid_until  date,
  checked_by_name      text,
  remarks              text,
  submitted_at         timestamptz not null default now(),
  unique (vehicle_id, check_date, shift)   -- one entry per vehicle per shift per day
);

create table vehicle_check_result (
  check_id  uuid not null references vehicle_check(id) on delete cascade,
  point_id  uuid not null references vehicle_check_point(id) on delete cascade,
  is_ok     boolean not null,
  note      text,
  primary key (check_id, point_id)
);

-- 3. OHC MEDICINE MONTHLY CHECK ----------------------------------
create table medicine_check (
  id                   uuid primary key default gen_random_uuid(),
  medicine_id          uuid not null references medicine(id) on delete cascade,
  period_month         date not null,          -- always the 1st of the month
  qty                  integer check (qty >= 0),
  expiry_date          date,
  stock_state          text not null default 'in_stock'
                       check (stock_state in ('in_stock','out_of_stock')),
  checked_by_name      text not null,
  checked_by_staff_id  uuid references staff(id) on delete set null,
  doctor_verified_by   text,
  remarks              text,
  checked_at           timestamptz not null default now(),
  unique (medicine_id, period_month)          -- lets each item save independently
);

-- period_month must be the first day of a month
alter table medicine_check
  add constraint medicine_check_period_is_month_start
  check (date_trunc('month', period_month)::date = period_month);

-- ------------------------------------------------------------
-- INDEXES — every dashboard query is a date-range scan
-- ------------------------------------------------------------
create index idx_fac_checked_at   on first_aid_check (checked_at desc);
create index idx_fac_check_date   on first_aid_check (check_date desc);
create index idx_fac_box          on first_aid_check (box_id, checked_at desc);
create index idx_faci_item        on first_aid_check_item (item_id);

create index idx_vc_date          on vehicle_check (check_date desc);
create index idx_vc_submitted     on vehicle_check (submitted_at desc);
create index idx_vc_vehicle_date  on vehicle_check (vehicle_id, check_date desc);
create index idx_vcr_point        on vehicle_check_result (point_id) where is_ok = false;

create index idx_mc_checked_at    on medicine_check (checked_at desc);
create index idx_mc_period        on medicine_check (period_month desc);
create index idx_mc_expiry        on medicine_check (expiry_date) where expiry_date is not null;
