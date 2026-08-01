// Busyness math. Announce-only: loads are indications, never limits.
export interface Capacity {
	totalElevators: number;
	fullHeightElevators: number; // reach floor 31; the rest stop at floor 13
	truckSpaces: number;
	vanSpaces: number;
}

// defaults; admin overrides live in the settings table (see $lib/server/capacity)
export const DEFAULT_CAPACITY: Capacity = {
	totalElevators: 3,
	fullHeightElevators: 2,
	truckSpaces: 3,
	vanSpaces: 15
};

export const HIGH_BANK_MIN_FLOOR = 14;

export const BLOCKS = [
	{ key: 'morning', label: 'Morning', hours: '08:00–12:30' },
	{ key: 'afternoon', label: 'Afternoon', hours: '12:30–18:00' }
] as const;

export type ActivityType = 'moving' | 'delivery' | 'other';
export type Block = 'morning' | 'afternoon' | 'full_day';

/** how much one activity taxes each resource */
export interface ActivityCost {
	truck: number;
	van: number;
	elevator: number;
}
export type Costs = Record<ActivityType, ActivityCost>;

// defaults; admin overrides live in the settings table (see $lib/server/capacity)
export const DEFAULT_COSTS: Costs = {
	moving: { truck: 1, van: 0, elevator: 1 },
	delivery: { truck: 1, van: 0, elevator: 1 },
	other: { truck: 0, van: 1, elevator: 0.5 }
};

export interface LoadInput {
	type: ActivityType;
	block: Block;
	floor: number;
}

export interface BlockLoad {
	/** number of activities in the block (costs are weights, so trucks+vans ≠ count) */
	count: number;
	trucks: number;
	vans: number;
	/** elevator units needed by floors <=13 (any elevator will do) */
	lowElevators: number;
	/** elevator units needed by floors 14+ (only full-height elevators) */
	highElevators: number;
	/** worst resource utilisation, 0..n (>1 means over indicative capacity) */
	load: number;
}

export function blockLoad(
	activities: LoadInput[],
	block: 'morning' | 'afternoon',
	cap: Capacity = DEFAULT_CAPACITY,
	costs: Costs = DEFAULT_COSTS
): BlockLoad {
	const r = { count: 0, trucks: 0, vans: 0, lowElevators: 0, highElevators: 0, load: 0 };
	for (const a of activities) {
		if (a.block !== block && a.block !== 'full_day') continue;
		const c = costs[a.type];
		r.count += 1;
		r.trucks += c.truck;
		r.vans += c.van;
		if (a.floor >= HIGH_BANK_MIN_FLOOR) r.highElevators += c.elevator;
		else r.lowElevators += c.elevator;
	}
	// high floors compete for the full-height elevators; everyone competes for the pool
	r.load = Math.max(
		r.trucks / cap.truckSpaces,
		r.vans / cap.vanSpaces,
		r.highElevators / cap.fullHeightElevators,
		(r.lowElevators + r.highElevators) / cap.totalElevators
	);
	return r;
}

/** what public pages ship to the browser — no resource breakdown */
export function publicLoad(
	activities: LoadInput[],
	block: 'morning' | 'afternoon',
	cap?: Capacity,
	costs?: Costs
) {
	const l = blockLoad(activities, block, cap, costs);
	return { count: l.count, load: l.load };
}
