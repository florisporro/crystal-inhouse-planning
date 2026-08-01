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

export interface LoadInput {
	type: ActivityType;
	block: Block;
	floor: number;
}

export interface BlockLoad {
	trucks: number;
	vans: number;
	/** elevator units needed by floors <=13 (any elevator will do) */
	lowElevators: number;
	/** elevator units needed by floors 14+ (only full-height elevators) */
	highElevators: number;
	/** worst resource utilisation, 0..n (>1 means over indicative capacity) */
	load: number;
}

// Moving & delivery: 1 truck space + 1 elevator. Anything else: 1 van space + 0.5 elevator.
export function blockLoad(
	activities: LoadInput[],
	block: 'morning' | 'afternoon',
	cap: Capacity = DEFAULT_CAPACITY
): BlockLoad {
	const r = { trucks: 0, vans: 0, lowElevators: 0, highElevators: 0, load: 0 };
	for (const a of activities) {
		if (a.block !== block && a.block !== 'full_day') continue;
		const heavy = a.type === 'moving' || a.type === 'delivery';
		if (heavy) r.trucks += 1;
		else r.vans += 1;
		const elevatorUse = heavy ? 1 : 0.5;
		if (a.floor >= HIGH_BANK_MIN_FLOOR) r.highElevators += elevatorUse;
		else r.lowElevators += elevatorUse;
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
export function publicLoad(activities: LoadInput[], block: 'morning' | 'afternoon', cap?: Capacity) {
	const l = blockLoad(activities, block, cap);
	return { count: l.trucks + l.vans, load: l.load };
}
