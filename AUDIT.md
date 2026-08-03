# Security Audit — Crystal Tower Planner

Read-only review of the repo as it would deploy publicly (SvelteKit + better-auth
magic links, SQLite, Docker behind a Cloudflare tunnel). Findings ranked by risk.
The auth/access-control model itself is sound — the issues below are mostly
deployment config and a couple of design trade-offs worth a conscious decision.

## What's already good

- **No user enumeration on login.** The form responds identically whether or not
  the email/apartment pair is known (`login/+page.server.ts`), and `sendMagicLink`
  refuses unknown addresses (`auth.ts` + `isKnownEmail`).
- **Access control is centralized and checked on every mutation.** `canEdit` /
  `isAdmin` guard `setStatus`, `update`, `cancel`, activity creation, and the admin
  page. Ownership is re-checked server-side, not trusted from the form.
- **Input validation at the boundaries** — apartment range, ISO-date regex, enum
  whitelists for status/type/block, note capped at 200 chars. Only admins can set
  `no_data`.
- **No raw HTML sinks.** Notes render through Svelte's `{a.note}`, which escapes —
  no stored XSS despite resident-authored text on public pages.
- **Magic links expire in 5 minutes.** Owner names are deliberately never sent to
  public views.

---

## HIGH

### 1. Rate limiting is silently OFF in the deployed container

better-auth enables its rate limiter only when `NODE_ENV === "production"`
(`enabled: options.rateLimit?.enabled ?? isProduction`, `create-context.mjs:171`).
**Neither the Dockerfile nor docker-compose sets `NODE_ENV`**, and adapter-node
doesn't set it either — so in production the limiter is disabled and the
magic-link plugin's built-in 5-per-minute cap never applies.

Impact: the public `/api/auth/sign-in/magic-link` endpoint can be hit without
limit. `sendMagicLink` blocks _unknown_ addresses, but any **known** resident
address can be email-bombed, and every request runs an `isKnownEmail` DB query —
a cheap DoS and uncapped Postmark spend / sender-reputation damage.

Fix (pick one):

- Set `NODE_ENV=production` in `docker-compose.yml` (`environment:`) — also fixes
  the secure-cookie default in #3. **Simplest.**
- Or make it explicit in `auth.ts`: `rateLimit: { enabled: true, window: 60, max: 5 }`.

### 2. `drizzle-kit push --force` on every container boot

`Dockerfile` CMD runs `bunx drizzle-kit push --force && …` on each start. `--force`
applies schema diffs without confirmation; on schema drift it can drop columns and
**silently lose resident statuses/activities** — the one thing the volume mount is
meant to protect. The comment claims all steps are idempotent, but `push --force`
is not safe under a destructive diff.

Fix: switch to generated migrations for production (`drizzle-kit generate` in dev,
`drizzle-kit migrate` on boot). Keep `push` for local dev only.

---

## MEDIUM

### 3. `ORIGIN` must be set to the real https URL, or two protections weaken

`baseURL: env.ORIGIN` is the sole trusted origin and also drives the secure-cookie
default (`secure` is set when `baseURL` starts with `https://`, else it falls back
to `isProduction` — which is false here per finding #1). If the server ships without
`ORIGIN` set (the `.env.example` default is `""`), CSRF origin checking and the
`Secure` session-cookie flag both degrade. The README documents setting it, but
nothing enforces it.

Fix: fail fast if `ORIGIN` is unset/empty in production, the same way
`db/index.ts` already throws on a missing `DATABASE_URL`.

### 4. All resident move data is public and unauthenticated

`/`, `/tower`, `/day/[date]`, `/apartment/[number]` load without any auth and expose
every apartment's move status, **planned move dates**, and resident notes. That's an
intentional "public overview," but publishing _when a specific unit will be empty /
mid-move_ is a real physical-security signal for residents (burglary timing).

Decision to make, not necessarily a bug: consider gating these behind login (you
already have the auth), or at least dropping planned dates / notes from the fully
public views and keeping the aggregate capacity heatmap public.

---

## LOW / cleanup

- **Dead `task` table** (`schema.ts:3`) — leftover scaffolding, unused anywhere.
  Delete it so it isn't pushed to prod.
- **Sample/example files ship in the tree** (`src/lib/vitest-examples/*`,
  `greet.ts`, `Welcome.svelte`). Harmless but noise; remove.
- **No security headers.** Behind Cloudflare you get HSTS, but a small
  `handle` hook adding `Content-Security-Policy` (default-src 'self'),
  `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` is cheap
  defense-in-depth (clickjacking + CSP as XSS backstop). SvelteKit also supports
  CSP via `kit.csp` in the svelte config.
- **`db:seed-samples` warning** — README says don't run it in prod; it's not in the
  boot CMD, so fine. Just keep it out.

---

## Suggested order

1. `NODE_ENV=production` in compose (#1, also fixes #3's cookie fallback).
2. Enforce `ORIGIN` at startup (#3).
3. Replace `push --force` with migrations before the next schema change (#2).
4. Decide the public-vs-authenticated question for move data (#4).
