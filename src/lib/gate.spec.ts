import { describe, expect, it } from 'vitest';
import { gateActivity, gatePhase, withHuismeester } from './gate';

const act = (date: string, status = 'active') => ({ id: 1, date, status });

describe('gateActivity', () => {
	it('picks an active activity dated today', () => {
		expect(gateActivity([act('2026-08-27')], '2026-08-27')).toEqual(act('2026-08-27'));
	});

	it('ignores cancelled activities and other dates', () => {
		expect(gateActivity([act('2026-08-27', 'cancelled')], '2026-08-27')).toBeNull();
		expect(gateActivity([act('2026-08-28')], '2026-08-27')).toBeNull();
	});

	it('returns null when nothing is booked', () => {
		expect(gateActivity([], '2026-08-27')).toBeNull();
	});
});

describe('gatePhase', () => {
	it('reports Bird accepting the call as still dialling', () => {
		expect(gatePhase(100, false)).toBe('dialling');
	});

	it('reports ringing as soon as the unit is reached', () => {
		expect(gatePhase(180, false)).toBe('ringing');
		expect(gatePhase(183, false)).toBe('ringing');
	});

	it('counts an answer as success', () => {
		expect(gatePhase(200, true)).toBe('done');
	});

	// the inversion: the unit opens on caller ID then rejects, so these are success
	it('counts a rejection from the far end as success', () => {
		for (const c of [486, 603, 480, 487]) {
			expect(gatePhase(c, false)).toBe('done');
		}
	});

	it('counts any final response as success once the call rang', () => {
		expect(gatePhase(408, true)).toBe('done');
		expect(gatePhase(302, true)).toBe('done');
	});

	// these come from Bird, not the gate: we never reached the unit
	it('fails on auth, permission and routing errors even after ringing', () => {
		for (const c of [401, 403, 407, 404, 484]) {
			expect(gatePhase(c, true)).toBe('failed');
		}
	});

	it('fails on server errors and on an unreached far end', () => {
		expect(gatePhase(503, false)).toBe('failed');
		expect(gatePhase(408, false)).toBe('failed');
	});
});

describe('withHuismeester', () => {
	it('appends a contact line when a phone number is configured', () => {
		expect(withHuismeester('Could not reach the gate.', '+31612345678')).toBe(
			'Could not reach the gate. Call the Huismeester at +31612345678.'
		);
	});

	it('leaves the message unchanged when no phone number is configured', () => {
		expect(withHuismeester('Could not reach the gate.', null)).toBe('Could not reach the gate.');
		expect(withHuismeester('Could not reach the gate.')).toBe('Could not reach the gate.');
	});
});
