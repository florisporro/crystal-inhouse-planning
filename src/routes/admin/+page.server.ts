import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apartmentEmails } from '$lib/server/db/schema';
import { isAdmin } from '$lib/server/access';
import { getCapacity, getCosts, setCapacity, setCosts } from '$lib/server/capacity';
import { DEFAULT_COSTS, type Capacity, type Costs } from '$lib/capacity';
import { applyImport, planImport, syncEmailList } from '$lib/server/emailList';
import { formatEmailCsv, parseEmailCsv, parseOwnerExport, type Pair } from '$lib/server/emailLists';

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
	},
	previewExport: async ({ locals, request }) => {
		requireAdmin(locals);
		const file = (await request.formData()).get('export');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { exportError: 'Choose the owner export (CSV) first.' });
		}
		let theirs;
		try {
			// the VvE export is latin-1; only the ASCII apartment numbers and emails matter
			theirs = parseOwnerExport(Buffer.from(await file.arrayBuffer()).toString('latin1'));
		} catch (e) {
			return fail(400, { exportError: (e as Error).message });
		}
		if (theirs.length === 0) {
			return fail(400, { exportError: 'This export has no email addresses.' });
		}
		const { preview } = await planImport(theirs);
		return { preview: { ...preview, export: formatEmailCsv(theirs) } };
	},
	applyExport: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		// posted back by the browser: validate again
		let theirs: Pair[] = [];
		try {
			theirs = parseEmailCsv(form.get('export')?.toString() ?? '');
		} catch {
			// falls through to the check below
		}
		if (theirs.length === 0 || theirs.some((p) => !validApartment(p.apartmentNumber))) {
			return fail(400, { exportError: 'The import data is damaged. Upload the export again.' });
		}
		const { merged, preview } = await planImport(theirs);
		if (preview.hash !== form.get('hash')) {
			return fail(409, {
				exportError: 'The list changed after the preview. Upload the export again.'
			});
		}
		await applyImport(theirs, merged);
		return { imported: preview.changes.length };
	}
};
