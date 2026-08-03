import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apartmentEmails } from '$lib/server/db/schema';
import { isAdmin } from '$lib/server/access';
import { getCapacity, getCosts, setCapacity, setCosts } from '$lib/server/capacity';
import { DEFAULT_COSTS, type Capacity, type Costs } from '$lib/capacity';
import { syncEmailList } from '$lib/server/emailList';

const requireAdmin = (locals: App.Locals) => {
	if (!locals.user) redirect(302, '/login');
	if (!isAdmin(locals.user.email)) error(403, 'Admins only');
};

const validApartment = (n: number) => Number.isInteger(n) && n >= 1 && n <= 179;

export const load = async ({ locals, url }) => {
	requireAdmin(locals);
	const emailApartment = Number(url.searchParams.get('emails'));
	return {
		capacity: await getCapacity(),
		costs: await getCosts(),
		emailApartment: validApartment(emailApartment) ? emailApartment : null,
		emails: validApartment(emailApartment)
			? (
					await db
						.select({ email: apartmentEmails.email })
						.from(apartmentEmails)
						.where(eq(apartmentEmails.apartmentNumber, emailApartment))
						.orderBy(asc(apartmentEmails.email))
				).map((r) => r.email)
			: []
	};
};

export const actions = {
	saveCapacity: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const cap = {} as Capacity;
		for (const key of [
			'totalElevators',
			'fullHeightElevators',
			'truckSpaces',
			'vanSpaces'
		] as const) {
			const n = Number(form.get(key));
			if (!Number.isInteger(n) || n < 1 || n > 999) {
				return fail(400, { error: 'Capacities must be whole numbers of at least 1.' });
			}
			cap[key] = n;
		}
		if (cap.fullHeightElevators > cap.totalElevators) {
			return fail(400, { error: 'Full-height elevators cannot exceed the total.' });
		}
		await setCapacity(cap);
		return { saved: true };
	},
	saveCosts: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const costs = structuredClone(DEFAULT_COSTS);
		for (const type of Object.keys(costs) as (keyof Costs)[]) {
			for (const resource of ['truck', 'van', 'elevator'] as const) {
				const n = Number(form.get(`${type}.${resource}`));
				if (!Number.isFinite(n) || n < 0 || n > 99) {
					return fail(400, { costError: 'Activity loads must be numbers between 0 and 99.' });
				}
				costs[type][resource] = n;
			}
		}
		await setCosts(costs);
		return { costsSaved: true };
	},
	addEmail: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const apartment = Number(form.get('apartment'));
		const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
		if (!validApartment(apartment) || !email.includes('@')) {
			return fail(400, { emailError: 'Enter a valid apartment number and email address.' });
		}
		await db
			.insert(apartmentEmails)
			.values({ apartmentNumber: apartment, email })
			.onConflictDoNothing();
		await syncEmailList();
		redirect(303, `/admin?emails=${apartment}`);
	},
	removeEmail: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const apartment = Number(form.get('apartment'));
		const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
		if (!validApartment(apartment) || !email) {
			return fail(400, { emailError: 'Enter a valid apartment number and email address.' });
		}
		await db
			.delete(apartmentEmails)
			.where(and(eq(apartmentEmails.apartmentNumber, apartment), eq(apartmentEmails.email, email)));
		await syncEmailList();
		redirect(303, `/admin?emails=${apartment}`);
	}
};
