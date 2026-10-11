import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { inArray, notInArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { apartmentEmails, apartments } from '$lib/server/db/schema';
import {
	byApartment,
	changesBetween,
	formatEmailCsv,
	mergeEmailLists,
	parseEmailCsv,
	type Pair
} from '$lib/server/emailLists';

// the list CSV, plus siblings: .source.csv holds the previous owner export (the merge
// base for the next one), .backup.csv the list as it was before the last import
const listPath = (suffix = '.csv') =>
	(env.APARTMENT_EMAILS_CSV || 'apartment-emails.csv').replace(/(\.csv)?$/, suffix);

// After an admin edit: write the table back to the CSV the boot-time seed reads
// (scripts/seed-emails.ts re-seeds from it on every container start, so edits
// that only touch the database would be lost), and recompute unsold flags with
// the same UNSOLD_EMAIL rule as that seed.
export async function syncEmailList() {
	const rows = await db.select().from(apartmentEmails);
	writeFileSync(listPath(), formatEmailCsv(rows));

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

// What importing a new owner export (theirs) would do to the current list.
export async function planImport(theirs: Pair[]) {
	const ours = await db.select().from(apartmentEmails);
	const hasBase = existsSync(listPath('.source.csv'));
	// no previous export stored: edits made by hand can't be recognised, the export wins
	const base = hasBase ? parseEmailCsv(readFileSync(listPath('.source.csv'), 'utf8')) : ours;
	const { merged, conflicts } = mergeEmailLists(base, ours, theirs);
	const [b, o, t, m] = [base, ours, theirs, merged].map(byApartment);
	return {
		merged,
		preview: {
			hasBase,
			changes: changesBetween(ours, merged),
			conflicts: conflicts.map((apartment) => ({
				apartment,
				previous: b.get(apartment) ?? [],
				byHand: o.get(apartment) ?? [],
				export: t.get(apartment) ?? [],
				result: m.get(apartment) ?? []
			})),
			addresses: merged.length,
			apartments: m.size,
			// lets the apply step check the list did not change after the preview
			hash: createHash('sha256').update(formatEmailCsv(merged)).digest('hex')
		}
	};
}

export async function applyImport(theirs: Pair[], merged: Pair[]) {
	if (existsSync(listPath())) copyFileSync(listPath(), listPath('.backup.csv'));
	await db.transaction(async (tx) => {
		await tx.delete(apartmentEmails);
		if (merged.length > 0) await tx.insert(apartmentEmails).values(merged);
	});
	await syncEmailList();
	// last: if this write fails, the older base still merges without losing edits
	writeFileSync(listPath('.source.csv'), formatEmailCsv(theirs));
}
