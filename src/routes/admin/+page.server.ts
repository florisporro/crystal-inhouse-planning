import { error, fail, redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/access';
import { getCapacity, getCosts, setCapacity, setCosts } from '$lib/server/capacity';
import { DEFAULT_COSTS, type Capacity, type Costs } from '$lib/capacity';

const requireAdmin = (locals: App.Locals) => {
	if (!locals.user) redirect(302, '/login');
	if (!isAdmin(locals.user.email)) error(403, 'Admins only');
};

export const load = async ({ locals }) => {
	requireAdmin(locals);
	return { capacity: await getCapacity(), costs: await getCosts() };
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
	}
};
