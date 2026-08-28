import { error, fail, redirect } from '@sveltejs/kit';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activities, apartments, gateOpens } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { apartmentNumbersForEmail, canEdit, isAdmin } from '$lib/server/access';
import { activityFields } from '$lib/server/activityForm';
import { effectiveStatus } from '$lib/viz';
import { GATE_COOLDOWN_MS, GATE_TERMS, gateActivity } from '$lib/gate';
import { dialGate, todayIso } from '$lib/server/gate';
import { log } from '$lib/server/log';

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
		return { email: user.email, admin: false, today: todayIso(), apartments: [] };
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
	// most recent gate open per apartment, to seed the dialog's cooldown countdown
	const gateOpenRows = numbers.length
		? await db
				.select({ apartmentNumber: gateOpens.apartmentNumber, createdAt: gateOpens.createdAt })
				.from(gateOpens)
				.where(inArray(gateOpens.apartmentNumber, numbers))
				.orderBy(desc(gateOpens.createdAt))
		: [];

	return {
		email: user.email,
		admin: isAdmin(user.email),
		today: todayIso(),
		apartments: apts.map((a) => {
			// rows are ordered desc, so the first match is the latest
			const lastOpen = gateOpenRows.find((g) => g.apartmentNumber === a.number);
			const cooldownUntil = lastOpen ? lastOpen.createdAt.getTime() + GATE_COOLDOWN_MS : 0;
			return {
				number: a.number,
				floor: a.floor,
				// a past planned move reads as moved in here too, so the resident's own
				// page agrees with the public views
				status: effectiveStatus(a.status, a.plannedMoveDate),
				plannedMoveDate: a.plannedMoveDate,
				acts: acts.filter((x) => x.apartmentNumber === a.number),
				gateCooldownUntil: cooldownUntil > Date.now() ? cooldownUntil : null
			};
		})
	};
};

// 'planned' is not settable here — the status card links into the announce
// wizard, where the moving activity sets it
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
		log('activity.update', { apartment: act.apartmentNumber, id: act.id });
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
		log('activity.cancel', { apartment: act.apartmentNumber, id: act.id });
		// no dangling "move planned" after its moving activity is cancelled
		if (await wasPlannedMove(act)) {
			await db
				.update(apartments)
				.set({ status: 'no_move_planned', plannedMoveDate: null })
				.where(eq(apartments.number, act.apartmentNumber));
		}
	},

	openGate: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const apartment = Number(form.get('apartment'));
		if (!(await canEdit(user.email, apartment))) error(403, 'Not your apartment');

		// ceremony, not security — but a hand-rolled POST shouldn't skip the rules
		const agreed = form.getAll('terms').map(String);
		if (GATE_TERMS.some((_, i) => !agreed.includes(String(i)))) {
			return fail(400, { gateError: 'Please confirm all the points first.' });
		}

		// admins may open any time; residents need an activity booked for today
		let activityId: number | null = null;
		if (!isAdmin(user.email)) {
			const acts = await db
				.select()
				.from(activities)
				.where(eq(activities.apartmentNumber, apartment));
			const act = gateActivity(acts, todayIso());
			if (!act) return fail(403, { gateError: 'No activity booked for today.' });
			activityId = act.id;
		}

		const [last] = await db
			.select({ createdAt: gateOpens.createdAt })
			.from(gateOpens)
			.where(eq(gateOpens.apartmentNumber, apartment))
			.orderBy(desc(gateOpens.createdAt))
			.limit(1);
		if (last && Date.now() - last.createdAt.getTime() < GATE_COOLDOWN_MS) {
			return fail(429, { gateError: 'The gate was just opened — wait a moment.' });
		}

		// the row is created first: the SIP callbacks need somewhere to write progress,
		// and it doubles as the audit trail whether or not the call gets off the ground
		const [row] = await db
			.insert(gateOpens)
			.values({ apartmentNumber: apartment, activityId, email: user.email, phase: 'dialling' })
			.returning({ id: gateOpens.id });

		log('gate.call', { apartment, activityId });
		try {
			const callId = dialGate((phase) =>
				db
					.update(gateOpens)
					.set({ phase })
					.where(eq(gateOpens.id, row.id))
					.catch(() => {})
			);
			await db.update(gateOpens).set({ callId }).where(eq(gateOpens.id, row.id));
		} catch (e) {
			console.error('gate dial failed', e);
			await db.update(gateOpens).set({ phase: 'failed' }).where(eq(gateOpens.id, row.id));
			return fail(502, { gateError: 'Could not reach the gate.' });
		}
		return { gateOpenId: row.id };
	},

	signout: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(302, '/');
	}
};
