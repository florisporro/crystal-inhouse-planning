// Gate opener: the premises gate unit opens when it receives a call from a
// whitelisted number. Pure logic here so the page and the server action share
// one rule and it stays unit-testable without a DB.

export const GATE_TERMS = [
	'I am at the gate right now and will make sure only my own vehicle enters.',
	'This is for a move or an activity that needs to park close to the building — otherwise I use public parking.',
	'I will keep the entrance and exit clear at all times.',
	'I will move my vehicle to public parking as soon as the activity is finished.',
	'If I do not follow these rules my vehicle may be towed at my expense.',
	'If I abuse this function I may be fined.'
];

export const GATE_COOLDOWN_MS = 60_000;

export type GatePhase = 'dialling' | 'ringing' | 'done' | 'failed';

/** the activity that unlocks the gate today, or null */
export function gateActivity<T extends { date: string; status: string }>(
	acts: T[],
	today: string
): T | null {
	return acts.find((a) => a.status === 'active' && a.date === today) ?? null;
}

/**
 * Map a SIP response code onto a phase.
 *
 * The gate unit opens on caller ID and then rejects the call — it usually never
 * answers. So a rejection is the expected happy path, not an error, and the real
 * failures are the ones where we never reached the unit at all: auth, routing, or
 * silence. `rang` means we saw a 180/183 for this call.
 *
 * This table is deliberately permissive about "rejected without ringing" while the
 * unit's actual behaviour is unverified — tighten it once we have seen a real call.
 */
export function gatePhase(code: number, rang: boolean): GatePhase {
	// auth, permission and routing: these come from Bird, not from the gate, so they
	// mean we never reached the unit — even if something rang first
	if ([401, 403, 407, 404, 484].includes(code)) return 'failed';
	if (code === 100) return 'dialling';
	if (code === 180 || code === 183) return 'ringing';
	if (code >= 200 && code < 300) return 'done'; // it answered
	// the far end spoke: 486 busy, 603 decline, 480 unavailable, 487 cancelled.
	// Checked before the 5xx rule below, since 603 is a 6xx and would be caught by it.
	if ([486, 603, 480, 487].includes(code)) return 'done';
	if (code >= 500 && code < 600) return 'failed'; // Bird or carrier failure
	if (code >= 300) return rang ? 'done' : 'failed';
	return 'dialling';
}

export const GATE_MESSAGES: Record<GatePhase, string> = {
	dialling: 'Connecting…',
	ringing: 'Ringing the gate — it should open now.',
	done: 'Gate dialled — it should be open.',
	failed: 'Could not reach the gate.'
};
