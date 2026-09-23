# Nuvoco Sonadih OHC — Paperless Checklist System

Replaces three paper/Excel registers at the Occupational Health Centre with
mobile forms and an admin dashboard.

| Register | What it holds | Cadence |
|---|---|---|
| **First Aid Boxes** | 41 boxes across the plant, each with an assigned first aider and a 17-item standard kit | No fixed schedule |
| **Ambulance / Vehicle** | 23 bilingual check points, driver details, remarks | Daily, 3 shifts (A/B/C) |
| **OHC Medicines** | 99 items in 12 categories, with quantity and expiry | Monthly + live expiry alerts |

Running cost: **₹0/month**.

---

## Two backends, one switch

```
DATA_BACKEND=sheets     # Google Sheets  (current)
DATA_BACKEND=supabase   # Postgres       (fallback)
```

Both implement the same interface (`lib/data/contract.ts`). Nothing under
`app/` knows which is in use, so moving between them is this one env var —
the data does not migrate itself, but no code changes.

Use **Sheets** while volumes are small and you want the records visible in a
spreadsheet. Move to **Postgres** if you hit the limits listed under
*When to switch* below.

---

## Google Sheets setup

### 1. Create the spreadsheet

A new blank Google Sheet. From its URL, copy the id:

```
https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
```

### 2. Create a service account (free)

The app writes as a robot account, not as you.

1. <https://console.cloud.google.com/> → create a project (any name).
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it anything; no roles needed.
4. Open the service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. It contains `client_email` and `private_key`.
5. **Share the spreadsheet** with the `client_email` address, as **Editor**.
   This step is what grants access — skipping it causes a 403.

### 3. Configure

```bash
cp .env.example .env.local
```

| Variable | Value |
|---|---|
| `GOOGLE_SHEETS_ID` | the id from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON — one line, `\n` escapes intact, in double quotes |
| `ADMIN_PASSWORD` | the OHC admin password, **in double quotes** |
| `AUTH_SECRET` | any random 16+ character string |

> **Gotcha that will cost you an hour:** in a `.env` file, `#` starts a
> comment. `ADMIN_PASSWORD=Secret#2026` silently becomes `Secret`. Quote it.

### 4. Build the tabs

```bash
npm run sheet:init
```

Creates the three registers plus the five hidden master tabs, filling the
masters from `data/source/*.xlsx` — 41 boxes, 17 kit items, 23 check points,
99 medicines, 1 vehicle. Safe to re-run: master tabs are rewritten, the three
registers are never cleared.

To wipe test entries before go-live (headers and masters kept):

```bash
npm run sheet:clear
```

### 5. Set the real ambulance

The source sheet left the registration blank, so a placeholder is written.
Right-click a tab → **Unhide** → `_vehicles`, change `CG-00-0000` to the real
number and fill `insurance_valid_until`. Add a row per extra vehicle (any
unique text works as the `id`). Cached for 5 minutes.

### 6. Run

```bash
npm install && npm run dev
```

---

## How the sheet is laid out

**Three visible tabs**, one per register, mirroring your three workbooks. Each
is a running log — one row per entry, appended at the bottom.

| Tab | One row = | Columns |
|---|---|---|
| **First Aid Kit** | one box check | 11 details, then *found* / *added* per kit item (45) |
| **Ambulance Check** | one shift | 11 details (incl. driver + staff name), then one ✓/✗ column per check point, then `issues` (35) |
| **Medicine Check** | one monthly check | 7 details, then *qty* / *expiry* per medicine (205) |

Five further tabs are **hidden** — `_boxes`, `_items`, `_points`,
`_medicines`, `_vehicles`. They hold the master lists the forms need. To
change a box location, add a medicine or set the real vehicle number:
right-click any tab → **Unhide**, edit, hide again. Changes appear within
5 minutes.

There is no staff list: **people type their own name** on every form.

### Editing the sheet by hand

- Adding rows at the bottom of a register is always safe.
- Do **not** rename or reorder the check columns. The app matches them by
  their leading number (`19. टायर कंडीशन / Tyre Condition`).
- Adding a kit item or check point means adding a row to the hidden master
  *and* the matching column(s) to the register.

## Design decisions worth knowing

**Writes are append-only.** Updating a row means read-then-write on a row
index, which races when two shifts submit at the same moment. Appending never
races. Duplicates are resolved on read instead — *latest wins* per
`(vehicle, date, shift)` and per `(medicine, month)`. A side benefit: the
medicine tab keeps every revision, which the database upsert would overwrite.

**Reads are batched and cached.** Sheets allows ~60 reads/minute/user, and one
dashboard page touches several tabs. All tabs are fetched in a single
`batchGet`, reference data cached 5 minutes, submissions 10 seconds (cleared
immediately after any write).

**Dates are IST, never UTC.** A 02:00 IST night-shift entry falls on the
*previous* UTC day; filing C-shift checks against the wrong date would make
shift compliance look broken. Everything goes through `lib/dates.ts`.

**The forms are open; the sheet is not.** The service-account key is
server-only — the browser never receives it, and every write goes through
`/api/submit/*` with validation. Do not make the spreadsheet public.

**Names are typed, not picked.** The plant asked for free text over a staff
dropdown. Entries are trimmed and inner spaces collapsed, so
`"ramesh   kumar "` and `"ramesh kumar"` group together — but spelling and
initials are not guessed at, so `R. Verma` and `Ramesh Verma` still count as
two people on the dashboard.

**Expiry status is computed, never stored.** A row saved as "valid" in March
is wrong by December.

**All three registers submit as one row.** The medicine check writes a single
row per month with all 99 medicines across the columns, in sequence — pressed
once, at the end. Re-submitting the same month is a correction: values are
**merged per medicine**, so amending one item does not wipe the rest, and both
submissions stay in the sheet as an audit trail.

**First aid has no overdue state.** Confirmed with the plant: no fixed
inspection cadence, so nothing can be "late". The dashboard reports *days
since last check* with advisory thresholds (amber 30d, red 90d).

**The UI is built for a phone first.** Field forms are laid out for 320px up;
admin tables become one labelled card per row below the `sm` breakpoint,
because five columns on a phone hides the last two off-screen. Cards carry
`min-w-0` — without it a grid item defaults to `min-width:auto` and refuses to
shrink below its content, silently widening the whole page.

**Chart colours are validated, not chosen by eye.** The palette passed a
colour-blindness and contrast check against this app's own surfaces.

---

## When to switch to Postgres

Sheets is fine here for a long time, but these are the real limits:

| Signal | Why it matters |
|---|---|
| **Two people submitting the same shift within a second** | No unique constraint. Both rows land; the dashboard shows the later one. Rare, and it self-heals, but the sheet holds a superseded row. |
| **Dashboard feels slow** | Every aggregation reads whole tabs and computes in memory. Fine for thousands of rows, not tens of thousands. |
| **`429` errors** | Sheets quota is ~60 reads/minute/user. Caching covers normal use; many admins refreshing at once could trip it. |
| **Anyone edits the sheet by hand** | There is no schema. A deleted header row or a renamed column breaks reads. |
| **You want per-person admin accounts** | Current login is one shared password. |

Switching: set `DATA_BACKEND=supabase`, fill the Supabase variables, run
`supabase/migrations/0001→0003` then `supabase/seed.sql`. Export the Sheets
data first (`/admin/export`) — the backends do not share storage.

---

## Layout

```
app/
  page.tsx                  three module tiles (public landing)
  first-aid/ ambulance/ medicine/   the field forms — no login
  admin/(dash)/             dashboard: overview, 3 modules, export
  admin/login/              shared-password login
  api/submit/*              the ONLY writers
  api/admin/*               login / logout
  api/export/               .xlsx generator (auth-checked)
lib/
  data/contract.ts          the interface both backends implement
  data/sheets*.ts           Google Sheets backend
  data/supabase-backend.ts  Postgres backend
  auth.ts                   signed-cookie admin session
  dates.ts                  everything IST
scripts/
  parse-workbooks.mjs       reads data/source/*.xlsx
  init-sheet.mjs            builds + fills the Google Sheet
  clear-submissions.mjs     empties the three registers, keeps headers
  parse-xlsx-to-seed.mjs    generates supabase/seed.sql (Postgres only)
  dev/fake-sheets.mjs       local stand-in for the Sheets API
supabase/                   migrations + seed (Postgres only)
data/source/                the three original workbooks
```

### Refreshing the master lists

Drop a revised workbook into `data/source/` under the same filename, then:

```bash
npm run sheet:init      # Sheets
npm run seed            # Postgres — then re-run supabase/seed.sql
```

---

## Developing without Google

A local stand-in for the Sheets API, so you can work offline and without quota:

```bash
node scripts/dev/fake-sheets.mjs &
GOOGLE_SHEETS_ID=test-sheet \
GOOGLE_SHEETS_API_BASE=http://127.0.0.1:8787/v4/spreadsheets \
  npm run sheet:init
```

Then add `GOOGLE_SHEETS_API_BASE=http://127.0.0.1:8787/v4/spreadsheets` to
`.env.local`. It is honoured **only** for loopback addresses, so it cannot
accidentally disable authentication against Google. Remove the line to go
back to the real spreadsheet.

Postgres locally instead: `npx supabase start` (needs Docker), then set
`DATA_BACKEND=supabase`.

---

## Known limitations

- **Records are attributable, not verifiable.** Forms are open and names are
  typed, so an entry shows a name but cannot prove who performed the
  inspection — which is what a Factories Act audit asks for.
- **Typed names can fragment.** `R. Verma` and `Ramesh Verma` are two people
  to the dashboard. Whitespace is normalised; spelling is not.
- **One shared admin password**, not per-person accounts.
- **No rate limiting on the public form endpoints.** Payloads are size- and
  shape-validated; set `PLANT_ACCESS_CODE` if the URL leaks outside the plant.
  (The admin login *is* rate-limited.)
- **Two first aiders carry conflicting mobile numbers** in the source sheet
  (`AMARJEET KUMAR`, `RAJESHAR`). The most frequent was kept in `_boxes` —
  worth confirming with the OHC.
