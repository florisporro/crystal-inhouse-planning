import { error, fail, redirect } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activities, apartments } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { apartmentNumbersForEmail, canEdit, isAdmin } from '$lib/server/access';
import { activityFields } from '$lib/server/activityForm';

const requireUser = (locals: App.Locals) => {
	if (!locals.user) redirect(302, '/login');
	return locals.user;
};

export const load = async ({ locals, url }) => {
	const user = requireUser(locals);
	let numbers = await apartmentNumbersForEmail(user.email);
	// admins can open any apartment in this same editor via /my?apartment=N
	const requested = Number(url.searchParams.get('apartment'));
	if (isAdmin(user.email) && Number.isInteger(requested) && requested > 0) {
		numbers = [requested];
	}
	if (numbers.length === 0 && !isAdmin(user.email)) {
		return { email: user.email, admin: false, apartments: [] };
	}

	const apts = await db
		.select()
		.from(apartments)
		.where(inArray(apartments.number, numbers))
		.orderBy(asc(apartments.number));
	const acts = numbers.length
		? await db
				.select()
				.from(activities)
				.where(inArray(activities.apartmentNumber, numbers))
				.orderBy(asc(activities.date))
		: [];

	return {
		email: user.email,
		admin: isAdmin(user.email),
		apartments: apts.map((a) => ({
			number: a.number,
			floor: a.floor,
			status: a.status,
			plannedMoveDate: a.plannedMoveDate,
			acts: acts.filter((x) => x.apartmentNumber === a.number)
		}))
	};
};

// 'planned' is not settable here — only announcing a moving activity sets it
const RESIDENT_SET = ['no_move_planned', 'moved_in'];

async function checkedApartment(locals: App.Locals, form: FormData): Promise<number> {
	const user = requireUser(locals);
	const apartment = Number(form.get('apartment'));
	if (!(await canEdit(user.email, apartment))) error(403, 'Not your apartment');
	return apartment;
}

// was this activity the moving that set the apartment's "move planned" status?
async function wasPlannedMove(act: { type: string; date: string; apartmentNumber: number }) {
	if (act.type !== 'moving') return false;
	const [apt] = await db
		.select({ status: apartments.status, plannedMoveDate: apartments.plannedMoveDate })
		.from(apartments)
		.where(eq(apartments.number, act.apartmentNumber));
	return apt?.status === 'planned' && apt.plannedMoveDate === act.date;
}

async function checkedActivity(locals: App.Locals, form: FormData) {
	const user = requireUser(locals);
	const id = Number(form.get('id'));
	const [act] = await db.select().from(activities).where(eq(activities.id, id));
	if (!act) error(404, 'No such activity');
	if (!(await canEdit(user.email, act.apartmentNumber))) error(403, 'Not your apartment');
	return act;
}

export const actions = {
	setStatus: async ({ locals, request }) => {
		const form = await request.formData();
		const apartment = await checkedApartment(locals, form);
		const status = form.get('status')?.toString() ?? '';
		// only admins may reset to no_data ("never responded")
		const allowed = isAdmin(locals.user!.email) ? [...RESIDENT_SET, 'no_data'] : RESIDENT_SET;
		if (!allowed.includes(status)) return fail(400, { error: 'Invalid status' });
		await db
			.update(apartments)
			.set({ status: status as 'no_data' | 'no_move_planned' | 'moved_in', plannedMoveDate: null })
			.where(eq(apartments.number, apartment));
	},

	update: async ({ locals, request }) => {
		const form = await request.formData();
		const act = await checkedActivity(locals, form);
		const fields = activityFields(form);
		if (!fields) return fail(400, { error: 'Fill in activity type, date and time block.' });
		await db
			.update(activities)
			.set({ ...fields, updatedAt: new Date() })
			.where(eq(activities.id, act.id));
		// keep the planned-move status in sync when this was the status-setting move
		if (await wasPlannedMove(act)) {
			await db
				.update(apartments)
				.set(
					fields.type === 'moving'
						? { plannedMoveDate: fields.date }
						: { status: 'no_move_planned', plannedMoveDate: null }
				)
				.where(eq(apartments.number, act.apartmentNumber));
		}
	},

	cancel: async ({ locals, request }) => {
		const act = await checkedActivity(locals, await request.formData());
		await db
			.update(activities)
			.set({ status: 'cancelled', updatedAt: new Date() })
			.where(eq(activities.id, act.id));
		// no dangling "move planned" after its moving activity is cancelled
		if (await wasPlannedMove(act)) {
			await db
				.update(apartments)
				.set({ status: 'no_move_planned', plannedMoveDate: null })
				.where(eq(apartments.number, act.apartmentNumber));
		}
	},

	signout: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(302, '/');
	}
};
