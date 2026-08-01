# ponytail: single-stage on purpose — keeps drizzle-kit + seed scripts available
# in the container for schema push and CSV seeding; image size doesn't matter here.
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile

COPY . .
# build-time module analysis loads server code eagerly; give it throwaway values
# (real values come from the environment at runtime via $env/dynamic/private)
RUN DATABASE_URL=file:/tmp/build.db BETTER_AUTH_SECRET=build-only ORIGIN=http://localhost:3000 bun run build

# NODE_ENV=production enables better-auth's rate limiter and secure-cookie defaults
ENV PORT=3000 NODE_ENV=production DATABASE_URL=file:/data/local.db \
	APARTMENT_EMAILS_CSV=/data/apartment-emails.csv
EXPOSE 3000

# every boot: apply committed migrations (never push --force — destructive on drift),
# refresh apartments + emails from the CSVs, then serve. All steps are idempotent;
# resident-set statuses and activities are preserved.
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun run db:seed && bun run db:seed-emails && exec bun build/index.js"]
