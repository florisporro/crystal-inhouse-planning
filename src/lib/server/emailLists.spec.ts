import { describe, expect, it } from 'vitest';
import {
	byApartment,
	changesBetween,
	formatEmailCsv,
	mergeEmailLists,
	parseEmailCsv,
	parseOwnerExport,
	type Pair
} from './emailLists';

const HEADER = 'Index nummer;Omschrijving;Eigenaar;E-mail;Gebruikers e-mail';
const row = (apt: string, emails: string) =>
	`A-1;Hiraistraat ${apt} (Woning met buitenruimte);Fam. X;${emails};`;

// { apartment: emails } → pairs
const pairs = (o: Record<number, string[]>): Pair[] =>
	Object.entries(o).flatMap(([n, emails]) =>
		emails.map((email) => ({ apartmentNumber: Number(n), email }))
	);
const asObject = (p: Pair[]) => Object.fromEntries(byApartment(p));

describe('parseOwnerExport', () => {
	it('takes the apartment from Omschrijving and splits messy email fields', () => {
		const text = [
			HEADER,
			row('5B-143', 'A@x.nl,  b@y.com, '),
			row('5 B 7', 'c@z.nl, c@z.nl'),
			row('5B-12', '')
		].join('\r\n');
		expect(asObject(parseOwnerExport(text))).toEqual({
			7: ['c@z.nl'],
			143: ['a@x.nl', 'b@y.com']
		});
	});

	it('refuses other files and rows it cannot place', () => {
		expect(() => parseOwnerExport('apartment,emails\n1,a@x.nl')).toThrow(/Omschrijving/);
		expect(() => parseOwnerExport([HEADER, row('Parkeerplaats 3', 'a@x.nl')].join('\n'))).toThrow(
			/apartment number/
		);
		expect(() => parseOwnerExport([HEADER, row('5B-180', 'a@x.nl')].join('\n'))).toThrow();
		expect(() => parseOwnerExport([HEADER, 'A-1;5B-1;a@x.nl'].join('\n'))).toThrow(/column count/);
	});
});

describe('formatEmailCsv', () => {
	it('round-trips through parseEmailCsv, sorted', () => {
		const p = pairs({ 12: ['b@y.nl', 'a@x.nl'], 3: ['c@z.nl'] });
		const text = formatEmailCsv(p);
		expect(text).toBe('apartment,emails\n3,"c@z.nl"\n12,"a@x.nl,b@y.nl"\n');
		expect(asObject(parseEmailCsv(text))).toEqual(asObject(p));
	});
});

describe('mergeEmailLists', () => {
	it('follows the export where nothing was edited by hand', () => {
		const base = pairs({ 1: ['old@x.nl'], 2: ['keep@x.nl'] });
		const theirs = pairs({ 1: ['new@x.nl'], 2: ['keep@x.nl'], 3: ['added@x.nl'] });
		const { merged, conflicts } = mergeEmailLists(base, base, theirs);
		expect(asObject(merged)).toEqual(asObject(theirs));
		expect(conflicts).toEqual([]);
	});

	it('keeps addresses added and removed by hand', () => {
		const base = pairs({ 1: ['a@x.nl', 'gone@x.nl'], 2: ['b@x.nl'] });
		const ours = pairs({ 1: ['a@x.nl', 'hand@x.nl'], 2: ['b@x.nl'] });
		const theirs = pairs({ 1: ['a@x.nl', 'gone@x.nl'], 2: ['c@x.nl'] });
		const { merged, conflicts } = mergeEmailLists(base, ours, theirs);
		expect(asObject(merged)).toEqual({ 1: ['a@x.nl', 'hand@x.nl'], 2: ['c@x.nl'] });
		expect(conflicts).toEqual([]);
	});

	it('does not flag the same fix made by hand and in the export', () => {
		const base = pairs({ 1: ['typo@gmial.com'] });
		const fixed = pairs({ 1: ['typo@gmail.com'] });
		const { merged, conflicts } = mergeEmailLists(base, fixed, fixed);
		expect(asObject(merged)).toEqual(asObject(fixed));
		expect(conflicts).toEqual([]);
	});

	it('flags different changes to one apartment and keeps both', () => {
		const base = pairs({ 1: ['old@x.nl'] });
		const ours = pairs({ 1: ['hand@x.nl'] });
		const theirs = pairs({ 1: ['export@x.nl'] });
		const { merged, conflicts } = mergeEmailLists(base, ours, theirs);
		expect(asObject(merged)).toEqual({ 1: ['export@x.nl', 'hand@x.nl'] });
		expect(conflicts).toEqual([1]);
	});
});

describe('changesBetween', () => {
	it('lists additions and removals per apartment, skipping unchanged ones', () => {
		const before = pairs({ 1: ['a@x.nl'], 2: ['same@x.nl'], 3: ['gone@x.nl'] });
		const after = pairs({ 1: ['b@x.nl'], 2: ['same@x.nl'], 4: ['new@x.nl'] });
		expect(changesBetween(before, after)).toEqual([
			{ apartment: 1, added: ['b@x.nl'], removed: ['a@x.nl'] },
			{ apartment: 3, added: [], removed: ['gone@x.nl'] },
			{ apartment: 4, added: ['new@x.nl'], removed: [] }
		]);
	});
});
