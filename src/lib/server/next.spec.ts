import { describe, expect, it } from 'vitest';
import { safeNext } from './next';

describe('safeNext', () => {
	it('keeps same-site paths', () => {
		expect(safeNext('/wiki/building/lifts/edit')).toBe('/wiki/building/lifts/edit');
		expect(safeNext('/wiki?x=1#a')).toBe('/wiki?x=1#a');
	});

	it('rejects anything that leaves the site', () => {
		for (const v of [
			'//evil.com',
			'/\\evil.com',
			'https://evil.com',
			'javascript:alert(1)',
			'wiki',
			'',
			null
		])
			expect(safeNext(v)).toBeNull();
	});
});
