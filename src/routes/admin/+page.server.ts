import { error, fail, redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/access';
import { getCapacity, setCapacity } from '$lib/server/capacity';
import type { Capacity } from '$lib/capacity';

const requireAdmin = (locals: App.Locals) => {
	if (!locals.user) redirect(302, '/login');
	if (!isAdmin(locals.user.email)) error(403, 'Admins only');
};

export const load = async ({ locals }) => {
	requireAdmin(locals);
	return { capacity: await getCapacity() };
};

export const actions = {
	saveCapacity: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const cap = {} as Capacity;
		for (const key of ['totalElevators', 'fullHeightElevators', 'truckSpaces', 'vanSpaces'] as const) {
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
	}
};
