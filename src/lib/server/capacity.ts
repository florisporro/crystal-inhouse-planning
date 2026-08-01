import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { DEFAULT_CAPACITY, DEFAULT_COSTS, type Capacity, type Costs } from '$lib/capacity';

export async function getCapacity(): Promise<Capacity> {
	const rows = await db.select().from(settings);
	const cap = { ...DEFAULT_CAPACITY };
	for (const { key, value } of rows) {
		if (key in cap && Number(value) > 0) cap[key as keyof Capacity] = Number(value);
	}
	return cap;
}

export async function setCapacity(cap: Capacity) {
	for (const [key, value] of Object.entries(cap)) {
		await db
			.insert(settings)
			.values({ key, value: String(value) })
			.onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
	}
}

// costs live in the same table under flattened keys: cost.moving.truck, …
export async function getCosts(): Promise<Costs> {
	const rows = await db.select().from(settings);
	const costs = structuredClone(DEFAULT_COSTS);
	for (const { key, value } of rows) {
		const [prefix, type, resource] = key.split('.');
		if (prefix !== 'cost') continue;
		const bucket = costs[type as keyof Costs];
		const n = Number(value);
		if (bucket && resource in bucket && Number.isFinite(n) && n >= 0) {
			bucket[resource as keyof (typeof costs)['moving']] = n;
		}
	}
	return costs;
}

export async function setCosts(costs: Costs) {
	for (const [type, cost] of Object.entries(costs)) {
		for (const [resource, value] of Object.entries(cost)) {
			const key = `cost.${type}.${resource}`;
			await db
				.insert(settings)
				.values({ key, value: String(value) })
				.onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
		}
	}
}
