import { describe, expect, it } from 'vitest';
import { activityFields } from './activityForm';

const fd = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};

describe('activityFields', () => {
	it('accepts a valid activity and trims the note', () => {
		expect(
			activityFields(fd({ type: 'moving', date: '2026-08-10', block: 'morning', note: ' piano ' }))
		).toEqual({ type: 'moving', date: '2026-08-10', block: 'morning', note: 'piano' });
	});

	it('rejects unknown types, blocks and malformed dates', () => {
		expect(activityFields(fd({ type: 'party', date: '2026-08-10', block: 'morning' }))).toBeNull();
		expect(activityFields(fd({ type: 'moving', date: '2026-08-10', block: 'evening' }))).toBeNull();
		expect(activityFields(fd({ type: 'moving', date: '10-08-2026', block: 'morning' }))).toBeNull();
		expect(activityFields(new FormData())).toBeNull();
	});

	it('caps the note at 200 chars and turns empty into null', () => {
		const base = { type: 'other', date: '2026-08-10', block: 'full_day' };
		expect(activityFields(fd({ ...base, note: '' }))?.note).toBeNull();
		expect(activityFields(fd({ ...base, note: 'x'.repeat(300) }))?.note).toHaveLength(200);
	});
});
