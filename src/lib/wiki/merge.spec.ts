import { describe, expect, it } from 'vitest';
import { hunks, merge, type Part } from './merge';

const apply = (parts: Part[], accepted: Set<number>) => merge(base, base, parts, accepted).md;

const base = `# Bike storage

Open 7:00 to 23:00.

- Bring your fob
- Use the rack

:::private
Side door code: 4417
:::

Questions? Ask the huismeester.
`;

const proposed = `# Bike storage

Open 6:00 to 23:00.

- Bring your fob
- Use the rack

:::private
Side door code: 5521
:::

E-bikes charge in the corner.

Questions? Ask the huismeester.
`;

const changes = (md1: string, md2: string) => hunks(md1, md2).filter((p) => p.kind === 'change');

describe('hunks', () => {
	it('finds one change per edited region, private block included', () => {
		const c = changes(base, proposed);
		expect(c).toHaveLength(2);
		expect(c[0]).toMatchObject({
			removed: ['Open 7:00 to 23:00.'],
			added: ['Open 6:00 to 23:00.']
		});
		// adjacent edits merge: the private block edit and the new paragraph after it
		expect(c[1]).toMatchObject({
			removed: [':::private\nSide door code: 4417\n:::'],
			added: [':::private\nSide door code: 5521\n:::', 'E-bikes charge in the corner.']
		});
	});

	it('treats a new page as a single change', () => {
		expect(changes('', proposed)).toHaveLength(1);
	});

	it('reports nothing for identical input', () => {
		expect(changes(base, base)).toHaveLength(0);
	});
});

describe('apply', () => {
	const parts = hunks(base, proposed);

	it('accept all gives the proposal', () => {
		expect(apply(parts, new Set([0, 1]))).toBe(proposed);
	});

	it('decline all gives the base', () => {
		expect(apply(parts, new Set())).toBe(base);
	});

	it('accepts a subset', () => {
		const out = apply(parts, new Set([0]));
		expect(out).toContain('Open 6:00');
		expect(out).toContain('4417');
		expect(out).not.toContain('E-bikes');
	});

	it('handles deletions', () => {
		const deleted = base.replace('Open 7:00 to 23:00.\n\n', '');
		const out = merge(base, base, hunks(base, deleted), new Set([0])).md;
		expect(out).not.toContain('Open');
		expect(out).toContain('# Bike storage\n\n- Bring');
	});
});

describe('merge onto a page that changed since', () => {
	const parts = hunks(base, proposed);

	it('keeps edits made in the meantime', () => {
		const current = base.replace('Questions? Ask the huismeester.', 'Questions? Mail the board.');
		const { md, conflicts } = merge(base, current, parts, new Set([0, 1]));
		expect(conflicts.size).toBe(0);
		expect(md).toContain('Open 6:00');
		expect(md).toContain('5521');
		expect(md).toContain('E-bikes');
		expect(md).toContain('Mail the board');
	});

	it('flags a change to a block that was edited since, and never applies it', () => {
		const current = base.replace('Open 7:00 to 23:00.', 'Open 7:30 to 23:00.');
		const { md, conflicts } = merge(base, current, parts, new Set([0, 1]));
		expect([...conflicts]).toEqual([0]);
		expect(md).toContain('Open 7:30');
		expect(md).toContain('5521');
	});

	it('anchors an insertion when blocks were added above it', () => {
		const add = base.replace('Questions?', 'Pets welcome.\n\nQuestions?');
		const current = '# New intro\n\n' + base;
		const { md } = merge(base, current, hunks(base, add), new Set([0]));
		expect(md.indexOf('Pets welcome.')).toBeLessThan(md.indexOf('Questions?'));
		expect(md).toContain('# New intro');
	});
});
