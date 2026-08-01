# Crystal Tower — Moving & Delivery Planner

Coordinates move-ins, deliveries and contractor activity for the Crystal tower.
See `PROJECT.md` for goals, decisions and status.

## Development

```sh
bun install
bunx drizzle-kit push        # create/update local.db
bun run db:seed              # apartments from crystal-apartments-by-floor.csv
bun run db:seed-emails       # apartment ↔ email list from apartment-emails.csv
bun run db:seed-samples      # OPTIONAL, dev only: fake activities + statuses
bun run dev
```

Copy `.env.example` to `.env`. With `POSTMARK_TOKEN` empty, login links are printed to
the dev-server console instead of emailed.

## Deployment (Docker)

On the server, with the repo checked out:

1. Create `.env` with production values:
   - `ORIGIN=https://crystal.rx0.io`
   - `BETTER_AUTH_SECRET` — fresh, e.g. `openssl rand -base64 32`
   - `POSTMARK_TOKEN`, `POSTMARK_FROM`
   - `ADMIN_EMAILS` — comma-separated admin logins
   - `UNSOLD_EMAIL` — comma-separated; apartments paired with any of these emails are
     shown as "not sold"
2. Place the real `apartment-emails.csv` in `./data/` (next to the database). It is
   re-seeded on every boot; if missing, the container logs a warning and keeps the
   existing table. List unsold apartments against the seller's email and put that
   address in `UNSOLD_EMAIL`.
3. `docker compose up -d --build`

The SQLite database lives in `./data/local.db` on the host (volume mount) — back that
directory up. Each container boot pushes the schema and re-seeds apartments + emails
from the CSVs; resident statuses and activities are preserved. Do **not** run
`db:seed-samples` in production. Point the Cloudflare Zero Trust tunnel at port 3000.
