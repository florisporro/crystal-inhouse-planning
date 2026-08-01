import { describe, expect, it } from 'vitest';
import { displayStatus, effectiveStatus, isoDate } from './viz';

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
