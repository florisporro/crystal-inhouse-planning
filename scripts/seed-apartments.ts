// Seeds the apartments table from crystal-apartments-by-floor.csv (apartment,floor).
// Idempotent: re-running updates floors but preserves status and unsold flags
// (unsold is maintained by seed-emails.ts). Run: bun run db:seed
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import { apartments } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const db = drizzle(createClient({ url: process.env.DATABASE_URL }));

for (const line of readFileSync('crystal-apartments-by-floor.csv', 'utf8')
	.trim()
	.split('\n')
	.slice(1)) {
	const [number, floor] = line.split(',').map(Number);
	if (!Number.isInteger(number) || !Number.isInteger(floor)) {
		throw new Error(`Cannot parse line: ${line}`);
	}
	await db
		.insert(apartments)
		.values({ number, floor })
		.onConflictDoUpdate({ target: apartments.number, set: { floor } });
}

// self-check
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(apartments);
console.log(`Seeded ${count} apartments.`);
if (count !== 179) throw new Error(`Expected 179 apartments, got ${count}`);
