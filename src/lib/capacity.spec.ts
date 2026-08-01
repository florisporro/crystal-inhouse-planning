import { describe, expect, it } from 'vitest';
import { blockLoad } from './capacity';

describe('blockLoad', () => {
	it('computes resource footprints and flags overload', () => {
		const acts = [
			{ type: 'moving', block: 'morning', floor: 3 },
			{ type: 'moving', block: 'morning', floor: 20 },
			{ type: 'delivery', block: 'full_day', floor: 5 },
			{ type: 'moving', block: 'full_day', floor: 15 },
			{ type: 'other', block: 'morning', floor: 10 },
			{ type: 'other', block: 'afternoon', floor: 10 }
		] as const;

		const morning = blockLoad([...acts], 'morning');
		// 4 heavy activities in the morning (2 morning + 2 full_day) exceed 3 truck spaces
		expect(morning.trucks).toBe(4);
		expect(morning.vans).toBe(1);
		expect(morning.lowElevators).toBe(2.5); // floors 3,5 heavy + floor 10 other
		expect(morning.highElevators).toBe(2); // floors 20,15
		// elevator pool: 4.5 units over 3 elevators is itself over capacity
		expect(morning.load).toBeGreaterThan(1);

		const afternoon = blockLoad([...acts], 'afternoon');
		// only the two full_day heavies + one other carry over
		expect(afternoon.trucks).toBe(2);
		expect(afternoon.vans).toBe(1);
		expect(afternoon.load).toBeLessThanOrEqual(1);
	});

	it('caps high floors at the full-height elevators', () => {
		// 2 elevators reach floor 14+: three high moves overload them even though
		// 3 elevators exist in total
		const highMoves = [
			{ type: 'moving', block: 'morning', floor: 20 },
			{ type: 'moving', block: 'morning', floor: 25 },
			{ type: 'moving', block: 'morning', floor: 31 }
		] as const;
		const l = blockLoad([...highMoves], 'morning');
		expect(l.highElevators).toBe(3);
		expect(l.load).toBe(1.5); // 3 high / 2 full-height

		// the same three moves on low floors fit the 3-elevator pool exactly
		const lowMoves = highMoves.map((a) => ({ ...a, floor: 5 }));
		expect(blockLoad(lowMoves, 'morning').load).toBe(1);
	});

	it('is zero for no activities', () => {
		expect(blockLoad([], 'morning').load).toBe(0);
	});
});
