# Crystal Tower — Moving & Delivery Planner

Project outline. This document is the basis for all further work: decisions live in the
decisions log, unknowns in the open questions, and the build order in the task list.

## 1. Goal & scope

A public web tool for Crystal tower (179 apartments) that lets residents announce moves,
deliveries and contractor activity, and lets everyone see what's happening in the building.

Goals:

1. **Busyness overview** — gauge which days and time blocks are busier or quieter.
2. **Activity lists** — see activities per day and upcoming, browsable by date, apartment
   number or floor.
3. **Move-in progress** — percentage of apartments fully moved in, planned, no data, or
   not sold.
4. **Bottleneck spotting** — flag in advance when announced activity exceeds the
   indicative capacity of elevators and truck/van spaces.

Core principle: **announce-only**. The tool never blocks or limits a registration.
Capacity numbers only drive busyness indications and warnings.

Out of scope: hard reservations of specific elevators/spaces, payments, notifications
beyond login emails, languages other than English.

## 2. Decisions log

| Topic | Decision |
|---|---|
| Booking model | Announce-only: apartment registers an activity with date + time window. No enforcement. |
| Capacity defaults | 3 elevators in total, of which 2 reach floor 31 and 1 stops at floor 13 (floors ≤13 may use any elevator; floors 14+ only the 2 full-height ones); 3 moving-truck/delivery spaces; ~15 worker-van / general-activity spaces. Admin-configurable. |
| Roles | Public read for everyone. Residents log in to edit their own apartment. Admin (building manager / VvE) can edit everything incl. capacity settings. |
| Auth flow | Enter apartment number + email; if they match the mapping list, send a magic login link (better-auth magic-link plugin). |
| Email→apartment list | Supplied later by the owner of this project; multiple emails per apartment. |
| Email delivery | Postmark, sending as `noreply@crystal.rx0.io` (verified sender signature). `sendEmail()` posts to the Postmark API; with `POSTMARK_TOKEN` unset it logs to the console instead (dev). |
| Unsold units | Apartments whose paired email matches the comma-separated `UNSOLD_EMAIL` env var ⇒ status "not sold" (recomputed at every email seed). No owner data involved. |
| Floor mapping | `crystal-apartments-by-floor.csv` in the project root: `apartment,floor`, apartments 1–179, floors 3–31. Register unit `Hiraistraat 5B-<n>` ⇒ apartment `<n>` (verified: sets match exactly). |
| Resource footprint | Moving & delivery: 1 truck/large-van space + 1 elevator unit. All other activities: 1 small-van space + 0.5 elevator unit. (UI wording: "truck or large van" / "small van".) |
| Time blocks | Morning 08:00–12:30, afternoon 12:30–18:00, or full day. All days of the week allowed. |
| Moved-in status | Residents set "no move planned yet" or "fully moved in" directly; "move planned" is reached **only** by announcing a moving activity with the "fully moved in after this move" checkbox (default on) — future date ⇒ planned + date, past date ⇒ moved in. The /my status prompt's "Our move is planned" card links into the wizard with Moving preselected (allowed even while "no response"). Adjusting/cancelling that activity keeps/clears the status. A planned move whose date has passed automatically reads as "moved in" everywhere (derived at display time, nothing stored). "No response" is the default and admin-only. Activity creation runs through the `/announce` wizard. |
| Email list format | CSV, two columns: apartment number; comma-separated email addresses. Dev: repo root; production: `./data/apartment-emails.csv` on the volume (path via `APARTMENT_EMAILS_CSV`), re-seeded every boot, not baked into the image. |
| Admin accounts | Comma-separated `ADMIN_EMAILS` env var, same magic-link flow. Unset = no admins. |
| Privacy | Public views show apartment numbers only; owner names never rendered. |
| Busyness display | Public views show only an overall busyness level (Quiet → Very busy); the resource factors behind it (truck/van spaces, elevator split) are backend math, visible only on the admin page. |
| Hosting | Hostname via env var; behind Cloudflare Zero Trust reverse proxy; SQLite via volume mount. |
| Language | English UI. |
| Deployment | Docker container on a local server. SQLite database. Schema ships as committed drizzle migrations (`drizzle/`), applied on boot — `push` is dev-only. `NODE_ENV=production` in the image (enables better-auth rate limiting + secure cookies); boot fails fast if `ORIGIN` is unset. |
| Source data | `crystal-apartments-by-floor.csv` (apartment,floor — 179 rows) is the sole apartment source. The owners register is no longer used anywhere; no owner names in the repo, image or database. |

## 3. Open questions

All original questions answered — see decisions log. Remaining loose ends:

1. **Apartments with no known email** can't log in; admin edits on their behalf.
2. **Email→apartment CSV** to be supplied before Phase 2.

## 4. User stories

### Visitor (no login)

- As a visitor, I see a calendar/heatmap of announced activity so I can pick a quiet day.
- As a visitor, I see the list of activities for any day and for upcoming days.
- As a visitor, I can browse activities by date, apartment number or floor.
- As a visitor, I see move-in progress: % moved in / planned / no data / not sold.
- As a visitor, I see a **tower view**: one row per floor (31 down to 3), each apartment
  a colored box — green = fully moved in, blue = move planned, gray = no data,
  dark/hatched = not sold. Boxes link to the apartment's detail/activities.
- As a visitor, I see a warning on days/blocks where announced activity exceeds the
  indicative capacity of elevators (per bank), truck spaces or van spaces.

### Resident (logged in via apartment number + email)

- As a resident, I request a login link by entering my apartment number and email; if
  they match, I get a magic link by email.
- As a resident, I create an activity (type, date, time window, optional note) for my
  apartment, and I can adjust or cancel it.
- As a resident, I set my apartment's status (planned move date, fully moved in).

### Admin (building manager / VvE)

- As an admin, I can do everything a resident can, for any apartment.
- As an admin, I edit capacity settings (elevator counts per bank, truck/van spaces,
  allowed hours).
- As an admin, I manage the email↔apartment mapping and the unsold flag.

## 5. Data model sketch

| Table | Fields (sketch) |
|---|---|
| `apartments` | number (PK), floor, unsold flag, moved-in status, planned move date. Seeded from the floor map; unsold derived from `UNSOLD_EMAIL`. |
| `apartment_emails` | apartment number, email, admin flag. Seeded from the list supplied later. |
| `activities` | id, apartment number, type (moving / delivery / other), date, block (morning / afternoon / full day), note, status (active/cancelled), created/updated timestamps. |
| `settings` | key/value: elevator counts per bank, truck spaces, van spaces. |
| better-auth tables | Already generated in `src/lib/server/db/auth.schema.ts`. |

Busyness is computed, not stored: per day/block, count activities by resource footprint
and compare against settings.

## 6. Task list

Each phase is independently shippable.

- **Phase 0 — Data groundwork. ✅ Done.** Import script for the owners CSV (latin-1 → UTF-8),
  normalize apartment numbers, join floors from `crystal-apartments-by-floor.csv`, flag Revital
  units. *Verify: seeded apartment count = 179; spot-check floors.*
- **Phase 1 — Public views. ✅ Done.** Drizzle schema + seed. Read-only pages: busyness
  calendar/heatmap, per-day activity list, browse by apartment/floor, move-in progress
  stats, tower view (per-floor rows of status-colored apartment boxes, built from the
  floor map). *Verify: dev server renders all views with seed + sample activities.*
- **Phase 2 — Resident login & self-service. ✅ Done.** Magic-link auth (console-logged email),
  email↔apartment import, activity CRUD and status editing for own apartment.
  *Verify: e2e happy path — request link, log in, create/cancel activity.*
- **Phase 3 — Admin & bottlenecks. ✅ Done.** Admin role, capacity settings UI, bottleneck
  warnings on public views. *Verify: lower a capacity setting, see warning appear.*
- **Phase 4 — Ship. ✅ Done** (deploy = `docker compose up -d --build` on the server,
  see README). Real email delivery behind `sendEmail()` (Postmark), Dockerfile +
  docker-compose (adapter-node build, SQLite volume). *Verified: image builds from
  clean context, boot chain seeds 179 apartments, all routes serve, Postmark delivery
  confirmed with a real send.*
