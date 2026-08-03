export const STATUSES = [
	{ key: 'moved_in', label: 'Moved in' },
	{ key: 'planned', label: 'Move planned' },
	{ key: 'no_move_planned', label: 'No move planned yet' },
	{ key: 'no_data', label: 'No response' },
	{ key: 'not_sold', label: 'Not sold' }
] as const;

// the status cards residents see; 'planned' links into the announce wizard
// (only its moving activity sets it), 'no_data' (never responded) is admin-only
export const RESIDENT_STATUSES = [
	{
		key: 'no_move_planned',
		label: 'No move planned yet',
		hint: 'We have the apartment, but no moving date in sight.'
	},
	{
		key: 'planned',
		label: 'Our move is planned',
		hint: 'We know roughly when we want to move in.'
	},
	{ key: 'moved_in', label: 'Fully moved in', hint: 'We live here — the move is done.' }
] as const;

export type DisplayStatus = (typeof STATUSES)[number]['key'];

/** a planned move whose date has passed counts as moved in — no stale "planned" */
export function effectiveStatus(status: string, plannedMoveDate: string | null): string {
	return status === 'planned' && plannedMoveDate && plannedMoveDate < isoDate(0)
		? 'moved_in'
		: status;
}

export function displayStatus(a: {
	unsold: boolean;
	status: string;
	plannedMoveDate: string | null;
}): DisplayStatus {
	return a.unsold ? 'not_sold' : (effectiveStatus(a.status, a.plannedMoveDate) as DisplayStatus);
}

// sequential blue ramp; hexes live in layout.css so dark mode can reverse it
const HEAT_RAMP = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--heat-${n})`);

/** public wording for a busyness level; resource internals stay backend-only */
export function busyLabel(load: number): string {
	if (load <= 0) return 'No activity';
	if (load < 0.5) return 'Quiet';
	if (load < 0.8) return 'Moderate';
	if (load <= 1) return 'Busy';
	return 'Very busy';
}

/** null for zero load (cell recedes to the surface) */
export function heatColor(load: number): string | null {
	if (load <= 0) return null;
	return HEAT_RAMP[Math.min(HEAT_RAMP.length - 1, Math.floor(load * HEAT_RAMP.length))];
}

export function isoDate(offsetDays = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	return d.toLocaleDateString('sv'); // yyyy-mm-dd in local time
}

export function fmtDate(iso: string): string {
	return new Date(iso + 'T12:00').toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}
