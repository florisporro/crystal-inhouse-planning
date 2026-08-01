import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activities, apartments } from '$lib/server/db/schema';
import { publicLoad } from '$lib/capacity';
import { getCapacity, getCosts } from '$lib/server/capacity';

export const load = async ({ params }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(404, 'Not a date');

	const acts = await db
		.select({
			id: activities.id,
			block: activities.block,
			type: activities.type,
			note: activities.note,
			apartmentNumber: activities.apartmentNumber,
			floor: apartments.floor
		})
		.from(activities)
		.innerJoin(apartments, eq(activities.apartmentNumber, apartments.number))
		.where(and(eq(activities.status, 'active'), eq(activities.date, params.date)))
		.orderBy(asc(activities.block), asc(activities.apartmentNumber));

	const cap = await getCapacity();
	const costs = await getCosts();
	return {
		date: params.date,
		acts,
		morning: publicLoad(acts, 'morning', cap, costs),
		afternoon: publicLoad(acts, 'afternoon', cap, costs)
	};
};
