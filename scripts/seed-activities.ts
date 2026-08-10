// One-shot import of activities.csv (from scripts/convert-bookings.py).
// NOT part of the boot sequence: users create activities in the app, so this
// only replaces rows from a previous import (note starts with "Import:") and
// never touches user-created activities. Safe to re-run.
// Path via ACTIVITIES_CSV env var (default: activities.csv in the repo root).
// Run: bun run db:seed-activities
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { like, sql } from 'drizzle-orm';
import { activities } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const db = drizzle(createClient({ url: process.env.DATABASE_URL }));

const csvPath = process.env.ACTIVITIES_CSV || 'activities.csv';
if (!existsSync(csvPath)) throw new Error(`${csvPath} not found`);

const rows: (typeof activities.$inferInsert)[] = [];
for (const line of readFileSync(csvPath, 'utf8').trim().split('\n').slice(1)) {
	// apartment_number,type,date,block,"note" — note is quoted (contains commas)
	const m = line.trim().match(/^(\d+),(\w+),(\d{4}-\d{2}-\d{2}),(\w+),"(Import: [^"]*)"$/);
	if (!m) throw new Error(`Cannot parse line: ${line}`);
	rows.push({
		apartmentNumber: Number(m[1]),
		type: m[2] as 'moving' | 'delivery' | 'other',
		date: m[3],
		block: m[4] as 'morning' | 'afternoon' | 'full_day',
		note: m[5]
	});
}

const deleted = await db.delete(activities).where(like(activities.note, 'Import: %'));
await db.insert(activities).values(rows);
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(activities);
console.log(
	`Replaced ${deleted.rowsAffected} previously imported activities with ${rows.length} from ${csvPath}; table now has ${count} total.`
);
