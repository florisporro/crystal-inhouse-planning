// Replaces apartment_emails from the CSV (apartment number, then one or more
// email addresses; quotes optional). Path via APARTMENT_EMAILS_CSV env var
// (default: apartment-emails.csv in the repo root). Run: bun run db:seed-emails
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { inArray, notInArray, sql } from 'drizzle-orm';
import { apartmentEmails, apartments } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const db = drizzle(createClient({ url: process.env.DATABASE_URL }));

const csvPath = process.env.APARTMENT_EMAILS_CSV || 'apartment-emails.csv';
if (!existsSync(csvPath)) {
	// no crash-loop on a fresh deploy: keep whatever is in the table
	console.warn(`WARNING: ${csvPath} not found — apartment_emails left unchanged.`);
	process.exit(0);
}

const rows: { apartmentNumber: number; email: string }[] = [];
for (const line of readFileSync(csvPath, 'utf8').trim().split('\n').slice(1)) {
	const m = line.match(/^(\d+)[;,](.+)$/);
	if (!m) throw new Error(`Cannot parse line: ${line}`);
	for (const raw of m[2].split(/[,;]/)) {
		const email = raw.replaceAll('"', '').trim().toLowerCase();
		if (!email) continue;
		if (!email.includes('@')) throw new Error(`Not an email for apartment ${m[1]}: ${email}`);
		rows.push({ apartmentNumber: Number(m[1]), email });
	}
}

await db.delete(apartmentEmails);
await db.insert(apartmentEmails).values(rows);
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(apartmentEmails);
console.log(`Seeded ${count} apartment-email pairs.`);

// unsold = apartment paired with an email listed in UNSOLD_EMAIL (comma-separated)
const unsoldEmails = (process.env.UNSOLD_EMAIL ?? '')
	.split(',')
	.map((e) => e.trim().toLowerCase())
	.filter(Boolean);
const unsoldNumbers = [
	...new Set(rows.filter((r) => unsoldEmails.includes(r.email)).map((r) => r.apartmentNumber))
];
if (unsoldNumbers.length > 0) {
	await db.update(apartments).set({ unsold: true }).where(inArray(apartments.number, unsoldNumbers));
	await db
		.update(apartments)
		.set({ unsold: false })
		.where(notInArray(apartments.number, unsoldNumbers));
} else {
	await db.update(apartments).set({ unsold: false });
}
console.log(`Marked ${unsoldNumbers.length} apartments as unsold.`);
