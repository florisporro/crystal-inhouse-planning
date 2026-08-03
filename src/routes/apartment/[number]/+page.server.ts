import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activities, apartments } from '$lib/server/db/schema';
import { displayStatus } from '$lib/viz';
import { canEdit } from '$lib/server/access';

export const load = async ({ locals, params }) => {
	const number = Number(params.number);
	if (!Number.isInteger(number) || number < 1 || number > 179) error(404, 'No such apartment');
	const [apt] = await db.select().from(apartments).where(eq(apartments.number, number));
	if (!apt) error(404, 'No such apartment');

	const acts = await db
		.select({
			id: activities.id,
			date: activities.date,
			block: activities.block,
			type: activities.type,
			note: activities.note,
			status: activities.status
		})
		.from(activities)
		.where(eq(activities.apartmentNumber, number))
		.orderBy(asc(activities.date));

	return {
		number: apt.number,
		floor: apt.floor,
		status: displayStatus(apt),
		plannedMoveDate: apt.plannedMoveDate,
		editable: locals.user ? await canEdit(locals.user.email, apt.number) : false,
		acts
	};
};
