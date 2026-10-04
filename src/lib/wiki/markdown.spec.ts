import { describe, expect, it } from 'vitest';
import {
	imageIds,
	plainText,
	publicPart,
	render,
	renderPage,
	sections,
	wikiLinks
} from './markdown';
import { normalize } from './normalize';

const md = `Public intro.

:::private
Side door code: **4417**
:::

[waste](wiki:waste-disposal) [gone](wiki:nope) [bad](javascript:alert(1)) [site](https://example.com)

<img src=x onerror=alert(1)>

![door](/wiki/img/0123456789abcdef0123456789abcdef) ![ext](https://evil.example/x.png)
`;

const resolve = (slug: string) =>
	slug === 'waste-disposal' ? '/wiki/building/waste-disposal' : null;

describe('render', () => {
	it('never includes private content for anonymous visitors', () => {
		const html = render(md, { loggedIn: false, resolve });
		expect(html).not.toContain('4417');
		expect(html).not.toContain('wiki-private');
		expect(html).toContain('Public intro');
	});

	it('hides an unclosed private block', () => {
		const html = render('Hi\n\n:::private\nCode 4417\n\nMore 5521\n', { loggedIn: false, resolve });
		expect(html).not.toContain('4417');
		expect(html).not.toContain('5521');
		expect(html).toContain('Hi');
		expect(plainText('Hi\n\n:::private\nCode 4417\n\nMore 5521\n').public).toBe('Hi');
	});

	it('puts one login placeholder where hidden content was', () => {
		const opts = { loggedIn: false, resolve, loginUrl: '/login?next=%2Fwiki%2Fa' };
		const two = render('A\n\n:::private\nx\n:::\n\n:::private\ny\n:::\n\nB\n', opts);
		expect(two.match(/wiki-locked/g)).toHaveLength(1);
		expect(two).toMatch(/<p>A<\/p>\n<aside class="wiki-locked">.*<\/aside>\n<p>B<\/p>/s);
		expect(two).toContain('href="/login?next=%2Fwiki%2Fa"');
		const unclosed = render('A\n\n:::private\nx 4417\n\n## Heading\n\nmore\n', opts);
		expect(unclosed.match(/wiki-locked/g)).toHaveLength(1);
		expect(unclosed).not.toContain('4417');
		expect(unclosed).not.toContain('Heading');
		expect(render(md, { loggedIn: true, resolve })).not.toContain('wiki-locked');
	});

	it('shows private sections to logged-in residents', () => {
		const html = render(md, { loggedIn: true, resolve });
		expect(html).toContain(
			'<section class="wiki-private"><p>Side door code: <strong>4417</strong>'
		);
	});

	it('escapes raw HTML and unsafe links', () => {
		const html = render(md, { loggedIn: true, resolve });
		expect(html).not.toContain('<img src=x');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('evil.example');
		expect(html).toContain('href="https://example.com" rel="noopener noreferrer"');
	});

	it('resolves wiki links and marks missing ones', () => {
		const html = render(md, { loggedIn: true, resolve });
		expect(html).toContain('<a href="/wiki/building/waste-disposal">waste</a>');
		expect(html).toContain('<span class="wiki-missing" title="Page does not exist">gone</span>');
	});
});

describe('helpers', () => {
	it('splits search text by privacy', () => {
		const t = plainText(md);
		expect(t.public).not.toContain('4417');
		expect(t.private).toBe('Side door code: 4417');
	});

	it('finds images and links', () => {
		expect(imageIds(md)).toEqual(['0123456789abcdef0123456789abcdef']);
		expect(
			imageIds(publicPart(':::private\n![a](/wiki/img/0123456789abcdef0123456789abcdef)\n:::\n'))
		).toEqual([]);
		expect(wikiLinks(md)).toEqual(['waste-disposal', 'nope']);
	});
});

describe('headings and table of contents', () => {
	const page = `Intro.

## Opening hours

Text.

:::private
## Door codes

Code 4417.
:::

## Opening hours

### E-bikes
`;

	it('gives headings stable, deduplicated ids for everyone', () => {
		const anon = renderPage(page, { loggedIn: false, resolve });
		const resident = renderPage(page, { loggedIn: true, resolve });
		expect(anon.toc.map((t) => t.id)).toEqual(['opening-hours', 'opening-hours-2', 'e-bikes']);
		expect(resident.toc.map((t) => t.id)).toEqual([
			'opening-hours',
			'door-codes',
			'opening-hours-2',
			'e-bikes'
		]);
		expect(anon.html).toContain('<h2 id="opening-hours-2">');
		expect(resident.toc[0]).toEqual({ depth: 2, id: 'opening-hours', text: 'Opening hours' });
	});

	it('splits sections for search without leaking private text', () => {
		const s = sections(page);
		expect(s.map((x) => x.anchor)).toEqual(['', 'opening-hours', 'opening-hours-2', 'e-bikes']);
		expect(s[1]).toMatchObject({ heading: 'Opening hours', public: 'Text.' });
		expect(s[1].private).toContain('4417');
		expect(s.map((x) => x.public + x.heading).join()).not.toContain('4417');
	});

	it('hides headings after an unclosed private block', () => {
		const s = sections('Hi\n\n:::private\nsecret\n\n## Codes 4417\n\nmore\n');
		expect(JSON.stringify(s.map((x) => [x.anchor, x.heading, x.public]))).not.toContain('4417');
	});
});

describe('callouts', () => {
	const html = (md: string) => render(md, { loggedIn: true, resolve });

	it('renders types, aliases and titles', () => {
		expect(html('> [!info] Bike rules\n> Park in the racks.')).toMatch(
			/^<aside class="callout callout-info"><p class="callout-title"><svg[^]*<\/svg>Bike rules<\/p><p>Park in the racks.<\/p>/
		);
		expect(html('> [!caution]\n> Wet floor.')).toContain('callout-danger');
		expect(html('> [!caution]\n> Wet floor.')).toContain('</svg>Danger</p><p>Wet floor.');
		expect(html('> [!NOTE]\n>\n> Separate paragraph.')).toContain(
			'</svg>Info</p><p>Separate paragraph.</p>'
		);
	});

	it('leaves other quotes alone', () => {
		expect(html('> [!nonsense] x')).toContain('<blockquote>');
		expect(html('> Just a quote')).toContain('<blockquote>');
	});

	it('survives the editor round trip', () => {
		for (const md of ['> [!tip] Title\n> Body line.\n', '> [!warning]\n>\n> Body para.\n'])
			expect(html(normalize(md))).toContain('class="callout callout-');
	});
});
