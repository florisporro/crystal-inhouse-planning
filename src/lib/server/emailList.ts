import { writeFileSync } from 'node:fs';
import { asc, inArray, notInArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { apartmentEmails, apartments } from '$lib/server/db/schema';

// After an admin edit: write the table back to the CSV the boot-time seed reads
// (scripts/seed-emails.ts re-seeds from it on every container start, so edits
// that only touch the database would be lost), and recompute unsold flags with
// the same UNSOLD_EMAIL rule as that seed.
export async function syncEmailList() {
	const rows = await db
		.select()
		.from(apartmentEmails)
		.orderBy(asc(apartmentEmails.apartmentNumber), asc(apartmentEmails.email));

	const byApartment = new Map<number, string[]>();
	for (const r of rows) {
		if (!byApartment.has(r.apartmentNumber)) byApartment.set(r.apartmentNumber, []);
		byApartment.get(r.apartmentNumber)!.push(r.email);
	}
	const lines = ['apartment,emails'];
	for (const [number, emails] of byApartment) lines.push(`${number},"${emails.join(',')}"`);
	writeFileSync(env.APARTMENT_EMAILS_CSV || 'apartment-emails.csv', lines.join('\n') + '\n');

	const unsoldEmails = (env.UNSOLD_EMAIL ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	const unsoldNumbers = [
		...new Set(rows.filter((r) => unsoldEmails.includes(r.email)).map((r) => r.apartmentNumber))
	];
	if (unsoldNumbers.length > 0) {
		await db
			.update(apartments)
			.set({ unsold: true })
			.where(inArray(apartments.number, unsoldNumbers));
		await db
			.update(apartments)
			.set({ unsold: false })
			.where(notInArray(apartments.number, unsoldNumbers));
	} else {
		await db.update(apartments).set({ unsold: false });
	}
}
