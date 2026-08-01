import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apartments } from '$lib/server/db/schema';
import { displayStatus } from '$lib/viz';

export const load = async () => {
	const apts = await db
		.select({
			number: apartments.number,
			floor: apartments.floor,
			unsold: apartments.unsold,
			status: apartments.status
		})
		.from(apartments)
		.orderBy(asc(apartments.number));

	const floors = new Map<number, { number: number; status: string }[]>();
	for (const a of apts) {
		if (!floors.has(a.floor)) floors.set(a.floor, []);
		floors.get(a.floor)!.push({ number: a.number, status: displayStatus(a) });
	}
	// top floor first
	return { floors: [...floors.entries()].sort((x, y) => y[0] - x[0]) };
};
