import { error, fail, redirect } from '@sveltejs/kit';
import { and, between, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activities, apartments } from '$lib/server/db/schema';
import { apartmentNumbersForEmail, canEdit, isAdmin } from '$lib/server/access';
import { ISO_DATE, TYPES, activityFields } from '$lib/server/activityForm';
import { publicLoad } from '$lib/capacity';
import { getCapacity, getCosts } from '$lib/server/capacity';
import { isoDate } from '$lib/viz';

// so residents can pick a quiet day: date -> per-block busyness for the next 90 days
async function busynessMap() {
	const acts = await db
		.select({
			date: activities.date,
			block: activities.block,
			type: activities.type,
			floor: apartments.floor
		})
		.from(activities)
		.innerJoin(apartments, eq(activities.apartmentNumber, apartments.number))
		.where(and(eq(activities.status, 'active'), between(activities.date, isoDate(0), isoDate(90))));
	const cap = await getCapacity();
	const costs = await getCosts();
	const busy: Record<string, { morning: number; afternoon: number }> = {};
	for (const date of new Set(acts.map((a) => a.date))) {
		const dayActs = acts.filter((a) => a.date === date);
		busy[date] = {
			morning: publicLoad(dayActs, 'morning', cap, costs).load,
			afternoon: publicLoad(dayActs, 'afternoon', cap, costs).load
		};
	}
	return busy;
}

export const load = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	const numbers = await apartmentNumbersForEmail(locals.user.email);
	const admin = isAdmin(locals.user.email);
	if (numbers.length === 0 && !admin) redirect(302, '/my');

	const typeParam = url.searchParams.get('type') ?? '';
	const prefillType = TYPES.includes(typeParam) ? typeParam : '';

	if (!admin && numbers.length > 0 && !prefillType) {
		// first things first: pick a move-in status before announcing anything —
		// unless the status prompt itself sent them here with a preselected type
		const apts = await db
			.select({ status: apartments.status })
			.from(apartments)
			.where(inArray(apartments.number, numbers));
		if (apts.every((a) => a.status === 'no_data')) redirect(302, '/my');
	}

	const dateParam = url.searchParams.get('date') ?? '';
	const aptParam = Number(url.searchParams.get('apartment'));
	return {
		numbers,
		admin,
		busy: await busynessMap(),
		busyUntil: isoDate(90),
		today: isoDate(0),
		prefillType,
		prefillDate: ISO_DATE.test(dateParam) ? dateParam : '',
		prefillApartment: Number.isInteger(aptParam) && aptParam > 0 ? aptParam : (numbers[0] ?? null)
	};
};

export const actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) redirect(302, '/login');
		const form = await request.formData();
		const apartment = Number(form.get('apartment'));
		if (!(await canEdit(locals.user.email, apartment))) error(403, 'Not your apartment');
		const fields = activityFields(form);
		if (!fields) return fail(400, { error: 'Please pick an activity type, date and time.' });
		await db.insert(activities).values({ apartmentNumber: apartment, ...fields });

		// the moving activity is the single source of the "move planned" status
		if (fields.type === 'moving' && form.get('movedAfter')) {
			const inPast = fields.date < new Date().toLocaleDateString('sv');
			await db
				.update(apartments)
				.set(
					inPast
						? { status: 'moved_in', plannedMoveDate: null }
						: { status: 'planned', plannedMoveDate: fields.date }
				)
				.where(eq(apartments.number, apartment));
		}
		redirect(303, '/my');
	}
};
