import { and, asc, between, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activities, apartments } from '$lib/server/db/schema';
import { publicLoad } from '$lib/capacity';
import { getCapacity } from '$lib/server/capacity';
import { displayStatus, isoDate, type DisplayStatus } from '$lib/viz';

const pad = (n: number) => String(n).padStart(2, '0');

async function actsBetween(start: string, end: string) {
	return db
		.select({
			date: activities.date,
			block: activities.block,
			type: activities.type,
			apartmentNumber: activities.apartmentNumber,
			floor: apartments.floor
		})
		.from(activities)
		.innerJoin(apartments, eq(activities.apartmentNumber, apartments.number))
		.where(and(eq(activities.status, 'active'), between(activities.date, start, end)))
		.orderBy(asc(activities.date), asc(activities.block));
}

export const load = async ({ url }) => {
	const apts = await db
		.select({ unsold: apartments.unsold, status: apartments.status })
		.from(apartments);
	const stats: Record<DisplayStatus, number> = {
		moved_in: 0,
		planned: 0,
		no_move_planned: 0,
		no_data: 0,
		not_sold: 0
	};
	for (const a of apts) stats[displayStatus(a)]++;
	const base = { stats, total: apts.length, today: isoDate(0) };

	if (url.searchParams.get('view') === 'upcoming') {
		return { ...base, view: 'upcoming' as const, upcoming: await actsBetween(isoDate(0), isoDate(6)) };
	}

	const monthParam = url.searchParams.get('month') ?? '';
	const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : isoDate(0).slice(0, 7);
	const [y, m] = month.split('-').map(Number);
	const daysInMonth = new Date(y, m, 0).getDate();

	const acts = await actsBetween(`${month}-01`, `${month}-${pad(daysInMonth)}`);
	const cap = await getCapacity();
	const days = Array.from({ length: daysInMonth }, (_, i) => {
		const date = `${month}-${pad(i + 1)}`;
		const dayActs = acts.filter((a) => a.date === date);
		return {
			date,
			morning: publicLoad(dayActs, 'morning', cap),
			afternoon: publicLoad(dayActs, 'afternoon', cap)
		};
	});

	return {
		...base,
		view: 'calendar' as const,
		days,
		monthLabel: new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
			month: 'long',
			year: 'numeric'
		}),
		offset: (new Date(y, m - 1, 1).getDay() + 6) % 7, // Monday-first weekday of the 1st
		prevMonth: m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`,
		nextMonth: m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`
	};
};
