import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { DEFAULT_CAPACITY, type Capacity } from '$lib/capacity';

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
