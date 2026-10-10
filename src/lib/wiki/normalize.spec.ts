import { describe, expect, it } from 'vitest';
import { normalize } from './normalize';
import { render, toBlocks } from './markdown';

const resolve = () => null;

describe('normalize', () => {
	const md = normalize(`Intro with a ratio of 1:::2.

* one
* two

:::private
Code **4417**, ratio 9:::9

Second line
:::

After.
`);

	it('is stable', () => {
		expect(normalize(md)).toBe(md);
	});

	it('writes private blocks the renderer recognises', () => {
		const anon = render(md, { loggedIn: false, resolve });
		expect(anon).not.toContain('4417');
		expect(anon).not.toContain('Second line');
		expect(anon).not.toContain('9:::9');
		expect(anon).toContain('1:::2');
		expect(anon).toContain('After.');
		expect(toBlocks(md).filter((b) => b.startsWith(':::private'))).toHaveLength(1);
	});

	it('only takes digits as ordered list markers', () => {
		const text = 'No. The huismeester looks after the grounds.\n\nMr. Smith.\n';
		expect(normalize(text)).toBe(text);
		expect(normalize('3. a\n4. b\n')).toBe('3. a\n4. b\n');
	});

	it('escapes raw HTML', () => {
		expect(normalize('<script>alert(1)</script>')).not.toContain('<script>');
	});
});
