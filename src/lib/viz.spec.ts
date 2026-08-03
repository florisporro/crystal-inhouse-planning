import { describe, expect, it } from 'vitest';
import { busyLabel, displayStatus, effectiveStatus, heatColor, isoDate } from './viz';

describe('busyLabel', () => {
	it('maps loads to the public wording', () => {
		expect(busyLabel(0)).toBe('No activity');
		expect(busyLabel(0.3)).toBe('Quiet');
		expect(busyLabel(0.6)).toBe('Moderate');
		expect(busyLabel(1)).toBe('Busy');
		expect(busyLabel(1.2)).toBe('Very busy');
	});
});

describe('heatColor', () => {
	it('recedes at zero and clamps above capacity', () => {
		expect(heatColor(0)).toBeNull();
		expect(heatColor(0.1)).toBeTruthy();
		expect(heatColor(5)).toBe(heatColor(1)); // clamped to the darkest ramp step
	});
});

describe('effectiveStatus', () => {
	it('flips a past planned move to moved_in, leaves the rest alone', () => {
		expect(effectiveStatus('planned', isoDate(-1))).toBe('moved_in');
		expect(effectiveStatus('planned', isoDate(0))).toBe('planned'); // moving today
		expect(effectiveStatus('planned', isoDate(7))).toBe('planned');
		expect(effectiveStatus('planned', null)).toBe('planned');
		expect(effectiveStatus('no_move_planned', isoDate(-1))).toBe('no_move_planned');
	});

	it('unsold always wins in displayStatus', () => {
		expect(displayStatus({ unsold: true, status: 'planned', plannedMoveDate: isoDate(-1) })).toBe(
			'not_sold'
		);
	});
});
